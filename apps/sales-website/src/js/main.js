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
      vps: {
        tag: 'VOTRE VPS - AGENT ACTIF',
        content:
          "L'agent ServeFlow est l'unique point d'entrée. Il initie une connexion chiffrée vers l'extérieur. Aucune porte n'est ouverte aux pirates.",
      },
      sf: {
        tag: 'SERVERFLOW - ORCHESTRATEUR',
        content:
          'Notre plateforme reçoit les signaux de votre agent et prépare les instructions. On ne peut pas se connecter à votre machine, on attend que vous nous parliez.',
      },
      connection: {
        tag: 'WEBSOCKET TLS 1.3 - SENS UNIQUE',
        content:
          'Un tunnel chiffré "sortant uniquement". Les données circulent sur un canal privé Ed25519. Confidentialité totale garantie par le matériel.',
      },
      default: {
        tag: 'SÉCURITÉ ARCHITECTURE',
        content: 'Survolez les éléments pour comprendre le fonctionnement du flux.',
      },
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

    svg.querySelectorAll('.diag-node, .diag-hitbox').forEach((el) => {
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

        setTimeout(
          () => {
            line.classList.add('visible');
          },
          200 + index * 400,
        ); // Stagger each line by 400ms
      });
    }

    // Start animation after page loads and terminal is visible
    setTimeout(typeCommand, 800);
  }

  // ==========================================================================
  // INSTALL TERMINAL ANIMATION (How it Works section)
  // ==========================================================================
  function initInstallTerminal() {
    const terminal = document.getElementById('install-terminal');
    if (!terminal) return;

    const commandSpan = terminal.querySelector('.terminal-command');
    const cursor = terminal.querySelector('.terminal-cursor');
    const outputLines = terminal.querySelectorAll('.output-line');

    if (!commandSpan) return;

    const commandText = commandSpan.dataset.text || '';
    commandSpan.textContent = '';

    // Hide output lines initially
    outputLines.forEach((line) => {
      line.style.opacity = '0';
      line.style.transform = 'translateY(5px)';
    });

    let hasAnimated = false;

    // Observe when terminal is visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            startTerminalAnimation();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 },
    );

    observer.observe(terminal);

    function startTerminalAnimation() {
      let charIndex = 0;
      const typingSpeed = 30; // ms per character (faster for longer command)

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

      // Step 2: Show output lines one by one
      function simulateEnter() {
        cursor.classList.add('hidden');

        outputLines.forEach((line, index) => {
          const text = line.dataset.text || '';
          const prefix = line.dataset.prefix || '';

          setTimeout(
            () => {
              line.innerHTML = prefix ? `<span class="success">${prefix}</span> ${text}` : text;
              line.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
              line.style.opacity = '1';
              line.style.transform = 'translateY(0)';
            },
            150 + index * 300,
          ); // Stagger each line
        });
      }

      typeCommand();
    }
  }

  // ==========================================================================
  // DEPLOY MOCKUP ANIMATION (How it Works step 2)
  // ==========================================================================
  function initDeployMockup() {
    const mockup = document.getElementById('deploy-mockup');
    if (!mockup) return;

    const header = mockup.querySelector('.dash-header');
    const githubIcon = mockup.querySelector('.github-icon');
    const title = mockup.querySelector('.anim-title');
    const repoItems = mockup.querySelectorAll('.repo-item');
    const autoDetect = mockup.querySelector('.auto-detect');
    const btnDeploy = mockup.querySelector('.btn-deploy');
    const deploySuccess = mockup.querySelector('.deploy-success');
    const check = mockup.querySelector('.anim-check');

    // Store title text and clear it
    const titleText = title?.dataset.text || '';
    if (title) title.textContent = '';

    let hasAnimated = false;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            startAnimation();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    );

    observer.observe(mockup);

    function startAnimation() {
      let delay = 0;

      // 1. Header appears
      setTimeout(() => header?.classList.add('visible'), delay);
      delay += 200;

      // 2. GitHub icon appears
      setTimeout(() => githubIcon?.classList.add('visible'), delay);
      delay += 300;

      // 3. Title types out
      setTimeout(() => {
        if (title) {
          title.classList.add('visible');
          typeText(title, titleText, 40);
        }
      }, delay);
      delay += titleText.length * 40 + 200;

      // 4. Repo items appear one by one
      repoItems.forEach((item, i) => {
        setTimeout(() => item.classList.add('visible'), delay + i * 200);
      });
      delay += repoItems.length * 200 + 100;

      // 5. First repo gets selected (check appears)
      setTimeout(() => {
        const firstRepo = repoItems[0];
        if (firstRepo) {
          firstRepo.classList.add('selected-anim');
          check?.classList.add('visible');
        }
      }, delay);
      delay += 400;

      // 6. Auto-detect appears
      setTimeout(() => autoDetect?.classList.add('visible'), delay);
      delay += 400;

      // 7. Deploy button appears
      setTimeout(() => btnDeploy?.classList.add('visible'), delay);
      delay += 800;

      // 8. Success notification slides up
      setTimeout(() => deploySuccess?.classList.add('visible'), delay);
    }

    function typeText(element, text, speed) {
      let i = 0;
      function type() {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          setTimeout(type, speed);
        }
      }
      type();
    }
  }

  // ==========================================================================
  // CHAT MOCKUP ANIMATION (How it Works step 3)
  // ==========================================================================
  function initChatMockup() {
    const mockup = document.getElementById('chat-mockup');
    if (!mockup) return;

    const header = mockup.querySelector('.chat-header');
    const messagesContainer = mockup.querySelector('.chat-messages');
    const messages = mockup.querySelectorAll('.message');
    const chatInput = mockup.querySelector('.chat-input');
    const inputField = mockup.querySelector('#chat-input-field');

    // Scroll chat container to show a specific message (only scrolls the container, not the page)
    function scrollToMessage(message) {
      if (!messagesContainer || !message) return;

      // Calculate if message is below visible area of the container
      const containerHeight = messagesContainer.clientHeight;
      const messageBottom = message.offsetTop + message.offsetHeight;
      const scrollTop = messagesContainer.scrollTop;
      const visibleBottom = scrollTop + containerHeight;

      // Only scroll if the message bottom is below the visible area
      if (messageBottom > visibleBottom) {
        const newScrollTop = messageBottom - containerHeight + 20; // 20px padding
        messagesContainer.scrollTo({
          top: newScrollTop,
          behavior: 'smooth',
        });
      }
    }

    // Keep user message paragraphs empty until they are "sent"
    // Text will be set right before showing the bubble
    messages.forEach((msg) => {
      if (msg.dataset.type === 'user') {
        const p = msg.querySelector('p');
        if (p) p.textContent = '';
      }
    });

    let hasAnimated = false;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            startChatAnimation();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );

    observer.observe(mockup);

    function startChatAnimation() {
      let delay = 0;

      // 1. Header appears
      setTimeout(() => header?.classList.add('visible'), delay);
      delay += 300;

      // 2. Chat input appears
      setTimeout(() => chatInput?.classList.add('visible'), delay);
      delay += 200;

      // 3. Animate each message in sequence
      const messageArray = Array.from(messages);

      messageArray.forEach((msg) => {
        if (msg.dataset.type === 'user') {
          const p = msg.querySelector('p');
          const text = p?.dataset.text || p?.textContent || '';

          // Step 1: Type in input field
          setTimeout(() => {
            chatInput?.classList.add('active');
            typeInField(inputField, text, 30, () => {
              // Step 2: "Press Enter" - clear input, show user bubble
              setTimeout(() => {
                if (inputField) inputField.value = '';
                chatInput?.classList.remove('active');
                // Set text content and show the bubble
                if (p) p.textContent = text;
                msg.classList.add('visible');
                scrollToMessage(msg);
              }, 200);
            });
          }, delay);

          delay += text.length * 30 + 400;
        } else if (msg.dataset.type === 'assistant') {
          // Step 3: Show thinking dots
          setTimeout(() => {
            msg.classList.add('visible', 'thinking');
            scrollToMessage(msg);

            // Step 4: Show response after "thinking"
            setTimeout(() => {
              msg.classList.remove('thinking');
              scrollToMessage(msg);
            }, 1200);
          }, delay);

          delay += 1600;
        }
      });
    }

    function typeInField(field, text, speed, callback) {
      if (!field) {
        callback?.();
        return;
      }
      let i = 0;
      field.value = '';

      function type() {
        if (i < text.length) {
          field.value += text.charAt(i);
          i++;
          setTimeout(type, speed);
        } else {
          callback?.();
        }
      }
      type();
    }
  }

  // ==========================================================================
  // BADGE ANIMATIONS (How it Works section)
  // ==========================================================================
  function initBadgeAnimations() {
    const howSteps = document.querySelectorAll('.how-step');
    if (!howSteps.length) return;

    howSteps.forEach((step) => {
      const badges = step.querySelectorAll('.badge');
      if (!badges.length) return;

      // Set shimmer delay for each badge
      badges.forEach((badge, index) => {
        badge.style.setProperty('--shimmer-delay', `${index * 0.5}s`);
      });

      let hasAnimated = false;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !hasAnimated) {
              hasAnimated = true;

              // Animate badges one by one with staggered delay
              badges.forEach((badge, index) => {
                setTimeout(
                  () => {
                    badge.classList.add('badge-visible');
                  },
                  200 + index * 150,
                );
              });

              observer.disconnect();
            }
          });
        },
        { threshold: 0.4 },
      );

      observer.observe(step);
    });
  }

  // ==========================================================================
  // SECTION INDICATOR (Fixed bottom nav dots)
  // ==========================================================================
  function initSectionIndicator() {
    const indicator = document.getElementById('section-indicator');
    const label = document.getElementById('section-indicator-label');
    if (!indicator) return;

    const dots = indicator.querySelectorAll('.section-indicator-dot');
    if (!dots.length) return;

    // Map section IDs to their elements
    const sections = [];
    dots.forEach((dot) => {
      const sectionId = dot.dataset.section;
      let section = null;

      // Special handling for different section selectors
      if (sectionId === 'hero') {
        section = document.querySelector('.hero');
      } else if (sectionId === 'how-it-works') {
        section = document.getElementById('how-it-works');
      } else if (sectionId === 'security') {
        section = document.querySelector('.security-section, #security');
      } else if (sectionId === 'features') {
        section = document.querySelector('.features-grid-section, #features');
      } else if (sectionId === 'testimonials') {
        section = document.querySelector('.testimonials, #testimonials');
      }

      if (section) {
        sections.push({ id: sectionId, element: section, dot: dot });
      }
    });

    // If no sections found, hide indicator and exit
    if (sections.length === 0) {
      indicator.style.display = 'none';
      return;
    }

    let currentSection = null;
    let isIndicatorVisible = false;

    // Show/hide indicator based on scroll position
    function updateIndicatorVisibility() {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // Show after scrolling past 20% of the hero
      const showThreshold = windowHeight * 0.2;
      // Hide when near the footer (last 300px)
      const hideThreshold = docHeight - windowHeight - 300;

      if (scrollY > showThreshold && scrollY < hideThreshold) {
        if (!isIndicatorVisible) {
          indicator.classList.add('visible');
          indicator.classList.remove('hidden');
          isIndicatorVisible = true;
        }
      } else {
        if (isIndicatorVisible) {
          indicator.classList.remove('visible');
          indicator.classList.add('hidden');
          isIndicatorVisible = false;
        }
      }
    }

    // Update active section based on scroll
    function updateActiveSection() {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const scrollCenter = scrollY + windowHeight * 0.4;

      let activeSection = null;

      // Find which section is currently in view
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const rect = section.element.getBoundingClientRect();
        const sectionTop = rect.top + scrollY;

        if (scrollCenter >= sectionTop) {
          activeSection = section;
          break;
        }
      }

      // Default to first section if none found
      if (!activeSection && sections.length > 0) {
        activeSection = sections[0];
      }

      // Update active dot
      if (activeSection && activeSection.id !== currentSection) {
        currentSection = activeSection.id;

        dots.forEach((dot) => dot.classList.remove('active'));
        activeSection.dot.classList.add('active');

        // Update label text
        if (label) {
          label.textContent = activeSection.dot.dataset.label || '';
        }
      }
    }

    // Click handler for dots
    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const sectionId = dot.dataset.section;
        const section = sections.find((s) => s.id === sectionId);

        if (section) {
          const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 80;
          const targetPosition =
            section.element.getBoundingClientRect().top + window.scrollY - navbarHeight;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth',
          });
        }
      });
    });

    // Throttled scroll handler
    let ticking = false;
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            updateIndicatorVisibility();
            updateActiveSection();
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true },
    );

    // Initial update
    updateIndicatorVisibility();
    updateActiveSection();
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
    navLinks.forEach((link) => {
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
    initInstallTerminal();
    initDeployMockup();
    initChatMockup();
    initBadgeAnimations();
    initSectionIndicator();
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
