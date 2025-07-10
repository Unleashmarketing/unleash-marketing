// UNLEASH Website JavaScript
// ===========================

// Global Variables
let isScrolled = false;
let menuState = false;
let currentLogoSet = 1;
const totalLogoSets = 2;

// Header Functionality
// ====================

function updateHeaderState() {
    const header = document.querySelector('.header');
    if (!header) return;
    
    isScrolled = window.scrollY > 50;
    
    if (isScrolled) {
        header.setAttribute('data-state', 'active');
    } else {
        header.setAttribute('data-state', 'inactive');
    }
}

function toggleMobileMenu() {
    const header = document.querySelector('.header');
    if (!header) return;
    
    menuState = !menuState;
    
    if (menuState && !isScrolled) {
        header.setAttribute('data-state', 'active');
    } else if (!menuState && !isScrolled) {
        header.setAttribute('data-state', 'inactive');
    }
}

function initHeader() {
    // Header scroll effect
    window.addEventListener('scroll', updateHeaderState);

    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }

    // Close mobile menu when clicking nav links
    document.querySelectorAll('.mobile-nav__link').forEach(link => {
        link.addEventListener('click', () => {
            const header = document.querySelector('.header');
            if (!header) return;
            
            menuState = false;
            if (!isScrolled) {
                header.setAttribute('data-state', 'inactive');
            }
        });
    });

    // Initialize header state
    updateHeaderState();
}

// Client Logo Rotation
// ====================

function rotateClientLogos() {
    const allLogos = document.querySelectorAll('.client-logo');
    const currentLogos = document.querySelectorAll(`.client-logo[data-set="${currentLogoSet}"]`);
    
    if (allLogos.length === 0) return;
    
    // Hide current logos
    currentLogos.forEach(logo => {
        logo.classList.remove('active');
    });
    
    // Move to next set
    currentLogoSet = currentLogoSet === totalLogoSets ? 1 : currentLogoSet + 1;
    
    // Show new logos after a short delay
    setTimeout(() => {
        const newLogos = document.querySelectorAll(`.client-logo[data-set="${currentLogoSet}"]`);
        newLogos.forEach((logo, index) => {
            setTimeout(() => {
                logo.classList.add('active');
            }, index * 100); // Staggered animation
        });
    }, 300);
}

function initClientLogos() {
    const clientLogos = document.querySelector('.clients__logos');
    if (!clientLogos) return;
    
    // Start logo rotation
    setTimeout(() => {
        rotateClientLogos();
        setInterval(rotateClientLogos, 3000);
    }, 3000);

    // Initialize first set with staggered animation
    setTimeout(() => {
        const firstSetLogos = document.querySelectorAll('.client-logo[data-set="1"]');
        firstSetLogos.forEach((logo, index) => {
            setTimeout(() => {
                logo.classList.add('active');
            }, index * 80); // Faster logo animation
        });
    }, 900); // Starts after hero animations
}

// Hero Animations
// ===============

function initHeroAnimations() {
    const heroElements = document.querySelectorAll('.hero-animate');
    
    if (heroElements.length === 0) return;
    
    // Trigger animations with staggered delays
    heroElements.forEach((element, index) => {
        const delay = element.getAttribute('data-delay') || (index * 100);
        
        setTimeout(() => {
            element.classList.add('animate-in');
        }, parseInt(delay) + 300); // Reduced base delay to 300ms
    });
}

// Services Scroll Animation
// =========================

function initServicesScroll() {
    const serviceSlides = document.querySelectorAll('.service-slide');
    const servicesSection = document.querySelector('.services');
    
    if (!servicesSection || serviceSlides.length === 0) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove active from all slides
                serviceSlides.forEach(slide => slide.classList.remove('active'));
                // Add active to current slide
                entry.target.classList.add('active');
            }
        });
    }, {
        threshold: 0.5,
        rootMargin: '-20% 0px -20% 0px'
    });
    
    serviceSlides.forEach(slide => {
        observer.observe(slide);
    });
}

