<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApi } from '@/composables'

const { t } = useI18n()
const { request } = useApi()

interface ServerKey {
  id: string
  alias: string
  fingerprint: string
  isOnline: boolean
  algorithm: string
}

const serverKeys = ref<ServerKey[]>([])
const loading = ref(true)
const rotatingKey = ref<string | null>(null)

async function loadSecurityData() {
  loading.value = true
  try {
    const data = await request<{ servers: ServerKey[] }>('/api/user/security')
    serverKeys.value = data.servers
  } catch (err) {
    console.error('Failed to load security data:', err)
  } finally {
    loading.value = false
  }
}

async function rotateAgentKey(serverId: string) {
  if (rotatingKey.value) return
  rotatingKey.value = serverId

  try {
    await request(`/api/user/security/rotate-agent-key/${serverId}`, {
      method: 'POST'
    })
    // Reload data after rotation
    setTimeout(() => {
      loadSecurityData()
      rotatingKey.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to rotate key:', err)
    rotatingKey.value = null
  }
}

function copyFingerprint(fingerprint: string) {
  navigator.clipboard.writeText(fingerprint)
}

onMounted(() => {
  loadSecurityData()
})
</script>

<template>
  <div class="security-view">
    <!-- Header -->
    <div class="view-header">
      <h1 class="gradient-text">{{ t('security.title') }}</h1>
      <p class="view-subtitle">{{ t('security.subtitle') }}</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner large" />
      <p>{{ t('security.loadingData') }}</p>
    </div>

    <div v-else class="security-content">
      <!-- Info Card -->
      <div class="glass-card info-card">
        <div class="info-icon">
          <span>i</span>
        </div>
        <div class="info-content">
          <h4>{{ t('security.ed25519Info') }}</h4>
          <p>{{ t('security.ed25519Description') }}</p>
        </div>
      </div>

      <!-- Server Keys Card -->
      <div class="glass-card keys-card">
        <div class="card-header">
          <div class="header-icon emerald">
            <span>K</span>
          </div>
          <div class="header-content">
            <h3 class="card-title">{{ t('security.serverKeys') }}</h3>
            <p class="card-description">{{ t('security.serverKeysDescription') }}</p>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="serverKeys.length === 0" class="empty-state">
          <div class="empty-icon">-</div>
          <p>{{ t('security.noServers') }}</p>
        </div>

        <!-- Keys Table -->
        <div v-else class="table-wrapper">
          <table class="keys-table">
            <thead>
              <tr>
                <th>{{ t('security.server') }}</th>
                <th>{{ t('security.fingerprint') }}</th>
                <th>{{ t('security.algorithm') }}</th>
                <th>{{ t('security.status') }}</th>
                <th>{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="key in serverKeys" :key="key.id">
                <td class="server-id">{{ key.alias && key.alias !== 'Unknown' ? key.alias : key.id.slice(0, 12) }}</td>
                <td class="fingerprint-cell">
                  <code class="fingerprint" @click="copyFingerprint(key.fingerprint)" :title="t('security.clickToCopy')">
                    {{ key.fingerprint.slice(0, 24) }}...
                  </code>
                </td>
                <td class="algorithm-cell">{{ key.algorithm }}</td>
                <td>
                  <span :class="['status-badge', key.isOnline ? 'active' : 'offline']">
                    {{ key.isOnline ? t('infrastructure.online') : t('infrastructure.offline') }}
                  </span>
                </td>
                <td>
                  <button
                    v-if="key.isOnline"
                    class="rotate-btn"
                    :disabled="rotatingKey === key.id"
                    @click="rotateAgentKey(key.id)"
                    :title="t('security.rotateKey')"
                  >
                    {{ rotatingKey === key.id ? '...' : 'R' }}
                  </button>
                  <span v-else class="offline-text">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Security Tips Card -->
      <div class="glass-card tips-card">
        <div class="card-header">
          <div class="header-icon amber">
            <span>!</span>
          </div>
          <div class="header-content">
            <h3 class="card-title">{{ t('security.tips') }}</h3>
          </div>
        </div>
        <ul class="tips-list">
          <li>{{ t('security.tip1') }}</li>
          <li>{{ t('security.tip2') }}</li>
          <li>{{ t('security.tip3') }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.security-view {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
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
  color: var(--text-muted);
  margin-top: 4px;
  font-size: 0.9375rem;
}

.security-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Info Card */
.info-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.1);
}

.info-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--primary-color);
}

.info-content h4 {
  margin: 0 0 4px;
  font-size: 0.9375rem;
  color: var(--text-main);
}

.info-content p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

/* Card Header */
.card-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}

.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  flex-shrink: 0;
}

.header-icon.emerald {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.header-icon.amber {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.header-content {
  flex: 1;
}

.card-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-main);
}

.card-description {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

/* Keys Card */
.keys-card {
  padding: 24px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
  color: var(--text-muted);
}

.empty-state p {
  margin: 0;
  color: var(--text-muted);
}

/* Table */
.table-wrapper {
  overflow-x: auto;
}

.keys-table {
  width: 100%;
  border-collapse: collapse;
}

.keys-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--surface-border);
}

.keys-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--surface-border);
  font-size: 0.875rem;
}

.keys-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

.server-id {
  font-family: var(--font-mono);
  color: var(--text-main);
  font-weight: 500;
}

.fingerprint-cell {
  font-family: var(--font-mono);
}

.fingerprint {
  color: var(--primary-color);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.2s;
}

.fingerprint:hover {
  background: rgba(59, 130, 246, 0.1);
}

.algorithm-cell {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.status-badge.offline {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.rotate-btn {
  padding: 4px 12px;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.1);
  border: none;
  color: #d97706;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.rotate-btn:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.2);
}

.rotate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.offline-text {
  color: var(--text-muted);
}

/* Tips Card */
.tips-card {
  padding: 24px;
}

.tips-list {
  margin: 0;
  padding-left: 20px;
}

.tips-list li {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin-bottom: 8px;
}

.tips-list li:last-child {
  margin-bottom: 0;
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 80px 20px;
}

.loading-state p {
  margin: 16px 0 0;
  color: var(--text-muted);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(139, 92, 246, 0.2);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.large {
  width: 48px;
  height: 48px;
  border-width: 4px;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 768px) {
  .security-view {
    padding: 16px;
  }

  .keys-table th,
  .keys-table td {
    padding: 10px 12px;
  }
}

@media (max-width: 600px) {
  .card-header {
    flex-direction: column;
    gap: 12px;
  }

  .info-card {
    flex-direction: column;
    text-align: center;
  }
}
</style>
