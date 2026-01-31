/**
 * @file apps/sales-website/src/js/pricing.js
 * @description Script pour charger dynamiquement les plans de pricing depuis l'API.
 * Ce fichier récupère les formules et options depuis le control-plane
 * et met à jour la page pricing en temps réel.
 *
 * @dependencies
 * - API Control Plane : /api/pricing/plans
 *
 * @fonctions_principales
 * - loadPricingPlans() : Charge les plans depuis l'API
 * - renderPricingCards() : Affiche les cartes de pricing
 * - updatePrices() : Met à jour les prix selon le toggle mensuel/annuel
 */

(function () {
  'use strict';

  // URL de l'API - utilise le proxy local pour éviter les problèmes CORS
  // Le proxy redirige vers l'API configurée dans .env (API_URL)
  const API_BASE_URL = '';

  // Cache des plans chargés
  let loadedPlans = null;
  let currentBilling = 'monthly';

  /**
   * Charge les plans de pricing depuis l'API
   */
  async function loadPricingPlans() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/pricing/plans`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      loadedPlans = data.plans;

      // Mettre à jour l'affichage
      renderPricingCards(loadedPlans);

      return loadedPlans;
    } catch (error) {
      console.error('[Pricing] Erreur lors du chargement des plans:', error);
      // En cas d'erreur, on garde les valeurs statiques du HTML
      return null;
    }
  }

  /**
   * Formate un prix en centimes vers un affichage lisible
   */
  function formatPrice(cents) {
    if (cents === 0) return '0';
    return (cents / 100).toFixed(0);
  }

  /**
   * Met à jour les cartes de pricing avec les données de l'API
   */
  function renderPricingCards(plans) {
    if (!plans || plans.length === 0) return;

    plans.forEach(plan => {
      // Trouver la carte correspondante
      const card = document.querySelector(`.pricing-card-enhanced[data-plan="${plan.name}"]`);
      if (!card) {
        // Essayer de trouver par le nom du plan dans le titre
        const allCards = document.querySelectorAll('.pricing-card-enhanced');
        allCards.forEach(c => {
          const title = c.querySelector('.pricing-plan-name');
          if (title && title.textContent.toLowerCase().includes(plan.name.toLowerCase())) {
            updateCardWithPlan(c, plan);
          }
        });
        return;
      }

      updateCardWithPlan(card, plan);
    });
  }

  /**
   * Traduit une clé de feature en utilisant les traductions injectées
   * @param {string} key - Clé de la feature (ex: "ssl_auto", "mcp_integration")
   * @returns {string} - Texte traduit ou la clé si non trouvée
   */
  function translateFeature(key) {
    // Utiliser les traductions injectées dans la page
    if (window.featureTranslations && window.featureTranslations[key]) {
      return window.featureTranslations[key];
    }
    // Fallback: retourner la clé formatée
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Met à jour la liste des features dans une carte
   * @param {HTMLElement} card - La carte de pricing
   * @param {Array} features - Liste des clés de features depuis l'API
   * @param {Object} limits - Limites du plan (servers, apps, etc.)
   * @param {boolean} isPro - Si c'est le plan Pro (pour le style)
   */
  function updateFeaturesList(card, features, limits, isPro) {
    const featuresList = card.querySelector('.pricing-features-enhanced');
    if (!featuresList || !features || features.length === 0) return;

    // Construire la liste des features à afficher
    const allFeatures = [];

    // Ajouter les limites comme features
    if (limits) {
      if (limits.servers === 1) {
        allFeatures.push('servers_1');
      } else if (limits.servers === 5) {
        allFeatures.push('servers_5');
      } else if (limits.servers === -1) {
        allFeatures.push('servers_unlimited');
      }

      if (limits.apps === 3) {
        allFeatures.push('apps_3');
      } else if (limits.apps === -1) {
        allFeatures.push('apps_unlimited');
      }
    }

    // Ajouter les features de l'API
    features.forEach(feature => {
      if (!allFeatures.includes(feature)) {
        allFeatures.push(feature);
      }
    });

    // Générer le HTML des features
    const html = allFeatures.map(featureKey => {
      const text = translateFeature(featureKey);
      const highlightClass = isPro ? 'feature-highlight' : '';
      return `<li>
        <span class="feature-check">✓</span>
        <span class="${highlightClass}">${text}</span>
      </li>`;
    }).join('');

    featuresList.innerHTML = html;
  }

  /**
   * Met à jour une carte spécifique avec les données du plan
   */
  function updateCardWithPlan(card, plan) {
    // Stocker les données du plan sur la carte
    card.dataset.plan = plan.name;
    card.dataset.priceMonthly = plan.priceMonthly;
    card.dataset.priceYearly = plan.priceYearly;
    card.dataset.priceMonthlyFromYearly = plan.priceMonthlyFromYearly;

    // Mettre à jour le prix affiché
    const priceAmount = card.querySelector('.price-amount');
    if (priceAmount) {
      priceAmount.dataset.monthly = formatPrice(plan.priceMonthly);
      priceAmount.dataset.annually = formatPrice(plan.priceMonthlyFromYearly);
      priceAmount.textContent = formatPrice(currentBilling === 'monthly' ? plan.priceMonthly : plan.priceMonthlyFromYearly);
    }

    // Mettre à jour la liste des features
    const isPro = plan.name === 'pro' || plan.isPopular;
    updateFeaturesList(card, plan.features, plan.limits, isPro);

    // Mettre à jour les limites dans le tableau de comparaison
    updateComparisonTable(plan);
  }

  /**
   * Met à jour le tableau de comparaison des fonctionnalités
   */
  function updateComparisonTable(plan) {
    const table = document.querySelector('.features-table');
    if (!table) return;

    // Trouver la colonne du plan
    const headers = table.querySelectorAll('thead th');
    let columnIndex = -1;

    headers.forEach((th, index) => {
      if (th.textContent.toLowerCase().includes(plan.displayName?.toLowerCase() || plan.name)) {
        columnIndex = index;
      }
    });

    if (columnIndex === -1) return;

    // Mettre à jour les valeurs
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length <= columnIndex) return;

      const cell = cells[columnIndex];
      const firstCell = cells[0];

      // Identifier le type de limite par le texte de la première cellule
      const label = firstCell?.textContent?.toLowerCase() || '';

      if (label.includes('serveur')) {
        cell.textContent = plan.limits.servers === -1 ? '∞' : plan.limits.servers;
      } else if (label.includes('application')) {
        cell.textContent = plan.limits.apps === -1 ? '∞' : plan.limits.apps;
      }
    });
  }

  /**
   * Met à jour les prix affichés selon le mode de facturation
   */
  function updatePricesDisplay(billing) {
    currentBilling = billing;

    const priceAmounts = document.querySelectorAll('.price-amount');
    priceAmounts.forEach(amount => {
      const price = amount.dataset[billing];
      if (price !== undefined) {
        amount.textContent = price;
      }
    });

    // Afficher/masquer le badge d'économies
    const savingsBadge = document.getElementById('savings-badge');
    if (savingsBadge) {
      savingsBadge.style.display = billing === 'annually' ? 'inline-flex' : 'none';
    }

    // Afficher/masquer les anciens prix
    const priceOld = document.getElementById('price-old-pro');
    if (priceOld) {
      priceOld.style.display = billing === 'annually' ? 'block' : 'none';
    }
  }

  /**
   * Initialise les événements du toggle de facturation
   */
  function initBillingToggle() {
    const billingOptions = document.querySelectorAll('.billing-option');

    billingOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Mettre à jour l'état actif
        billingOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');

        // Mettre à jour les prix
        const billing = option.dataset.billing;
        updatePricesDisplay(billing);
      });
    });
  }

  /**
   * Initialisation au chargement de la page
   */
  function init() {
    // Vérifier qu'on est sur la page pricing
    if (!document.querySelector('.pricing-section')) return;

    // Initialiser le toggle
    initBillingToggle();

    // Charger les plans depuis l'API
    loadPricingPlans();
  }

  // Exécuter à la fin du chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposer les fonctions pour un usage externe si nécessaire
  window.ServerFlowPricing = {
    loadPlans: loadPricingPlans,
    updatePrices: updatePricesDisplay
  };
})();