// FAQ Functionality
// =================

function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item__question');
    
    if (faqItems.length === 0) return;
    
    faqItems.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const isOpen = question.getAttribute('aria-expanded') === 'true';
            
            // Close all other FAQ items
            faqItems.forEach(otherQuestion => {
                if (otherQuestion !== question) {
                    otherQuestion.setAttribute('aria-expanded', 'false');
                    otherQuestion.nextElementSibling.classList.remove('open');
                }
            });
            
            // Toggle current FAQ item
            if (isOpen) {
                question.setAttribute('aria-expanded', 'false');
                answer.classList.remove('open');
            } else {
                question.setAttribute('aria-expanded', 'true');
                answer.classList.add('open');
            }
        });
    });
}

// Smooth Scrolling
// ================

function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = target.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Logo Hover Effects
// ==================

function initLogoEffects() {
    const logos = document.querySelectorAll('.logo');
    
    logos.forEach(logo => {
        const logoPattern = logo.querySelector('.logo__pattern');
        if (!logoPattern) return;
        
        logo.addEventListener('mouseenter', () => {
            logoPattern.style.transform = 'skewX(0deg) scaleY(1.2)';
            logoPattern.style.background = 'linear-gradient(45deg, #FF5100, #FF7A40)';
        });

        logo.addEventListener('mouseleave', () => {
            logoPattern.style.transform = 'skewX(-45deg)';
            logoPattern.style.background = '#FF5100';
        });
    });
}

// Service Card Hover Effects
// ===========================

function initServiceCardEffects() {
    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Team Member Hover Effects
// ==========================

function initTeamMemberEffects() {
    document.querySelectorAll('.team-member').forEach(member => {
        member.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px)';
        });
        
        member.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

// Ripple Effect for Buttons
// ==========================

function createRippleEffect(button, e) {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
    `;
    
    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

function initRippleEffects() {
    document.querySelectorAll('.hero__button, .hero__cta, .nav__button, .cta__button').forEach(button => {
        button.addEventListener('click', function(e) {
            createRippleEffect(this, e);
        });
    });
}

// Intersection Observer for Animations
// =====================================

function initIntersectionObserver() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe service cards for entrance animations
    document.querySelectorAll('.service-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Process steps animation
    document.querySelectorAll('.process-step').forEach((step, index) => {
        step.style.opacity = '0';
        step.style.transform = 'translateY(30px)';
        step.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        step.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(step);
    });

    // Team members animation
    document.querySelectorAll('.team-member').forEach((member, index) => {
        member.style.opacity = '0';
        member.style.transform = 'translateY(30px)';
        member.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        member.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(member);
    });
}

// Pattern Animation on Scroll
// ============================

function initPatternAnimation() {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const patterns = document.querySelectorAll('.hero__pattern, .cta__pattern');
        
        patterns.forEach(pattern => {
            const speed = 0.5;
            pattern.style.transform = `translateY(${scrolled * speed}px) rotate(${scrolled * 0.1}deg)`;
        });
    });
}

// Form Handling
// =============

function initFormHandling() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Basic form validation
            const requiredFields = this.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.style.borderColor = 'var(--color-primary)';
                    isValid = false;
                } else {
                    field.style.borderColor = '#2A2A2A';
                }
            });
            
            if (isValid) {
                // Here you would typically send the form data
                const submitButton = this.querySelector('.form-submit');
                const originalText = submitButton.textContent;
                
                submitButton.textContent = 'Wird gesendet...';
                submitButton.disabled = true;
                
                // Simulate form submission
                setTimeout(() => {
                    submitButton.textContent = 'Gesendet!';
                    setTimeout(() => {
                        submitButton.textContent = originalText;
                        submitButton.disabled = false;
                        this.reset();
                    }, 2000);
                }, 1000);
            }
        });
    });
}

// Navigation Active State
// =======================

function initNavigationActiveState() {
    const currentPage = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav__link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Simple logic to determine active state
        if (currentPage.includes('team') && href.includes('team')) {
            link.classList.add('nav__link--active');
        } else if (currentPage.includes('services') && href.includes('leistungen')) {
            link.classList.add('nav__link--active');
        } else if (currentPage === '/' && href === '/') {
            link.classList.add('nav__link--active');
        }
    });
}

// Performance Optimizations
// ==========================

function optimizeImages() {
    // Lazy loading for images
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    image.src = image.dataset.src;
                    image.removeAttribute('data-src');
                    imageObserver.unobserve(image);
                }
            });
        });

        images.forEach(image => imageObserver.observe(image));
    }
}

function preloadCriticalResources() {
    // Preload critical images
    const criticalImages = [
        // Add paths to critical images here
    ];
    
    criticalImages.forEach(imageSrc => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = imageSrc;
        document.head.appendChild(link);
    });
}

// Error Handling
// ==============

function initErrorHandling() {
    window.addEventListener('error', (e) => {
        console.error('JavaScript Error:', e.error);
        // Here you could send error reports to your analytics service
    });
    
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled Promise Rejection:', e.reason);
        // Handle unhandled promise rejections
    });
}

// Utility Functions
// =================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Accessibility Enhancements
// ===========================

function initAccessibility() {
    // Add skip navigation link
    const skipLink = document.createElement('a');
    skipLink.href = '#main';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--color-primary);
        color: white;
        padding: 8px;
        text-decoration: none;
        z-index: 9999;
        transition: top 0.3s;
    `;
    
    skipLink.addEventListener('focus', () => {
        skipLink.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-40px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // Enhanced keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close mobile menu on escape
            if (menuState) {
                toggleMobileMenu();
            }
            
            // Close open FAQ items
            document.querySelectorAll('.faq-item__question[aria-expanded="true"]').forEach(question => {
                question.click();
            });
        }
    });
    
    // Focus management for mobile menu
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            setTimeout(() => {
                if (menuState) {
                    const firstLink = mobileMenu.querySelector('.mobile-nav__link');
                    if (firstLink) firstLink.focus();
                }
            }, 100);
        });
    }
}

