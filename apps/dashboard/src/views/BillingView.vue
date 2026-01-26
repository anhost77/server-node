<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useBilling } from '@/composables'

const { t } = useI18n()

const {
  billingPlans,
  currentSubscription,
  usageReport,
  loadBillingPlans,
  loadSubscription,
  loadUsageReport,
  upgradePlan,
  openBillingPortal,
  formatCurrency
} = useBilling()

function scrollToPlans() {
  document.querySelector('.plans-section')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div class="billing-view">
    <!-- Header -->
    <h1 class="gradient-text">{{ t('billing.title') }}</h1>
    <p class="view-subtitle">{{ t('billing.subtitle') }}</p>

    <!-- Current Plan Card -->
    <div class="glass-card current-plan-card">
      <div class="plan-info">
        <div class="plan-icon" :class="currentSubscription?.isPaid ? 'paid' : 'free'">
          {{ currentSubscription?.isPaid ? '⭐' : '🆓' }}
        </div>
        <div>
          <h3>{{ currentSubscription?.planDisplayName || t('billing.freePlan') }}</h3>
          <span :class="['status-badge', currentSubscription?.isPastDue ? 'error' : currentSubscription?.isActive ? 'active' : 'inactive']">
            {{ currentSubscription?.isPastDue ? '⚠️ ' + t('billing.paymentRequired') : (currentSubscription?.isActive ? '✓ ' + t('billing.active') : t('billing.inactive')) }}
          </span>
        </div>
      </div>
      <button v-if="currentSubscription?.isPaid" class="secondary" @click="openBillingPortal">
        💳 {{ t('billing.manageBilling') }}
      </button>
    </div>

    <!-- Usage Section -->
    <div v-if="usageReport" class="glass-card usage-card">
      <div class="usage-header">
        <h3>📊 {{ t('billing.currentUsage') }}</h3>
        <span v-if="currentSubscription?.periodEnd" class="reset-date">
          {{ t('billing.resets') }} {{ new Date(currentSubscription.periodEnd * 1000).toLocaleDateString() }}
        </span>
      </div>

      <div class="usage-grid">
        <!-- Servers -->
        <div class="usage-item" :class="{ warning: usageReport.usage.servers.percentage >= 80, critical: usageReport.usage.servers.percentage >= 100 }">
          <div class="usage-label"><span>🖥️</span> {{ t('billing.servers') }}</div>
          <div class="usage-values">
            <strong>{{ usageReport.usage.servers.current }}</strong>
            <span>/</span>
            <span>{{ usageReport.usage.servers.limit === -1 ? '∞' : usageReport.usage.servers.limit }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: Math.min(usageReport.usage.servers.percentage, 100) + '%' }"></div>
          </div>
          <p v-if="usageReport.usage.servers.percentage >= 80" class="limit-warning">
            {{ usageReport.usage.servers.percentage >= 100 ? t('billing.limitReached') : t('billing.almostAtLimit') }}
          </p>
        </div>

        <!-- Apps -->
        <div class="usage-item" :class="{ warning: usageReport.usage.apps.percentage >= 80, critical: usageReport.usage.apps.percentage >= 100 }">
          <div class="usage-label"><span>📦</span> {{ t('billing.apps') }}</div>
          <div class="usage-values">
            <strong>{{ usageReport.usage.apps.current }}</strong>
            <span>/</span>
            <span>{{ usageReport.usage.apps.limit === -1 ? '∞' : usageReport.usage.apps.limit }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: Math.min(usageReport.usage.apps.percentage, 100) + '%' }"></div>
          </div>
          <p v-if="usageReport.usage.apps.percentage >= 80" class="limit-warning">
            {{ usageReport.usage.apps.percentage >= 100 ? t('billing.limitReached') : t('billing.almostAtLimit') }}
          </p>
        </div>

        <!-- Domains -->
        <div class="usage-item" :class="{ warning: usageReport.usage.domains.percentage >= 80, critical: usageReport.usage.domains.percentage >= 100 }">
          <div class="usage-label"><span>🌐</span> {{ t('billing.domains') }}</div>
          <div class="usage-values">
            <strong>{{ usageReport.usage.domains.current }}</strong>
            <span>/</span>
            <span>{{ usageReport.usage.domains.limit === -1 ? '∞' : usageReport.usage.domains.limit }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: Math.min(usageReport.usage.domains.percentage, 100) + '%' }"></div>
          </div>
        </div>

        <!-- Deploys -->
        <div class="usage-item" :class="{ warning: usageReport.usage.deploysToday.percentage >= 80, critical: usageReport.usage.deploysToday.percentage >= 100 }">
          <div class="usage-label"><span>🚀</span> {{ t('billing.deploysToday') }}</div>
          <div class="usage-values">
            <strong>{{ usageReport.usage.deploysToday.current }}</strong>
            <span>/</span>
            <span>{{ usageReport.usage.deploysToday.limit === -1 ? '∞' : usageReport.usage.deploysToday.limit }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: Math.min(usageReport.usage.deploysToday.percentage, 100) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upgrade Suggestion -->
    <div v-if="usageReport && (usageReport.usage.servers.percentage >= 80 || usageReport.usage.apps.percentage >= 80)" class="upgrade-banner">
      <div class="banner-icon">💡</div>
      <div class="banner-content">
        <h4>{{ t('billing.needMoreResources') }}</h4>
        <p>{{ t('billing.approachingLimits') }}</p>
      </div>
      <button class="premium-btn" @click="scrollToPlans">{{ t('billing.viewPlans') }} ↓</button>
    </div>

    <!-- Plans Section -->
    <div class="plans-section">
      <div class="plans-header">
        <h2>{{ t('billing.choosePlan') }}</h2>
        <p>{{ t('billing.allPlansInclude') }}</p>
      </div>

      <div class="plans-grid">
        <div
          v-for="(plan, index) in billingPlans"
          :key="plan.id"
          class="plan-card glass-card"
          :class="{ current: currentSubscription?.planName === plan.name, popular: index === 1 }"
        >
          <!-- Badge -->
          <div v-if="currentSubscription?.planName === plan.name" class="plan-badge current-badge">
            ✓ {{ t('billing.currentPlanBadge') }}
          </div>
          <div v-else-if="index === 1" class="plan-badge popular-badge">
            ⭐ {{ t('billing.mostPopular') }}
          </div>

          <div class="plan-header">
            <h4>{{ plan.displayName }}</h4>
            <p>{{ plan.description }}</p>
          </div>

          <div class="plan-price">
            <span class="currency">$</span>
            <span class="amount">{{ Math.floor(plan.priceMonthly / 100) }}</span>
            <span v-if="plan.priceMonthly % 100" class="cents">.{{ String(plan.priceMonthly % 100).padStart(2, '0') }}</span>
            <span class="period">/{{ t('billing.perMonth') }}</span>
          </div>

          <div v-if="plan.priceYearly && plan.priceYearly < plan.priceMonthly * 12" class="yearly-price">
            <span>{{ formatCurrency(plan.priceYearly) }}/{{ t('billing.perYear') }}</span>
            <span class="save-badge">{{ t('billing.save') }} {{ Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100) }}%</span>
          </div>

          <ul class="plan-features">
            <li><span>🖥️</span> {{ plan.limits.servers === -1 ? t('billing.unlimited') : plan.limits.servers }} {{ t('billing.servers').toLowerCase() }}</li>
            <li><span>📦</span> {{ plan.limits.apps === -1 ? t('billing.unlimited') : plan.limits.apps }} {{ t('billing.apps').toLowerCase() }}</li>
            <li><span>🌐</span> {{ plan.limits.domains === -1 ? t('billing.unlimited') : plan.limits.domains }} {{ t('billing.customDomains') }}</li>
            <li><span>🚀</span> {{ plan.limits.deploysPerDay === -1 ? t('billing.unlimited') : plan.limits.deploysPerDay }} {{ t('billing.deploysPerDay') }}</li>
            <li><span>🔒</span> Free SSL certificates</li>
            <li v-if="plan.priceMonthly > 0"><span>💬</span> Priority support</li>
          </ul>

          <button
            :class="['plan-cta', { disabled: currentSubscription?.planName === plan.name, premium: plan.priceMonthly > 0 }]"
            :disabled="currentSubscription?.planName === plan.name"
            @click="upgradePlan(plan.id)"
          >
            <template v-if="currentSubscription?.planName === plan.name">✓ Your Current Plan</template>
            <template v-else-if="plan.priceMonthly === 0">Switch to Free</template>
            <template v-else>Upgrade Now →</template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.billing-view {
  padding: 0;
}

.view-subtitle {
  color: #64748b;
  margin: 0.5rem 0 2rem;
  font-size: 0.95rem;
}

/* Current Plan Card */
.current-plan-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.plan-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.plan-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.plan-icon.paid { background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.2)); }
.plan-icon.free { background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2)); }

