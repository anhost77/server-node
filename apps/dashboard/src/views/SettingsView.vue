<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApi } from '@/composables'

const { t } = useI18n()
const { baseUrl } = useApi()

interface Props {
  user: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  logout: []
}>()

const downloadingData = ref(false)

function formatDate(timestamp: number | string | null): string {
  if (!timestamp) return '-'
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function downloadMyData() {
  downloadingData.value = true
  try {
    const res = await fetch(`${baseUrl}/api/user/export-data`, { credentials: 'include' })
    if (res.ok) {
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `serverflow-data-${props.user.id}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    }
  } finally {
    downloadingData.value = false
  }
}

async function requestAccountDeletion() {
  const confirmed = confirm(
    t('settings.deleteWarning') + '\n\n' +
    'Type "DELETE" in the next prompt to confirm.'
  )
  if (!confirmed) return

  const confirmation = prompt('Type DELETE to confirm:')
  if (confirmation !== 'DELETE') {
    alert('Account deletion cancelled.')
    return
  }

  try {
    const res = await fetch(`${baseUrl}/api/user/delete-account`, {
      method: 'DELETE',
      credentials: 'include'
    })
    const data = await res.json()
    if (data.success) {
      alert('Your account has been deleted. You will be logged out.')
      emit('logout')
    } else {
      alert(data.error || 'Failed to delete account')
    }
  } catch (e) {
    alert('Failed to delete account')
  }
}
</script>

<template>
  <div class="settings-view">
    <!-- Header -->
    <div class="settings-header">
      <h1 class="gradient-text">{{ t('settings.title') }}</h1>
      <p class="settings-subtitle">{{ t('settings.subtitle') }}</p>
    </div>

    <!-- Billing Information -->
    <section class="settings-section">
      <h2 class="section-title">{{ t('settings.billingInfo') }}</h2>
      <div class="glass-card settings-card">
        <div class="info-grid">
          <div class="info-item">
            <label class="info-label">{{ t('settings.fullName') }}</label>
            <p class="info-value">{{ user.billingName || '-' }}</p>
          </div>
          <div class="info-item">
            <label class="info-label">{{ t('common.email') }}</label>
            <p class="info-value">{{ user.billingEmail || user.email }}</p>
          </div>
          <div class="info-item">
            <label class="info-label">{{ t('settings.company') }}</label>
            <p class="info-value">{{ user.billingCompany || '-' }}</p>
          </div>
          <div class="info-item">
            <label class="info-label">{{ t('settings.phone') }}</label>
            <p class="info-value">{{ user.billingPhone || '-' }}</p>
          </div>
          <div class="info-item full-width">
            <label class="info-label">{{ t('settings.address') }}</label>
            <p class="info-value">
              {{ user.billingAddress ? `${user.billingAddress}, ${user.billingPostalCode} ${user.billingCity}, ${user.billingCountry}` : '-' }}
            </p>
          </div>
          <div class="info-item">
            <label class="info-label">{{ t('settings.vatNumber') }}</label>
            <p class="info-value">{{ user.billingVatNumber || '-' }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Legal Agreements -->
    <section class="settings-section">
      <h2 class="section-title">{{ t('settings.legalAgreements') }}</h2>
      <div class="glass-card settings-card">
        <div class="agreement-list">
          <div class="agreement-item">
            <div class="agreement-icon success">
              <span>✓</span>
            </div>
            <div class="agreement-content">
              <p class="agreement-title">{{ t('settings.termsOfService') }}</p>
              <p v-if="user.acceptedTermsAt" class="agreement-date">{{ t('settings.acceptedOn') }} {{ formatDate(user.acceptedTermsAt) }}</p>
            </div>
          </div>
          <div class="agreement-item">
            <div class="agreement-icon success">
              <span>✓</span>
            </div>
            <div class="agreement-content">
              <p class="agreement-title">{{ t('settings.privacyPolicy') }}</p>
              <p v-if="user.acceptedPrivacyAt" class="agreement-date">{{ t('settings.acceptedOn') }} {{ formatDate(user.acceptedPrivacyAt) }}</p>
            </div>
          </div>
          <div class="agreement-item">
            <div class="agreement-icon success">
              <span>✓</span>
            </div>
            <div class="agreement-content">
              <p class="agreement-title">{{ t('settings.withdrawalWaiver') }}</p>
              <p v-if="user.waivedWithdrawalAt" class="agreement-date">{{ t('settings.acknowledgedOn') }} {{ formatDate(user.waivedWithdrawalAt) }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- GDPR Data Rights -->
    <section class="settings-section">
      <h2 class="section-title">{{ t('settings.dataRights') }}</h2>
      <div class="glass-card settings-card">
        <!-- Download Data -->
        <div class="gdpr-action">
          <div class="gdpr-content">
            <p class="gdpr-title">{{ t('settings.downloadData') }}</p>
            <p class="gdpr-description">{{ t('settings.downloadDataDesc') }}</p>
          </div>
          <button
            class="btn-secondary"
            :disabled="downloadingData"
            @click="downloadMyData"
          >
            <span v-if="downloadingData" class="spinner" />
            <span v-else>📥</span>
            {{ downloadingData ? t('settings.preparing') : t('settings.downloadDataBtn') }}
          </button>
        </div>

        <div class="divider" />

        <!-- Delete Account -->
        <div class="gdpr-action">
          <div class="gdpr-content">
            <p class="gdpr-title danger">{{ t('settings.deleteAccount') }}</p>
            <p class="gdpr-description">{{ t('settings.deleteAccountDesc') }}</p>
          </div>
          <button class="btn-danger" @click="requestAccountDeletion">
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </section>

    <!-- Account Information -->
    <section class="settings-section">
      <h2 class="section-title">{{ t('settings.accountInfo') }}</h2>
      <div class="glass-card settings-card">
        <div class="info-grid three-cols">
          <div class="info-item">
            <label class="info-label">{{ t('settings.userId') }}</label>
            <p class="info-value mono">{{ user.id }}</p>
          </div>
          <div class="info-item">
            <label class="info-label">{{ t('settings.accountCreated') }}</label>
            <p class="info-value">{{ user.createdAt ? formatDate(user.createdAt) : '-' }}</p>
          </div>
          <div class="info-item">
            <label class="info-label">{{ t('settings.role') }}</label>
            <p class="info-value">
              <span :class="['role-badge', user.role === 'admin' ? 'admin' : 'user']">
                {{ user.role }}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 32px;
}

.settings-header h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0;
}

.settings-subtitle {
  color: #64748b;
  margin-top: 4px;
  font-size: 0.9375rem;
}

.settings-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 16px;
}

.settings-card {
  padding: 24px;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.info-grid.three-cols {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 768px) {
  .info-grid,
  .info-grid.three-cols {
    grid-template-columns: 1fr;
  }
}

.info-item.full-width {
  grid-column: span 2;
}

@media (max-width: 768px) {
  .info-item.full-width {
    grid-column: span 1;
  }
}

.info-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  margin: 6px 0 0;
  color: #0f172a;
  font-size: 0.9375rem;
}

.info-value.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
}

/* Agreement List */
.agreement-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agreement-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.agreement-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.agreement-icon.success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.agreement-content {
  flex: 1;
}

.agreement-title {
  margin: 0;
  font-weight: 500;
  color: #0f172a;
}

.agreement-date {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: #64748b;
}

/* GDPR Actions */
.gdpr-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  gap: 24px;
}

.gdpr-action:first-child {
  padding-top: 0;
}

.gdpr-action:last-child {
  padding-bottom: 0;
}

.gdpr-content {
  flex: 1;
}

.gdpr-title {
  margin: 0;
  font-weight: 500;
  color: #0f172a;
}

.gdpr-title.danger {
  color: #dc2626;
}

.gdpr-description {
  margin: 6px 0 0;
  font-size: 0.875rem;
  color: #64748b;
}

.divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 0;
}

/* Buttons */
.btn-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #475569;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-danger:hover {
  background: rgba(220, 38, 38, 0.15);
}

/* Role Badge */
.role-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.role-badge.admin {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
}

.role-badge.user {
  background: rgba(0, 0, 0, 0.05);
  color: #64748b;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: #475569;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 600px) {
  .settings-view {
    padding: 16px;
  }

  .gdpr-action {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-secondary,
  .btn-danger {
    width: 100%;
    justify-content: center;
  }
}
</style>