// Analytics and Tracking
// =======================

function initAnalytics() {
    // Track button clicks
    document.querySelectorAll('.hero__button, .hero__cta, .nav__button').forEach(button => {
        button.addEventListener('click', () => {
            // Here you would send tracking events to your analytics service
            console.log('Button clicked:', button.textContent);
        });
    });
    
    // Track form submissions
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', () => {
            console.log('Form submitted');
        });
    });
    
    // Track scroll depth
    let maxScroll = 0;
    const trackScrollDepth = throttle(() => {
        const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        if (scrollPercent > maxScroll) {
            maxScroll = scrollPercent;
            if (maxScroll % 25 === 0) {
                console.log('Scroll depth:', maxScroll + '%');
            }
        }
    }, 1000);
    
    window.addEventListener('scroll', trackScrollDepth);
}

// Main Initialization
// ===================

function init() {
    // Core functionality
    initHeader();
    initHeroAnimations();
    initClientLogos();
    initServicesScroll();
    initFAQ();
    initSmoothScrolling();
    
    // Visual effects
    initLogoEffects();
    initServiceCardEffects();
    initTeamMemberEffects();
    initRippleEffects();
    initIntersectionObserver();
    initPatternAnimation();
    
    // Form and navigation
    initFormHandling();
    initNavigationActiveState();
    
    // Performance and accessibility
    optimizeImages();
    preloadCriticalResources();
    initAccessibility();
    initErrorHandling();
    
    // Analytics (if needed)
    // initAnalytics();
    
    console.log('UNLEASH website initialized successfully');
}

// DOM Ready and Load Events
// =========================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Additional load event for complete initialization
window.addEventListener('load', () => {
    // Any code that needs to run after all resources are loaded
    document.body.classList.add('loaded');
});

// Export functions for potential external use
window.UNLEASH = {
    updateHeaderState,
    toggleMobileMenu,
    rotateClientLogos,
    initHeroAnimations,
    debounce,
    throttle
};
