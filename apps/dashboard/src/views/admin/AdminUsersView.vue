<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdmin } from '@/composables'
import BaseModal from '@/components/ui/BaseModal.vue'

const { t } = useI18n()
const {
  adminUsers,
  adminPlans,
  selectedUserDetails,
  showAssignPlanModal,
  assignPlanUserId,
  assignPlanUserEmail,
  selectedPlanId,
  loadAdminUsers,
  loadAdminPlans,
  updateUserRole,
  impersonateUser,
  assignUserPlan,
  confirmAssignPlan,
  viewUserDetails
} = useAdmin()

function formatDate(timestamp: number | string | null): string {
  if (!timestamp) return '-'
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000)
  return date.toLocaleDateString()
}
</script>

<template>
  <div class="admin-users-view">
    <!-- Header -->
    <div class="view-header">
      <h1 class="gradient-text">{{ t('admin.users.title') }}</h1>
      <p class="view-subtitle">{{ adminUsers.length }} users registered</p>
    </div>

    <!-- Users Table -->
    <div class="glass-card table-card">
      <div class="table-wrapper">
        <table class="users-table">
          <thead>
            <tr>
              <th>{{ t('admin.users.email') }}</th>
              <th>{{ t('admin.users.name') }}</th>
              <th>{{ t('admin.users.role') }}</th>
              <th>{{ t('admin.users.plan') }}</th>
              <th>{{ t('admin.users.onboarding') }}</th>
              <th>{{ t('admin.users.createdAt') }}</th>
              <th>{{ t('admin.users.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in adminUsers" :key="u.id">
              <td class="email-cell">{{ u.email }}</td>
              <td class="name-cell">{{ u.name || '-' }}</td>
              <td>
                <select
                  :value="u.role"
                  class="role-select"
                  @change="updateUserRole(u.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="user">{{ t('admin.users.user') }}</option>
                  <option value="admin">{{ t('admin.users.adminRole') }}</option>
                </select>
              </td>
              <td>
                <span class="plan-badge">{{ u.plan }}</span>
              </td>
              <td>
                <span :class="['status-badge', u.onboardingCompleted ? 'complete' : 'pending']">
                  {{ u.onboardingCompleted ? t('admin.users.complete') : t('admin.users.pending') }}
                </span>
              </td>
              <td class="date-cell">{{ formatDate(u.createdAt) }}</td>
              <td>
                <div class="actions-cell">
                  <button
                    class="action-btn"
                    :title="t('admin.users.viewDetails')"
                    @click="viewUserDetails(u)"
                  >
                    📋
                  </button>
                  <button
                    class="action-btn"
                    :title="t('admin.users.impersonate')"
                    @click="impersonateUser(u.id)"
                  >
                    👤
                  </button>
                  <button
                    class="action-btn"
                    :title="t('admin.users.assignPlan')"
                    @click="assignUserPlan(u.id, u.email)"
                  >
                    💳
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- User Details Modal -->
    <BaseModal
      :show="!!selectedUserDetails"
      :title="t('userDetails.title')"
      size="lg"
      @close="selectedUserDetails = null"
    >
      <div v-if="selectedUserDetails" class="details-grid">
        <!-- Account Info -->
        <div class="details-section">
          <h4 class="section-label">{{ t('userDetails.accountInfo') }}</h4>
          <div class="details-list">
            <div class="detail-item">
              <label>{{ t('userDetails.id') }}</label>
              <p class="mono">{{ selectedUserDetails.id }}</p>
            </div>
            <div class="detail-item">
              <label>{{ t('userDetails.email') }}</label>
              <p>{{ selectedUserDetails.email }}</p>
            </div>
            <div class="detail-item">
              <label>{{ t('userDetails.name') }}</label>
              <p>{{ selectedUserDetails.name || '-' }}</p>
            </div>
            <div class="detail-item">
              <label>{{ t('userDetails.role') }}</label>
              <p>
                <span :class="['role-tag', selectedUserDetails.role === 'admin' ? 'admin' : 'user']">
                  {{ selectedUserDetails.role }}
                </span>
              </p>
            </div>
            <div class="detail-item">
              <label>{{ t('userDetails.createdAt') }}</label>
              <p>{{ formatDate(selectedUserDetails.createdAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Billing Info -->
        <div class="details-section">
          <h4 class="section-label">{{ t('userDetails.billingInfo') }}</h4>
          <div class="details-list">
            <div class="detail-item">
              <label>{{ t('userDetails.billingName') }}</label>
              <p>{{ selectedUserDetails.billingName || '-' }}</p>
            </div>
            <div class="detail-item">
              <label>{{ t('userDetails.billingEmail') }}</label>
              <p>{{ selectedUserDetails.billingEmail || '-' }}</p>
            </div>
            <div class="detail-item">
              <label>{{ t('userDetails.company') }}</label>
              <p>{{ selectedUserDetails.billingCompany || '-' }}</p>
            </div>
            <div class="detail-item">
              <label>{{ t('userDetails.address') }}</label>
              <p>{{ selectedUserDetails.billingAddress || '-' }}</p>
            </div>
            <div class="detail-item">
              <label>{{ t('userDetails.stripe') }}</label>
              <p class="mono">{{ selectedUserDetails.stripeCustomerId || '-' }}</p>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="selectedUserDetails = null">
          {{ t('common.close') }}
        </button>
      </template>
    </BaseModal>

    <!-- Assign Plan Modal -->
    <BaseModal
      :show="showAssignPlanModal"
      :title="t('admin.users.assignPlan')"
      size="sm"
      @close="showAssignPlanModal = false"
    >
      <p class="modal-user-email">{{ assignPlanUserEmail }}</p>

      <div class="form-group">
        <label>{{ t('admin.users.plan') }}</label>
        <select v-model="selectedPlanId" class="form-select">
          <option value="" disabled>Select a plan...</option>
          <option v-for="plan in adminPlans" :key="plan.id" :value="plan.id">
            {{ plan.displayName || plan.name }} - {{ plan.priceMonthly / 100 }}€/{{ t('billing.perMonth') }}
          </option>
        </select>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="showAssignPlanModal = false">
          {{ t('common.cancel') }}
        </button>
        <button class="btn-primary" :disabled="!selectedPlanId" @click="confirmAssignPlan">
          {{ t('common.confirm') }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.admin-users-view {
  padding: 24px;
}

.view-header {
  margin-bottom: 32px;
}

.view-header h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0;
}

.view-subtitle {
  color: #64748b;
  margin-top: 4px;
  font-size: 0.9375rem;
}

/* Table */
.table-card {
  padding: 0;
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
}

.users-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 0.875rem;
}

.users-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

.email-cell {
  color: #0f172a;
  font-weight: 500;
}

.name-cell {
  color: #64748b;
}

.date-cell {
  color: #64748b;
}

/* Role Select */
.role-select {
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: #0f172a;
  font-size: 0.875rem;
  cursor: pointer;
}

.role-select:focus {
  outline: none;
  border-color: #8b5cf6;
}

/* Badges */
.plan-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 20px;
  background: rgba(139, 92, 246, 0.1);
  color: #7c3aed;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.complete {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.status-badge.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

/* Actions */
.actions-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  transition: background 0.2s ease;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

/* Modal Details */
.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
}

.details-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.details-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item label {
  display: block;
  font-size: 0.6875rem;
  color: #94a3b8;
  margin-bottom: 2px;
}

.detail-item p {
  margin: 0;
  color: #0f172a;
  font-size: 0.9375rem;
}

.detail-item p.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
}

.role-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.role-tag.admin {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.role-tag.user {
  background: rgba(0, 0, 0, 0.05);
  color: #64748b;
}

/* Modal Form */
.modal-user-email {
  color: #64748b;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
  margin-bottom: 8px;
}

.form-select {
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: #0f172a;
  font-size: 0.9375rem;
  cursor: pointer;
}

.form-select:focus {
  outline: none;
  border-color: #8b5cf6;
}

/* Buttons */
.btn-secondary {
  padding: 10px 18px;
  border-radius: 12px;
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
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
