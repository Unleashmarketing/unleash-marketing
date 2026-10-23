/**
 * Cloudflare Worker: receives NotFair's "publish_posts" webhook and
 * commits each post as a new/updated page under /blog/<slug>/ in the
 * unleash-marketing website repo (clean URL, matches the site's existing
 * dark/orange design system), then keeps sitemap.xml in sync.
 *
 * Required secrets (Worker Settings -> Variables and Secrets):
 *   GITHUB_TOKEN            fine-grained PAT, contents:read/write on the repo
 *   NOTFAIR_WEBHOOK_SECRET  the exact webhook secret NotFair shows you in
 *                           its dashboard (NOT a value you make up yourself)
 */

const REPO_OWNER = "Unleashmarketing";
const REPO_NAME = "unleash-marketing";
const BRANCH = "main";
const SITE_ORIGIN = "https://unleash-marketing.de";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ error: "unsupported_content_type" }, 415);
    }

    const authHeader = request.headers.get("Authorization") || "";
    const expected = `Bearer ${env.NOTFAIR_WEBHOOK_SECRET || ""}`;
    const authorized = await timingSafeEqual(authHeader, expected);
    if (!authorized) {
      return json({ error: "unauthorized" }, 401);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return json({ error: "invalid_json" }, 400);
    }

    if (payload.event_type !== "publish_posts") {
      return json({ error: "unsupported_event_type" }, 400);
    }

    const posts = payload?.data?.posts;
    if (!Array.isArray(posts) || posts.length < 1 || posts.length > 10) {
      return json({ error: "invalid_posts_count" }, 400);
    }

    const isTest = payload.test === true;
    for (const post of posts) {
      const hasCoreFields =
        post.id !== undefined &&
        post.id !== null &&
        post.title &&
        post.slug &&
        post.content_html &&
        post.created_at;
      if (!hasCoreFields) {
        return json({ error: "invalid_post_shape", postId: post.id ?? null }, 400);
      }
      // id:0 is reserved for NotFair's connection test; real posts need a
      // positive integer id.
      if (!isTest && !(Number.isInteger(post.id) && post.id > 0)) {
        return json({ error: "invalid_post_id", postId: post.id }, 400);
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
        return json({ error: "invalid_slug", slug: post.slug }, 400);
      }
    }

    // Test deliveries: validate shape only, never touch GitHub.
    if (isTest) {
      return json({ ok: true, test: true, validatedPosts: posts.length }, 200);
    }

    const results = [];
    try {
      for (const post of posts) {
        const path = `blog/${post.slug}/index.html`;
        const html = renderPostPage(post);
        await upsertFile(
          env,
          path,
          html,
          `Publish blog post: ${post.title}`
        );
        await upsertSitemapEntry(env, `${SITE_ORIGIN}/blog/${post.slug}/`);
        results.push({ id: post.id, slug: post.slug, status: "published" });
      }
    } catch (err) {
      // Something failed partway through — do NOT return 2xx, per contract:
      // only return 2xx once the delivery is safely and fully stored.
      return json(
        { error: "publish_failed", detail: String(err), partial: results },
        502
      );
    }

    return json({ ok: true, published: results }, 200);
  },
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Constant-time string comparison: HMAC both inputs with a fixed key first
// so we always compare two fixed-length 32-byte digests, regardless of the
// length of the (attacker-controlled) Authorization header. This avoids
// leaking secret length or content through response-time differences.
async function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode("notfair-webhook-constant-time-compare"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const [macA, macB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(a)),
    crypto.subtle.sign("HMAC", key, enc.encode(b)),
  ]);
  const bufA = new Uint8Array(macA);
  const bufB = new Uint8Array(macB);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

// ---------- GitHub Contents API helpers ----------

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "User-Agent": "unleash-notfair-webhook",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function getFile(env, path) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    sha: data.sha,
    content: b64DecodeUtf8(data.content),
  };
}

