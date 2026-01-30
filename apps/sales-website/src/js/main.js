/**
 * @file apps/sales-website/src/js/main.js
 * @description Scripts principaux pour le site de vente ServerFlow.
 * Gère les animations au scroll, le menu mobile, et les interactions utilisateur.
 */

(function () {
  'use strict';

  // ==========================================================================
  // SCROLL PROGRESS BAR
  // ==========================================================================
  function initScrollProgress() {
    const progressBar = document.querySelector('.scroll-progress-bar');
    if (!progressBar) return;

    window.addEventListener(
      'scroll',
      () => {
        const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = (window.scrollY / windowHeight) * 100;
        progressBar.style.width = scrolled + '%';
      },
      { passive: true },
    );
  }

  // ==========================================================================
  // REVEAL ON SCROLL (Intersection Observer)
  // ==========================================================================
  function initRevealOnScroll() {
    const reveals = document.querySelectorAll('.reveal');
    if (reveals.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    };

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Stop observing after reveal
          revealObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    reveals.forEach((reveal) => {
      revealObserver.observe(reveal);
    });
  }

  // ==========================================================================
  // SMOOTH SCROLL FOR ANCHOR LINKS
  // ==========================================================================
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 80;
          const targetPosition = target.getBoundingClientRect().top + window.scrollY - navbarHeight;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth',
          });

          // Close mobile menu if open
          const mobileMenu = document.querySelector('.mobile-menu');
          if (mobileMenu && mobileMenu.classList.contains('active')) {
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
          }
        }
      });
    });
  }

  // ==========================================================================
  // MOBILE MENU TOGGLE
  // ==========================================================================
  function initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');

    if (!toggle || !mobileMenu) return;

    toggle.addEventListener('click', () => {
      const isActive = mobileMenu.classList.toggle('active');
      toggle.setAttribute('aria-expanded', isActive);
      mobileMenu.setAttribute('aria-hidden', !isActive);
      document.body.style.overflow = isActive ? 'hidden' : '';
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!mobileMenu.contains(e.target) && !toggle.contains(e.target)) {
        mobileMenu.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }
    });
  }

  // ==========================================================================
  // LANGUAGE SELECTOR
  // ==========================================================================
  function initLanguageSelector() {
    const langSelectors = document.querySelectorAll('.language-selector');

    langSelectors.forEach((selector) => {
      const trigger = selector.querySelector('.lang-trigger');
      const dropdown = selector.querySelector('.lang-dropdown');

      if (!trigger || !dropdown) return;

      // Toggle on click for mobile
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', !isExpanded);
      });

      // Close when clicking outside
      document.addEventListener('click', () => {
        trigger.setAttribute('aria-expanded', 'false');
      });

      // Keyboard navigation
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
          trigger.setAttribute('aria-expanded', !isExpanded);
        }
      });
    });

    // Mark current language as active
    const currentLang = document.documentElement.lang || 'en';
    document.querySelectorAll('.lang-option').forEach((option) => {
      const optionLang = option.getAttribute('data-lang');
      if (optionLang === currentLang) {
        option.classList.add('active');
      }
    });
  }

  // ==========================================================================
  // NAVBAR BACKGROUND ON SCROLL
  // ==========================================================================
  function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    let lastScroll = 0;

    window.addEventListener(
      'scroll',
      () => {
        const currentScroll = window.scrollY;

        // Add intense style when scrolled
        if (currentScroll > 50) {
          navbar.classList.add('scrolled');
        } else {
          navbar.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
      },
      { passive: true },
    );
  }

  // ==========================================================================
  // TESTIMONIALS CAROUSEL PAUSE ON HOVER
  // ==========================================================================
  function initTestimonialsCarousel() {
    const track = document.querySelector('.testimonial-track');
    if (!track) return;

    // Pause animation on hover
    track.addEventListener('mouseenter', () => {
      track.style.animationPlayState = 'paused';
    });

    track.addEventListener('mouseleave', () => {
      track.style.animationPlayState = 'running';
    });

    // Pause animation when not visible (performance)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            track.style.animationPlayState = 'running';
          } else {
            track.style.animationPlayState = 'paused';
          }
        });
      },
      { threshold: 0 },
    );

    observer.observe(track);
  }

  // ==========================================================================
  // PARALLAX EFFECT FOR HERO ELEMENTS
  // ==========================================================================
  function initParallax() {
    const parallaxElements = document.querySelectorAll('.parallax');
    if (parallaxElements.length === 0) return;

    window.addEventListener(
      'scroll',
      () => {
        const scrolled = window.scrollY;

        parallaxElements.forEach((element) => {
          const speed = parseFloat(element.getAttribute('data-speed')) || 0.2;
          const yPos = -(scrolled * speed);
          element.style.transform = `translateY(${yPos}px)`;
        });
      },
      { passive: true },
    );
  }

  // ==========================================================================
  // TERMINAL TYPING ANIMATION TRIGGER
  // ==========================================================================
  function initTerminalAnimation() {
    const terminals = document.querySelectorAll('.terminal-mockup');

    terminals.forEach((terminal) => {
      const lines = terminal.querySelectorAll('.line.fade-in');

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              lines.forEach((line) => {
                line.style.animationPlayState = 'running';
              });
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 },
      );

      observer.observe(terminal);
    });
  }

  // ==========================================================================
  // FORM VALIDATION (Contact Page)
  // ==========================================================================
  function initFormValidation() {
    const forms = document.querySelectorAll('.contact-form');

    forms.forEach((form) => {
      form.addEventListener('submit', (e) => {
        const inputs = form.querySelectorAll(
          'input[required], textarea[required], select[required]',
        );
        let isValid = true;

        inputs.forEach((input) => {
          if (!input.value.trim()) {
            isValid = false;
            input.classList.add('error');
          } else {
            input.classList.remove('error');
          }
        });

        // Email validation
        const emailInput = form.querySelector('input[type="email"]');
        if (emailInput && emailInput.value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailInput.value)) {
            isValid = false;
            emailInput.classList.add('error');
          }
        }

        if (!isValid) {
          e.preventDefault();
        }
      });
    });
  }

  // ==========================================================================
  // FOOTER LANGUAGE SELECTOR
  // ==========================================================================
  function initFooterLanguageSelect() {
    const selects = document.querySelectorAll('.lang-select');

    selects.forEach((select) => {
      // Set current language as selected
      const currentLang = document.documentElement.lang || 'en';
      const options = select.querySelectorAll('option');
      options.forEach((option) => {
        if (option.value.includes(`/${currentLang}/`)) {
          option.selected = true;
        }
      });
    });
  }

  // ==========================================================================
  // ACCESSIBILITY: Focus Management
  // ==========================================================================
  function initAccessibility() {
    // Add visible focus styles only for keyboard users
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });
  }

  // ==========================================================================
  // REDUCED MOTION: Respect user preferences
  // ==========================================================================
  function initReducedMotion() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function handleReducedMotion() {
      if (prefersReducedMotion.matches) {
        document.documentElement.classList.add('reduced-motion');
      } else {
        document.documentElement.classList.remove('reduced-motion');
      }
    }

    handleReducedMotion();
    prefersReducedMotion.addEventListener('change', handleReducedMotion);
  }

  // ==========================================================================
  // FEATURE CARDS SPOTLIGHT (Apple/Railway style)
  // ==========================================================================
  function initFeatureCardsSpotlight() {
    const grid = document.querySelector('.features-grid-section .grid');
    if (!grid) return;

    grid.addEventListener('mousemove', (e) => {
      const cards = grid.querySelectorAll('.feature-card');
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  }

  // ==========================================================================
  // HOME SECURITY DIAGRAM INTERACTIVITY
  // ==========================================================================
  function initHomeSecurityDiagram() {
    const svg = document.getElementById('home-security-svg');
    const infoBox = document.getElementById('home-diag-info');
    if (!svg || !infoBox) return;

    const infoTag = infoBox.querySelector('.info-tag');
    const infoContent = infoBox.querySelector('.info-content');

    const data = {
      'vps': {
        tag: 'VOTRE VPS - AGENT ACTIF',
        content: 'L\'agent ServeFlow est l\'unique point d\'entrée. Il initie une connexion chiffrée vers l\'extérieur. Aucune porte n\'est ouverte aux pirates.'
      },
      'sf': {
        tag: 'SERVERFLOW - ORCHESTRATEUR',
        content: 'Notre plateforme reçoit les signaux de votre agent et prépare les instructions. On ne peut pas se connecter à votre machine, on attend que vous nous parliez.'
      },
      'connection': {
        tag: 'WEBSOCKET TLS 1.3 - SENS UNIQUE',
        content: 'Un tunnel chiffré "sortant uniquement". Les données circulent sur un canal privé Ed25519. Confidentialité totale garantie par le matériel.'
      },
      'default': {
        tag: 'SÉCURITÉ ARCHITECTURE',
        content: 'Survolez les éléments pour comprendre le fonctionnement du flux.'
      }
    };

    function update(key) {
      const item = data[key] || data['default'];
      infoBox.classList.add('active');
      infoTag.textContent = item.tag;
      infoContent.textContent = item.content;
    }

    function reset() {
      infoBox.classList.remove('active');
      update('default');
    }

    svg.querySelectorAll('.diag-node, .diag-hitbox').forEach(el => {
      el.addEventListener('mouseenter', () => update(el.dataset.info));
      el.addEventListener('mouseleave', reset);
    });
  }

  // ==========================================================================
  // CONSOLE TYPING EFFECT (Logo)
  // ==========================================================================
  function initConsoleTyping() {
    const consoleText = document.querySelector('.console-text');
    if (!consoleText) return;

    const text = consoleText.textContent || 'ServerFlow';
    consoleText.textContent = '';
    consoleText.classList.add('typing-ready');

    let index = 0;
    const typingSpeed = 100; // ms per character

    function typeChar() {
      if (index < text.length) {
        consoleText.textContent += text.charAt(index);
        index++;
        setTimeout(typeChar, typingSpeed);
      } else {
        // Animation complete - hide caret after a short delay
        setTimeout(() => {
          consoleText.classList.add('typing-done');
        }, 1500);
      }
    }

    // Start typing after a small delay for page load
    setTimeout(typeChar, 500);
  }

  // ==========================================================================
  // HERO TERMINAL ANIMATION
  // ==========================================================================
  function initHeroTerminal() {
    const terminal = document.getElementById('hero-terminal');
    if (!terminal) return;

    const commandSpan = terminal.querySelector('.terminal-command');
    const cursor = terminal.querySelector('.terminal-cursor');
    const outputLines = terminal.querySelectorAll('.output-line');

    if (!commandSpan) return;

    const commandText = commandSpan.dataset.text || '';
    commandSpan.textContent = '';

    let charIndex = 0;
    const typingSpeed = 50; // ms per character

    // Step 1: Type the command
    function typeCommand() {
      if (charIndex < commandText.length) {
        commandSpan.textContent += commandText.charAt(charIndex);
        charIndex++;
        setTimeout(typeCommand, typingSpeed);
      } else {
        // Command finished - simulate "Enter" press
        setTimeout(simulateEnter, 300);
      }
    }

    // Step 2: Simulate Enter and show output lines one by one
    function simulateEnter() {
      // Hide cursor
      cursor.classList.add('hidden');

      // Show output lines one by one
      outputLines.forEach((line, index) => {
        const text = line.dataset.text || '';
        line.textContent = text;

        setTimeout(() => {
          line.classList.add('visible');
        }, 200 + (index * 400)); // Stagger each line by 400ms
      });
    }

    // Start animation after page loads and terminal is visible
    setTimeout(typeCommand, 800);
  }

  // ==========================================================================
  // ACTIVE NAV LINK
  // ==========================================================================
  function initActiveNavLink() {
    const path = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a[data-page]');

    // Détecte la page courante depuis l'URL
    let currentPage = 'home';
    if (path.includes('/features')) currentPage = 'features';
    else if (path.includes('/deployments')) currentPage = 'deployments';
    else if (path.includes('/pricing')) currentPage = 'pricing';
    else if (path.includes('/security')) currentPage = 'security';

    // Applique la classe active au lien correspondant
    navLinks.forEach(link => {
      if (link.dataset.page === currentPage) {
        link.classList.add('active');
      }
    });
  }

  // ==========================================================================
  // INITIALIZE ALL
  // ==========================================================================
  function init() {
    initConsoleTyping();
    initHeroTerminal();
    initActiveNavLink();
    initScrollProgress();
    initRevealOnScroll();
    initSmoothScroll();
    initMobileMenu();
    initLanguageSelector();
    initNavbarScroll();
    initTestimonialsCarousel();
    initParallax();
    initTerminalAnimation();
    initFormValidation();
    initFooterLanguageSelect();
    initAccessibility();
    initReducedMotion();
    initFeatureCardsSpotlight();
    initHomeSecurityDiagram();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
