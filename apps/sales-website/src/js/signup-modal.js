/**
 * @file apps/sales-website/src/js/signup-modal.js
 * @description Logique JavaScript pour la modal de création de compte.
 * Gère l'ouverture, la fermeture, les validations et la soumission.
 *
 * @fonctions_principales
 * - openSignupModal(planName) : Ouvre la modal avec le plan sélectionné
 * - closeSignupModal() : Ferme la modal avec animation
 * - checkPasswordStrength() : Évalue la force du mot de passe
 * - initSignupModal() : Initialise tous les événements
 */

(function () {
  'use strict';

  // ==========================================================================
  // VARIABLES
  // ==========================================================================
  let modal = null;
  let modalContainer = null;
  let isOpen = false;
  let selectedPlan = null;

  // ==========================================================================
  // OPEN MODAL
  // ==========================================================================
  function openSignupModal(planName = null) {
    if (!modal || isOpen) return;

    isOpen = true;
    selectedPlan = planName;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    // Afficher le plan sélectionné
    const planBadge = modal.querySelector('.selected-plan-badge');
    const planNameEl = modal.querySelector('.plan-name');
    if (planName && planBadge && planNameEl) {
      planNameEl.textContent = planName;
      planBadge.style.display = 'inline-flex';
    } else if (planBadge) {
      planBadge.style.display = 'none';
    }

    // Empêcher le scroll du body
    document.body.style.overflow = 'hidden';

    // Focus sur le premier input après l'animation
    setTimeout(() => {
      const nameInput = modal.querySelector('#signup-name');
      if (nameInput) nameInput.focus();

      // Activer l'animation flottante après l'ouverture
      modal.classList.add('floating');
    }, 400);

    // Trap focus dans la modal
    trapFocus(modal);
  }

  // ==========================================================================
  // CLOSE MODAL
  // ==========================================================================
  function closeSignupModal() {
    if (!modal || !isOpen) return;

    isOpen = false;
    modal.classList.remove('active', 'floating');
    modal.setAttribute('aria-hidden', 'true');

    // Restaurer le scroll du body
    document.body.style.overflow = '';

    // Reset form
    const form = modal.querySelector('.modal-body');
    if (form) {
      const inputs = form.querySelectorAll('input');
      inputs.forEach((input) => {
        if (input.type !== 'checkbox') {
          input.value = '';
        } else {
          input.checked = false;
        }
      });
    }

    // Reset password strength
    const strengthIndicator = modal.querySelector('.password-strength');
    if (strengthIndicator) {
      strengthIndicator.classList.remove('visible', 'weak', 'fair', 'good', 'strong');
    }

    // Reset errors
    hideError();

    // Reset plan
    selectedPlan = null;
  }

  // ==========================================================================
  // TRAP FOCUS - Garder le focus dans la modal
  // ==========================================================================
  function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    });
  }

  // ==========================================================================
  // PASSWORD TOGGLE - Afficher/masquer le mot de passe
  // ==========================================================================
  function initPasswordToggle() {
    const toggleBtn = modal.querySelector('.password-toggle');
    if (!toggleBtn) return;

    const passwordInput = modal.querySelector('#signup-password');
    const eyeOpen = toggleBtn.querySelector('.eye-open');
    const eyeClosed = toggleBtn.querySelector('.eye-closed');

    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';

      eyeOpen.style.display = isPassword ? 'none' : 'block';
      eyeClosed.style.display = isPassword ? 'block' : 'none';
    });
  }

  // ==========================================================================
  // PASSWORD STRENGTH - Indicateur de force
  // ==========================================================================
  function initPasswordStrength() {
    const passwordInput = modal.querySelector('#signup-password');
    const strengthIndicator = modal.querySelector('.password-strength');
    const strengthText = modal.querySelector('.strength-text');

    if (!passwordInput || !strengthIndicator) return;

    passwordInput.addEventListener('input', () => {
      const password = passwordInput.value;

      if (password.length === 0) {
        strengthIndicator.classList.remove('visible', 'weak', 'fair', 'good', 'strong');
        return;
      }

      strengthIndicator.classList.add('visible');
      strengthIndicator.classList.remove('weak', 'fair', 'good', 'strong');

      const strength = checkPasswordStrength(password);
      strengthIndicator.classList.add(strength.level);
      if (strengthText) {
        strengthText.textContent =
          window.signupTranslations?.[`strength_${strength.level}`] || strength.level;
      }
    });
  }

  function checkPasswordStrength(password) {
    let score = 0;

    // Longueur
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Complexité
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 'weak', score };
    if (score <= 4) return { level: 'fair', score };
    if (score <= 5) return { level: 'good', score };
    return { level: 'strong', score };
  }

  // ==========================================================================
  // SHOW ERROR - Afficher un message d'erreur
  // ==========================================================================
  function showError(message) {
    let errorEl = modal.querySelector('.signup-error');

    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'signup-error';
      const submitBtn = modal.querySelector('.btn-signup-submit');
      if (submitBtn) {
        submitBtn.parentNode.insertBefore(errorEl, submitBtn);
      }
    }

    errorEl.textContent = message;
    errorEl.style.display = 'block';

    // Animation shake
    modalContainer.style.animation = 'none';
    modalContainer.offsetHeight; // Trigger reflow
    modalContainer.style.animation = 'shake 0.5s ease';

    // Masquer l'erreur après 5 secondes
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  }

  // ==========================================================================
  // HIDE ERROR - Masquer le message d'erreur
  // ==========================================================================
  function hideError() {
    const errorEl = modal.querySelector('.signup-error');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  // ==========================================================================
  // GET DASHBOARD URL - URL du dashboard selon l'environnement
  // ==========================================================================
  function getDashboardUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5173';
    }
    return 'https://app.serverflow.io';
  }

  // ==========================================================================
  // FORM SUBMIT - Gestion de la soumission
  // ==========================================================================
  function initFormSubmit() {
    const submitBtn = modal.querySelector('.btn-signup-submit');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      hideError();

      const nameInput = modal.querySelector('#signup-name');
      const emailInput = modal.querySelector('#signup-email');
      const passwordInput = modal.querySelector('#signup-password');
      const termsCheckbox = modal.querySelector('#signup-terms');

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const termsAccepted = termsCheckbox.checked;

      // Validations
      if (!name) {
        showError(window.signupTranslations?.nameRequired || 'Please enter your name');
        nameInput.focus();
        return;
      }

      if (!email) {
        showError(window.signupTranslations?.emailRequired || 'Please enter your email');
        emailInput.focus();
        return;
      }

      if (!email.includes('@')) {
        showError(window.signupTranslations?.invalidEmail || 'Please enter a valid email');
        emailInput.focus();
        return;
      }

      if (!password) {
        showError(window.signupTranslations?.passwordRequired || 'Please enter a password');
        passwordInput.focus();
        return;
      }

      if (password.length < 8) {
        showError(
          window.signupTranslations?.passwordTooShort || 'Password must be at least 8 characters',
        );
        passwordInput.focus();
        return;
      }

      if (!termsAccepted) {
        showError(window.signupTranslations?.termsRequired || 'Please accept the terms of service');
        const termsGroup = modal.querySelector('.terms-group');
        if (termsGroup) termsGroup.classList.add('error');
        setTimeout(() => termsGroup?.classList.remove('error'), 500);
        return;
      }

      // Afficher le loader
      submitBtn.classList.add('loading');

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name,
            email,
            password,
            plan: selectedPlan || 'free',
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Succès - rediriger vers le dashboard
          window.location.href = getDashboardUrl();
        } else {
          submitBtn.classList.remove('loading');
          if (data.error === 'Email already exists') {
            showError(window.signupTranslations?.emailExists || 'This email is already registered');
          } else {
            showError(
              window.signupTranslations?.serverError || 'Registration failed. Please try again.',
            );
          }
        }
      } catch (error) {
        console.error('[Signup] Error:', error);
        submitBtn.classList.remove('loading');
        showError(
          window.signupTranslations?.serverError || 'Unable to reach server. Please try again.',
        );
      }
    });
  }

  // ==========================================================================
  // SOCIAL SIGNUP - GitHub OAuth
  // ==========================================================================
  function initSocialSignup() {
    const githubBtn = modal.querySelector('.btn-github');
    if (githubBtn) {
      githubBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Stocker le plan dans le localStorage pour le récupérer après OAuth
        if (selectedPlan) {
          localStorage.setItem('signupPlan', selectedPlan);
        }
        window.location.href = '/api/auth/github';
      });
    }

    const googleBtn = modal.querySelector('.btn-google');
    if (googleBtn) {
      googleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showError(window.signupTranslations?.googleNotAvailable || 'Google signup coming soon');
      });
    }
  }

  // ==========================================================================
  // SWITCH TO LOGIN MODAL
  // ==========================================================================
  function initLoginSwitch() {
    const loginLink = modal.querySelector('.login-link');
    if (loginLink) {
      loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        closeSignupModal();
        // Ouvrir la modal de login si elle existe
        if (window.LoginModal && typeof window.LoginModal.open === 'function') {
          setTimeout(() => window.LoginModal.open(), 300);
        }
      });
    }
  }

  // ==========================================================================
  // INIT - Initialiser la modal
  // ==========================================================================
  function initSignupModal() {
    modal = document.getElementById('signup-modal');
    if (!modal) return;

    modalContainer = modal.querySelector('.modal-container');

    // Bouton fermer
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeSignupModal);
    }

    // Clic sur l'overlay (en dehors de la modal)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeSignupModal();
      }
    });

    // Touche Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeSignupModal();
      }
    });

    // Initialiser les fonctionnalités
    initPasswordToggle();
    initPasswordStrength();
    initFormSubmit();
    initSocialSignup();
    initLoginSwitch();
  }

  // ==========================================================================
  // EXPOSED API - Pour pouvoir ouvrir/fermer depuis l'extérieur
  // ==========================================================================
  window.SignupModal = {
    open: openSignupModal,
    close: closeSignupModal,
  };

  // ==========================================================================
  // DOM READY
  // ==========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSignupModal);
  } else {
    initSignupModal();
  }
})();
