<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAdmin, useBilling } from '@/composables'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'

const { t } = useI18n()
const { formatCurrency } = useBilling()
const {
  adminPlans,
  showPlanModal,
  editingPlan,
  planForm,
  loadAdminPlans,
  openPlanModal,
  savePlan,
  deletePlan
} = useAdmin()
</script>

<template>
  <div class="admin-plans-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-content">
        <h1 class="gradient-text">{{ t('admin.plans.title') }}</h1>
        <p class="view-subtitle">{{ adminPlans.length }} plans configured</p>
      </div>
      <button class="btn-primary" @click="openPlanModal()">
        + {{ t('admin.plans.createPlan') }}
      </button>
    </div>

    <!-- Plans Grid -->
    <div class="plans-grid">
      <div v-for="plan in adminPlans" :key="plan.id" class="glass-card plan-card">
        <!-- Header -->
        <div class="plan-header">
          <div class="plan-info">
            <div class="plan-title-row">
              <h4 class="plan-name">{{ plan.displayName }}</h4>
              <span v-if="plan.isDefault" class="default-badge">
                {{ t('admin.plans.isDefault') }}
              </span>
            </div>
            <p class="plan-slug">{{ plan.name }}</p>
          </div>
          <span :class="['status-badge', plan.isActive ? 'active' : 'inactive']">
            {{ plan.isActive ? t('admin.plans.isActive') : 'Inactive' }}
          </span>
        </div>

        <!-- Pricing -->
        <div class="plan-pricing">
          <div class="price-main">{{ formatCurrency(plan.priceMonthly) }}</div>
          <span class="price-period">{{ t('billing.perMonth') }}</span>
          <div class="price-yearly">{{ formatCurrency(plan.priceYearly) }}{{ t('billing.perYear') }}</div>
        </div>

        <!-- Limits -->
        <div class="plan-limits">
          <span class="limit-tag">{{ plan.maxServers }} servers</span>
          <span class="limit-tag">{{ plan.maxApps }} apps</span>
          <span class="limit-tag">{{ plan.maxDomains }} domains</span>
          <span class="limit-tag">{{ plan.maxDeploysPerDay }} deploys/day</span>
        </div>

        <!-- Actions -->
        <div class="plan-actions">
          <button class="btn-secondary flex-1" @click="openPlanModal(plan)">
            {{ t('common.edit') }}
          </button>
          <button
            v-if="!plan.isDefault"
            class="btn-danger"
            @click="deletePlan(plan.id)"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Plan Edit Modal -->
    <BaseModal
      :show="showPlanModal"
      :title="editingPlan ? 'Edit Plan' : 'Create Plan'"
      size="lg"
      @close="showPlanModal = false"
    >
      <div class="form-grid">
        <div class="form-group">
          <label>Name (internal)</label>
          <input
            v-model="planForm.name"
            type="text"
            placeholder="pro"
            :disabled="!!editingPlan"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Display Name</label>
          <input
            v-model="planForm.displayName"
            type="text"
            placeholder="Pro Plan"
            class="form-input"
          />
        </div>
        <div class="form-group full-width">
          <label>Description</label>
          <input
            v-model="planForm.description"
            type="text"
            placeholder="For growing teams..."
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Price Monthly (cents)</label>
          <input
            v-model.number="planForm.priceMonthly"
            type="number"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Price Yearly (cents)</label>
          <input
            v-model.number="planForm.priceYearly"
            type="number"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Max Servers (-1 = unlimited)</label>
          <input
            v-model.number="planForm.maxServers"
            type="number"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Max Apps</label>
          <input
            v-model.number="planForm.maxApps"
            type="number"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Max Domains</label>
          <input
            v-model.number="planForm.maxDomains"
            type="number"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Max Deploys/Day</label>
          <input
            v-model.number="planForm.maxDeploysPerDay"
            type="number"
            class="form-input"
          />
        </div>
        <div class="form-group full-width">
          <label>Stripe Price ID Monthly (optional)</label>
          <input
            v-model="planForm.stripePriceIdMonthly"
            type="text"
            placeholder="price_xxx"
            class="form-input"
          />
        </div>
        <div class="form-group full-width">
          <label>Stripe Price ID Yearly (optional)</label>
          <input
            v-model="planForm.stripePriceIdYearly"
            type="text"
            placeholder="price_xxx"
            class="form-input"
          />
        </div>
        <div class="form-group full-width checkbox-group">
          <label class="checkbox-label">
            <input v-model="planForm.isActive" type="checkbox" class="checkbox-input" />
            <span>Active</span>
          </label>
          <label class="checkbox-label">
            <input v-model="planForm.isDefault" type="checkbox" class="checkbox-input" />
            <span>Default Plan</span>
          </label>
        </div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="showPlanModal = false">
          Cancel
        </button>
        <button class="btn-primary" @click="savePlan">
          {{ editingPlan ? 'Save Changes' : 'Create Plan' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.admin-plans-view {
  padding: 24px;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 32px;
  gap: 16px;
}

.header-content h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0;
}

.view-subtitle {
  color: #64748b;
  margin-top: 4px;
  font-size: 0.9375rem;
}

/* Plans Grid */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

@media (max-width: 1024px) {
  .plans-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }

  .view-header {
    flex-direction: column;
  }
}

/* Plan Card */
.plan-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.plan-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.plan-info {
  flex: 1;
}

.plan-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plan-name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.plan-slug {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.default-badge {
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(139, 92, 246, 0.1);
  color: #7c3aed;
  font-size: 0.6875rem;
  font-weight: 500;
}

.status-badge {
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.status-badge.inactive {
  background: rgba(0, 0, 0, 0.05);
  color: #64748b;
}

/* Pricing */
.plan-pricing {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.price-main {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.price-period {
  color: #64748b;
  font-size: 0.875rem;
}

.price-yearly {
  color: #64748b;
  font-size: 0.8125rem;
}

/* Limits */
.plan-limits {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.limit-tag {
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.04);
  color: #475569;
  font-size: 0.75rem;
}

/* Actions */
.plan-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

/* Form */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.form-group.full-width {
  grid-column: span 2;
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: span 1;
  }
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: #0f172a;
  font-size: 0.9375rem;
  transition: border-color 0.2s ease;
}

.form-input::placeholder {
  color: #94a3b8;
}

.form-input:focus {
  outline: none;
  border-color: #8b5cf6;
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 24px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #475569;
}

.checkbox-input {
  width: 16px;
  height: 16px;
  accent-color: #8b5cf6;
}

/* Buttons */
.btn-primary {
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 500;
  font-size: 0.875rem;
  color: white;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
  white-space: nowrap;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #475569;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-secondary:hover {
  background: rgba(0, 0, 0, 0.08);
}

.btn-secondary.flex-1 {
  flex: 1;
}

.btn-danger {
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.15);
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-danger:hover {
  background: rgba(220, 38, 38, 0.15);
}
</style>