async function putFile(env, path, content, message, sha) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const body = {
    message,
    content: b64EncodeUtf8(content),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function upsertFile(env, path, content, message) {
  const existing = await getFile(env, path);
  await putFile(env, path, content, message, existing?.sha);
}

function b64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function b64DecodeUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

// ---------- sitemap.xml upsert ----------

async function upsertSitemapEntry(env, loc) {
  const path = "sitemap.xml";
  const existing = await getFile(env, path);
  if (!existing) return; // no sitemap present, skip silently

  const today = new Date().toISOString().slice(0, 10);
  let xml = existing.content;

  const locTag = `<loc>${loc}</loc>`;
  if (xml.includes(locTag)) {
    // Update lastmod on the existing <url> block for this loc.
    const blockRegex = new RegExp(
      `(<url>\\s*${escapeRegex(locTag)}[\\s\\S]*?<lastmod>)[^<]*(</lastmod>[\\s\\S]*?</url>)`
    );
    xml = xml.replace(blockRegex, `$1${today}$2`);
  } else {
    const entry = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n\n`;
    xml = xml.replace("</urlset>", `${entry}</urlset>`);
  }

  await putFile(env, path, xml, `Add ${loc} to sitemap.xml`, existing.sha);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- page rendering ----------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateDE(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function renderPostPage(post) {
  const title = escapeHtml(post.title);
  const metaDescription = escapeHtml(post.meta_description || "");
  const canonical = `${SITE_ORIGIN}/blog/${post.slug}/`;
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const tagsHtml = tags
    .map((t) => `<span class="post-tag">${escapeHtml(t)}</span>`)
    .join("\n                        ");
  const publishedDate = formatDateDE(post.created_at);
  const readingTime = post.reading_time_minutes
    ? `${post.reading_time_minutes} Min. Lesezeit`
    : "";
  const image = post.image_url ? escapeHtml(post.image_url) : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/png" sizes="32x32" href="/bilder/logos/favicon-32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/bilder/logos/favicon-16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/bilder/logos/apple-touch-icon.png">
    <meta name="theme-color" content="#FF5100">
    <title>${title} | UNLEASH Blog</title>
    <meta name="description" content="${metaDescription}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${canonical}">

    <meta property="og:type" content="article">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${metaDescription}">
    <meta property="og:url" content="${canonical}">
    ${image ? `<meta property="og:image" content="${image}">` : ""}
    <meta property="og:locale" content="de_DE">
    <meta property="og:site_name" content="UNLEASH">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${metaDescription}">
    ${image ? `<meta name="twitter:image" content="${image}">` : ""}

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": "${title}",
      "url": "${canonical}",
      "datePublished": "${post.created_at || ""}",
      "dateModified": "${post.updated_at || post.created_at || ""}",
      "publisher": { "@type": "Organization", "name": "UNLEASH GbR", "url": "${SITE_ORIGIN}" }
    }
    </script>

    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px; scroll-behavior: smooth; }
        body {
            font-family: 'FK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: 400;
            line-height: 1.6;
            color: #FFFFFF;
            background-color: #121212;
            position: relative;
        }
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, #121212 0%, #1E1E1E 50%, #121212 100%);
            background-image: repeating-linear-gradient(45deg, transparent, transparent 16px, rgba(255,81,0,0.12) 16px, rgba(255,81,0,0.12) 17px);
            pointer-events: none;
            z-index: -2;
        }
        .container { max-width: 1440px; margin: 0 auto; padding: 0 60px; }
        :root {
            --color-primary: #FF5100;
            --color-bg-secondary: #1E1E1E;
            --color-text-primary: #FFFFFF;
            --color-text-secondary: #8E8E8E;
            --font-size-h1: clamp(2.25rem, 4.5vw, 3.5rem);
        }
        .header { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; padding: 0 8px; }
        .header__container {
            max-width: 1536px; margin: 8px auto 0; padding: 0 48px;
            background: rgba(18,18,18,0.85); backdrop-filter: blur(16px);
            border: 1px solid #1E1E1E; border-radius: 16px;
        }
        .header__content { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 12px 0; }
        .logo__image { height: 32px; width: auto; }
        .nav__list { display: flex; gap: 32px; list-style: none; font-size: 14px; }
        .nav__link { color: var(--color-text-secondary); text-decoration: none; font-weight: 500; }
        .nav__link:hover { color: var(--color-primary); }
        .nav__button { display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 6px; background: var(--color-primary); color: #fff; font-size: 14px; font-weight: 500; text-decoration: none; }

        .breadcrumb { padding: 140px 0 0; }
        .breadcrumb__list { display: flex; gap: 8px; list-style: none; font-size: 13px; color: var(--color-text-secondary); flex-wrap: wrap; }
        .breadcrumb__list a { color: var(--color-text-secondary); text-decoration: none; }
        .breadcrumb__list a:hover { color: var(--color-primary); }

        .post-hero { padding: 32px 0 48px; }
        .post-hero__eyebrow { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
        .post-hero__eyebrow::before { content: ''; width: 40px; height: 2px; background: var(--color-primary); }
        .post-hero__eyebrow span { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); letter-spacing: 0.12em; text-transform: uppercase; }
        .post-hero__title { font-size: var(--font-size-h1); font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 24px; max-width: 900px; }
        .post-hero__meta { display: flex; flex-wrap: wrap; gap: 20px; font-size: 13px; color: var(--color-text-secondary); margin-bottom: 20px; }
        .post-tags { display: flex; flex-wrap: wrap; gap: 8px; }
        .post-tag { border: 1px solid var(--color-text-secondary); color: var(--color-text-secondary); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }

        .post-media { padding: 0 0 56px; }
        .post-media__frame { width: 100%; max-height: 520px; border-radius: 24px; overflow: hidden; border: 1px solid #2A2A2A; }
        .post-media__frame img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .post-content { padding: 0 0 96px; max-width: 760px; }
        .post-content p { font-size: 1.05rem; color: #DDDDDD; line-height: 1.8; margin-bottom: 22px; }
        .post-content h2 { font-size: 1.6rem; font-weight: 700; margin: 48px 0 18px; color: var(--color-text-primary); }
        .post-content h3 { font-size: 1.25rem; font-weight: 700; margin: 36px 0 14px; color: var(--color-text-primary); }
        .post-content ul, .post-content ol { margin: 0 0 22px 20px; color: #DDDDDD; }
        .post-content li { margin-bottom: 8px; line-height: 1.7; }
        .post-content a { color: var(--color-primary); }
        .post-content img { max-width: 100%; border-radius: 16px; margin: 24px 0; }
        .post-content blockquote { border-left: 3px solid var(--color-primary); padding-left: 20px; color: var(--color-text-secondary); margin: 24px 0; }
        .post-content strong { color: var(--color-text-primary); }
        .post-content code { background: var(--color-bg-secondary); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }

        .cta-cards-section { padding: 0 0 120px; }
        .cta-cards__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        .cta-card { padding: 60px; border-radius: 24px; }
        .cta-card--services { background: var(--color-bg-secondary); border: 1px solid #2A2A2A; }
        .cta-card--contact { background: var(--color-primary); }
        .cta-card__title { font-size: 1.5rem; font-weight: 600; margin-bottom: 16px; line-height: 1.3; }
        .cta-card--contact .cta-card__title { font-size: 2.5rem; font-weight: 700; }
        .cta-card__text { margin-bottom: 32px; line-height: 1.6; color: var(--color-text-secondary); }
        .cta-card--contact .cta-card__text { color: rgba(255,255,255,0.9); }
        .cta-card__button { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 500; border: 1px solid var(--color-text-secondary); color: var(--color-text-primary); }
        .cta-card--contact .cta-card__button { background: #fff; color: var(--color-primary); border-color: transparent; }

        .footer { padding: 80px 0 40px; }
        .footer__container { max-width: 1440px; margin: 0 auto; padding: 0 24px; }
        .footer__content { background: rgba(18,18,18,0.8); border: 1px solid #1E1E1E; border-radius: 16px; padding: 40px; display: flex; flex-direction: column; gap: 32px; }
        .footer__top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; }
        .footer__tagline { color: var(--color-text-secondary); }
        .footer__bottom { border-top: 1px solid #2A2A2A; padding-top: 32px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        .footer__legal { display: flex; gap: 24px; flex-wrap: wrap; }
        .footer__legal a { color: var(--color-text-secondary); text-decoration: none; font-size: 14px; }
        .footer__legal a:hover { color: var(--color-primary); }
        .footer__copyright { font-size: 14px; color: var(--color-text-secondary); }

        @media (max-width: 768px) {
            .container { padding: 0 20px; }
            .breadcrumb { padding: 110px 0 0; }
            .cta-cards__grid { grid-template-columns: 1fr; }
            .cta-card { padding: 40px; }
            .post-content { padding: 0 0 56px; }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header__container">
            <div class="header__content">
                <a href="/" class="logo"><img src="/bilder/logos/Unleash_Logo_Orange.svg" alt="UNLEASH" class="logo__image"></a>
                <ul class="nav__list">
                    <li><a href="/team/" class="nav__link">Unser Team</a></li>
                    <li><a href="/services/" class="nav__link">Leistungen</a></li>
                    <li><a href="/projekte/" class="nav__link">Projekte</a></li>
                </ul>
                <a href="/kontakt/" class="nav__button">Projekt anfragen</a>
            </div>
        </div>
    </header>

    <main id="main-content">
        <section class="breadcrumb">
            <div class="container">
                <nav class="breadcrumb__list">
                    <a href="/">Home</a><span>/</span>
                    <a href="/blog/">Blog</a><span>/</span>
                    <span>${title}</span>
                </nav>
            </div>
        </section>

        <section class="post-hero">
            <div class="container">
                <div class="post-hero__eyebrow"><span>Blog</span></div>
                <h1 class="post-hero__title">${title}</h1>
                <div class="post-hero__meta">
                    ${publishedDate ? `<span>${publishedDate}</span>` : ""}
                    ${readingTime ? `<span>${readingTime}</span>` : ""}
                </div>
                <div class="post-tags">
                        ${tagsHtml}
                </div>
            </div>
        </section>

        ${image ? `
        <section class="post-media">
            <div class="container">
                <div class="post-media__frame">
                    <img src="${image}" alt="${title}">
                </div>
            </div>
        </section>` : ""}

        <section class="post-content">
            <div class="container">
                ${post.content_html}
            </div>
        </section>

        <section class="cta-cards-section">
            <div class="container">
                <div class="cta-cards__grid">
                    <div class="cta-card cta-card--services">
                        <h3 class="cta-card__title">Branding, Webdesign und Marketing aus einer Hand, damit alles zusammenwirkt statt nebeneinander herzulaufen.</h3>
                        <p class="cta-card__text">Schau dir an, womit wir Unternehmen digital nach vorne bringen.</p>
                        <a href="/services/" class="cta-card__button">Leistungen entdecken</a>
                    </div>
                    <div class="cta-card cta-card--contact">
                        <p class="cta-card__text">Ruf einfach an oder schreib uns.</p>
                        <h3 class="cta-card__title">Projekt starten</h3>
                        <a href="/kontakt/" class="cta-card__button">Kontakt</a>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer class="footer">
        <div class="footer__container">
            <div class="footer__content">
                <div class="footer__top">
                    <a href="/" class="logo"><img src="/bilder/logos/Unleash_Logo_Orange.svg" alt="UNLEASH" class="logo__image"></a>
                    <p class="footer__tagline">Kreativer Problemlöser</p>
                </div>
                <div class="footer__bottom">
                    <div class="footer__copyright">© 2026 UNLEASH GbR. Alle Rechte vorbehalten.</div>
                    <div class="footer__legal">
                        <a href="/datenschutz/">Datenschutz</a>
                        <a href="/impressum/">Impressum</a>
                        <a href="/agb/">AGB</a>
                        <a href="/kontakt/">Kontakt</a>
                    </div>
                </div>
            </div>
        </div>
    </footer>
</body>
</html>
`;
}
