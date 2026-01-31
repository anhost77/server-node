/**
 * @file apps/sales-website/src/js/login-modal.js
 * @description Logique JavaScript pour la modal de connexion.
 * Gère l'ouverture, la fermeture, les animations et les interactions.
 *
 * @fonctions_principales
 * - openLoginModal() : Ouvre la modal avec animation
 * - closeLoginModal() : Ferme la modal avec animation
 * - goToPanel() : Navigation entre les panels (login/forgot)
 * - initLoginModal() : Initialise tous les événements
 */

(function () {
  'use strict';

  // ==========================================================================
  // VARIABLES
  // ==========================================================================
  let modal = null;
  let modalContainer = null;
  let isOpen = false;
  let currentPanel = 'login';

  // ==========================================================================
  // OPEN MODAL
  // ==========================================================================
  function openLoginModal() {
    if (!modal || isOpen) return;

    isOpen = true;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    // Reset to login panel
    goToPanel('login', false);

    // Empêcher le scroll du body
    document.body.style.overflow = 'hidden';

    // Focus sur le premier input après l'animation
    setTimeout(() => {
      const emailInput = modal.querySelector('#login-email');
      if (emailInput) emailInput.focus();

      // Activer l'animation flottante après l'ouverture
      modal.classList.add('floating');
    }, 400);

    // Trap focus dans la modal
    trapFocus(modal);
  }

  // ==========================================================================
  // CLOSE MODAL
  // ==========================================================================
  function closeLoginModal() {
    if (!modal || !isOpen) return;

    isOpen = false;
    modal.classList.remove('active', 'floating');
    modal.setAttribute('aria-hidden', 'true');

    // Restaurer le scroll du body
    document.body.style.overflow = '';

    // Reset success states
    const forgotSuccess = modal.querySelector('.forgot-success');
    const forgotForm = modal.querySelector('.panel-forgot .input-group');
    const forgotBtn = modal.querySelector('.btn-forgot-submit');
    if (forgotSuccess) forgotSuccess.style.display = 'none';
    if (forgotForm) forgotForm.style.display = 'block';
    if (forgotBtn) forgotBtn.style.display = 'block';

    // Remettre le focus sur le bouton qui a ouvert la modal
    const loginBtn = document.querySelector('[data-open-login]');
    if (loginBtn) loginBtn.focus();
  }

  // ==========================================================================
  // GO TO PANEL - Navigation entre login et forgot
  // ==========================================================================
  function goToPanel(panelName, animate = true) {
    const panels = modal.querySelectorAll('.modal-panel');
    const targetPanel = modal.querySelector(`[data-panel="${panelName}"]`);

    if (!targetPanel || currentPanel === panelName) return;

    const isGoingForward = panelName === 'forgot';

    panels.forEach((panel) => {
      // Nettoyer les classes d'animation
      panel.classList.remove('exiting-left', 'exiting-right');

      if (panel.dataset.panel === panelName) {
        // Panel cible - activer
        panel.classList.add('active');
      } else if (panel.classList.contains('active')) {
        // Panel actuel - désactiver
        panel.classList.remove('active');
      }
    });

    currentPanel = panelName;

    // Focus sur le premier input du nouveau panel
    if (animate) {
      setTimeout(() => {
        const firstInput = targetPanel.querySelector('input');
        if (firstInput) firstInput.focus();
      }, 350);
    }
  }

  // ==========================================================================
  // TRAP FOCUS - Garder le focus dans la modal
  // ==========================================================================
  function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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

    const passwordInput = modal.querySelector('#login-password');
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
  // SHOW ERROR - Afficher un message d'erreur
  // ==========================================================================
  function showError(message) {
    let errorEl = modal.querySelector('.login-error');

    if (!errorEl) {
      // Créer l'élément d'erreur s'il n'existe pas
      errorEl = document.createElement('div');
      errorEl.className = 'login-error';
      const submitBtn = modal.querySelector('.panel-login .btn-login-submit');
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
    const errorEl = modal.querySelector('.login-error');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  // ==========================================================================
  // GET DASHBOARD URL - URL du dashboard selon l'environnement
  // ==========================================================================
  function getDashboardUrl() {
    // En dev (localhost), utiliser le dashboard local
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5173';
    }
    // En production
    return 'https://app.serverflow.io';
  }

  // ==========================================================================
  // FORM SUBMIT - Gestion de la soumission login
  // ==========================================================================
  function initFormSubmit() {
    const submitBtn = modal.querySelector('.panel-login .btn-login-submit');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      hideError();

      const emailInput = modal.querySelector('#login-email');
      const passwordInput = modal.querySelector('#login-password');
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        // Shake animation si champs vides
        showError(window.loginTranslations?.emptyFields || 'Please fill in all fields');
        return;
      }

      // Validation basique de l'email
      if (!email.includes('@')) {
        showError(window.loginTranslations?.invalidEmail || 'Please enter a valid email');
        return;
      }

      // Afficher le loader
      submitBtn.classList.add('loading');

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Important pour les cookies
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Succès - rediriger vers le dashboard
          window.location.href = getDashboardUrl();
        } else {
          // Erreur d'authentification
          submitBtn.classList.remove('loading');
          showError(window.loginTranslations?.invalidCredentials || 'Invalid email or password');
        }
      } catch (error) {
        console.error('[Login] Error:', error);
        submitBtn.classList.remove('loading');
        showError(window.loginTranslations?.serverError || 'Unable to reach server. Please try again.');
      }
    });
  }

  // ==========================================================================
  // FORGOT PASSWORD SUBMIT
  // ==========================================================================
  function initForgotSubmit() {
    const submitBtn = modal.querySelector('.btn-forgot-submit');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const email = modal.querySelector('#forgot-email').value.trim();

      if (!email) {
        modalContainer.style.animation = 'none';
        modalContainer.offsetHeight;
        modalContainer.style.animation = 'shake 0.5s ease';
        return;
      }

      // Validation basique de l'email
      if (!email.includes('@')) {
        modalContainer.style.animation = 'none';
        modalContainer.offsetHeight;
        modalContainer.style.animation = 'shake 0.5s ease';
        return;
      }

      // Afficher le loader
      submitBtn.classList.add('loading');

      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        // Toujours afficher succès (pour ne pas révéler si l'email existe)
        submitBtn.classList.remove('loading');

        // Cacher le formulaire et afficher le message de succès
        const inputGroup = modal.querySelector('.panel-forgot .input-group');
        const successMsg = modal.querySelector('.forgot-success');

        if (inputGroup) inputGroup.style.display = 'none';
        submitBtn.style.display = 'none';
        if (successMsg) successMsg.style.display = 'block';
      } catch (error) {
        console.error('[ForgotPassword] Error:', error);
        submitBtn.classList.remove('loading');
        // Afficher succès quand même (UX sécurisé)
        const inputGroup = modal.querySelector('.panel-forgot .input-group');
        const successMsg = modal.querySelector('.forgot-success');

        if (inputGroup) inputGroup.style.display = 'none';
        submitBtn.style.display = 'none';
        if (successMsg) successMsg.style.display = 'block';
      }
    });
  }

  // ==========================================================================
  // PANEL NAVIGATION
  // ==========================================================================
  function initPanelNavigation() {
    // Boutons pour naviguer entre les panels
    const navButtons = modal.querySelectorAll('[data-goto-panel]');

    navButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPanel = btn.dataset.gotoPanel;
        goToPanel(targetPanel);
      });
    });
  }

  // ==========================================================================
  // INIT - Initialiser la modal
  // ==========================================================================
  function initLoginModal() {
    modal = document.getElementById('login-modal');
    if (!modal) return;

    modalContainer = modal.querySelector('.modal-container');

    // Boutons pour ouvrir la modal
    const openButtons = document.querySelectorAll('[data-open-login]');
    openButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openLoginModal();
      });
    });

    // Bouton fermer
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeLoginModal);
    }

    // Clic sur l'overlay (en dehors de la modal)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeLoginModal();
      }
    });

    // Touche Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeLoginModal();
      }
    });

    // Initialiser les fonctionnalités
    initPasswordToggle();
    initFormSubmit();
    initForgotSubmit();
    initPanelNavigation();
  }

  // ==========================================================================
  // SHAKE ANIMATION (pour erreurs)
  // ==========================================================================
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);

  // ==========================================================================
  // EXPOSED API - Pour pouvoir ouvrir/fermer depuis l'extérieur
  // ==========================================================================
  window.LoginModal = {
    open: openLoginModal,
    close: closeLoginModal,
    goToPanel: goToPanel,
  };

  // ==========================================================================
  // DOM READY
  // ==========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginModal);
  } else {
    initLoginModal();
  }
})();