.plan-info h3 {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  color: #0f172a;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.active { background: rgba(16, 185, 129, 0.15); color: #059669; }
.status-badge.error { background: rgba(239, 68, 68, 0.15); color: #dc2626; }
.status-badge.inactive { background: #f1f5f9; color: #64748b; }

/* Usage Card */
.usage-card {
  margin-bottom: 1.5rem;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.usage-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #0f172a;
}

.reset-date {
  color: #64748b;
  font-size: 0.875rem;
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.usage-item {
  padding: 1rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.usage-item.warning { background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); }
.usage-item.critical { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); }

.usage-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #64748b;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.usage-label span { font-size: 1rem; }

.usage-values {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #0f172a;
}

.usage-values strong { font-weight: 700; }
.usage-values span { color: #94a3b8; }

.progress-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6, #6366f1);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.usage-item.warning .progress-fill { background: linear-gradient(90deg, #f59e0b, #d97706); }
.usage-item.critical .progress-fill { background: linear-gradient(90deg, #ef4444, #dc2626); }

.limit-warning {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
}

.usage-item.warning .limit-warning { color: #d97706; }
.usage-item.critical .limit-warning { color: #dc2626; }

/* Upgrade Banner */
.upgrade-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1));
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 16px;
  margin-bottom: 2rem;
}

.banner-icon { font-size: 2rem; }

.banner-content { flex: 1; }
.banner-content h4 { margin: 0 0 0.25rem; color: #0f172a; font-size: 1rem; }
.banner-content p { margin: 0; color: #64748b; font-size: 0.875rem; }

/* Plans Section */
.plans-section {
  margin-top: 2rem;
}

.plans-header {
  text-align: center;
  margin-bottom: 2rem;
}

.plans-header h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  color: #0f172a;
}

.plans-header p {
  margin: 0;
  color: #64748b;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.plan-card {
  position: relative;
  padding: 1.5rem;
  text-align: center;
}

.plan-card.current { border-color: rgba(139, 92, 246, 0.5); box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1); }
.plan-card.popular { border-color: rgba(139, 92, 246, 0.3); }

.plan-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
}

.current-badge { background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; }
.popular-badge { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }

.plan-header {
  margin-bottom: 1.5rem;
  padding-top: 0.5rem;
}

.plan-header h4 {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  color: #0f172a;
}

.plan-header p {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
}

.plan-price {
  margin-bottom: 0.5rem;
}

.plan-price .currency { font-size: 1.5rem; color: #64748b; vertical-align: top; }
.plan-price .amount { font-size: 3rem; font-weight: 800; color: #0f172a; }
.plan-price .cents { font-size: 1.5rem; color: #0f172a; }
.plan-price .period { font-size: 0.875rem; color: #64748b; }

.yearly-price {
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

.save-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
  text-align: left;
}

.plan-features li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: #475569;
}

.plan-features li span { font-size: 1rem; }

.plan-cta {
  width: 100%;
  padding: 0.875rem;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.plan-cta.premium {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: white;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.plan-cta.premium:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
}

.plan-cta:not(.premium) {
  background: #f1f5f9;
  color: #475569;
}

.plan-cta:not(.premium):hover {
  background: #e2e8f0;
}

.plan-cta.disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 1024px) {
  .usage-grid { grid-template-columns: repeat(2, 1fr); }
  .plans-grid { grid-template-columns: 1fr; max-width: 400px; margin: 0 auto; }
}

@media (max-width: 768px) {
  .current-plan-card { flex-direction: column; align-items: flex-start; }
  .upgrade-banner { flex-direction: column; text-align: center; }
}

@media (max-width: 600px) {
  .usage-grid { grid-template-columns: 1fr; }
}
</style>
