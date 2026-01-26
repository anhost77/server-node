<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAdmin } from '@/composables'

const { t } = useI18n()
const {
  adminSecurity,
  adminAgentKeys,
  rotatingCPKey,
  rotatingAgentKey,
  loadAdminSecurity,
  rotateCPKey,
  rotateAgentKey
} = useAdmin()

function formatDate(timestamp: number | string | null): string {
  if (!timestamp) return '-'
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="admin-security-view">
    <!-- Header -->
    <div class="view-header">
      <h1 class="gradient-text">{{ t('admin.security.title') }}</h1>
      <p class="view-subtitle">{{ t('admin.security.subtitle') }}</p>
    </div>

    <div v-if="adminSecurity" class="security-content">
      <!-- Control Plane Key -->
      <div class="glass-card cp-key-card">
        <div class="card-header">
          <div class="header-icon violet">🔐</div>
          <div class="header-content">
            <h3 class="card-title">{{ t('admin.security.cpKey') }}</h3>
            <p class="card-description">{{ t('admin.security.cpKeyDescription') }}</p>
          </div>
        </div>

        <div class="key-details">
          <div class="detail-grid">
            <div class="detail-item">
              <label>{{ t('admin.security.fingerprint') }}</label>
              <code class="fingerprint">{{ adminSecurity.controlPlane.fingerprint }}</code>
            </div>
            <div class="detail-item">
              <label>{{ t('admin.security.createdAt') }}</label>
              <p>{{ formatDate(adminSecurity.controlPlane.createdAt) }}</p>
            </div>
            <div class="detail-item">
              <label>{{ t('admin.security.rotations') }}</label>
              <p>{{ adminSecurity.controlPlane.rotations || 0 }}</p>
            </div>
            <div class="detail-item">
              <label>{{ t('admin.security.lastRotated') }}</label>
              <p>{{ formatDate(adminSecurity.controlPlane.lastRotatedAt) }}</p>
            </div>
          </div>
        </div>

        <div class="rotate-warning">
          <div class="warning-content">
            <p class="warning-title">{{ t('admin.security.rotateWarning') }}</p>
            <p class="warning-description">{{ t('admin.security.rotateWarningDesc') }}</p>
          </div>
          <button
            class="btn-danger"
            :disabled="rotatingCPKey"
            @click="rotateCPKey"
          >
            <span v-if="rotatingCPKey" class="spinner" />
            <span v-else>🔄</span>
            {{ rotatingCPKey ? t('admin.security.rotating') : t('admin.security.rotateCPKey') }}
          </button>
        </div>
      </div>

      <!-- Agent Keys -->
      <div class="glass-card agent-keys-card">
        <div class="card-header">
          <div class="header-icon emerald">🔑</div>
          <div class="header-content">
            <h3 class="card-title">{{ t('admin.security.agentKeys') }}</h3>
            <p class="card-description">{{ t('admin.security.agentKeysDescription') }}</p>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="!adminAgentKeys || adminAgentKeys.length === 0" class="empty-state">
          <div class="empty-icon">🔒</div>
          <p>{{ t('admin.security.noAgentKeys') }}</p>
        </div>

        <!-- Keys Table -->
        <div v-else class="table-wrapper">
          <table class="keys-table">
            <thead>
              <tr>
                <th>{{ t('admin.security.serverId') }}</th>
                <th>{{ t('admin.security.fingerprint') }}</th>
                <th>{{ t('admin.security.status') }}</th>
                <th>{{ t('admin.security.lastUsed') }}</th>
                <th>{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="key in adminAgentKeys" :key="key.id">
                <td class="server-id">{{ key.alias && key.alias !== 'Unknown' ? key.alias : key.id?.slice(0, 12) }}</td>
                <td class="fingerprint-cell">{{ key.fingerprint?.slice(0, 16) }}...</td>
                <td>
                  <span :class="['status-badge', key.isOnline ? 'active' : 'offline']">
                    {{ key.isOnline ? t('infrastructure.online') : t('infrastructure.offline') }}
                  </span>
                </td>
                <td class="date-cell">-</td>
                <td>
                  <button
                    v-if="key.isOnline"
                    class="rotate-btn"
                    :disabled="rotatingAgentKey === key.id"
                    @click="rotateAgentKey(key.id)"
                  >
                    {{ rotatingAgentKey === key.id ? '...' : '🔄' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Security Stats -->
      <div class="stats-grid">
        <div class="glass-card stat-card">
          <div class="stat-header">
            <div class="stat-icon emerald">✅</div>
            <span class="stat-label">{{ t('admin.security.agentsOnline') }}</span>
          </div>
          <div class="stat-value">
            {{ adminAgentKeys?.filter((k: any) => k.isOnline).length || 0 }}
          </div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-header">
            <div class="stat-icon amber">🔄</div>
            <span class="stat-label">{{ t('admin.security.totalRotations') }}</span>
          </div>
          <div class="stat-value">
            {{ adminSecurity.controlPlane.rotations || 0 }}
          </div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-header">
            <div class="stat-icon red">📴</div>
            <span class="stat-label">{{ t('admin.security.agentOffline') }}</span>
          </div>
          <div class="stat-value">
            {{ adminAgentKeys?.filter((k: any) => !k.isOnline).length || 0 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-else class="loading-state">
      <div class="spinner large" />
      <p>{{ t('admin.security.loadingData') }}</p>
    </div>
  </div>
</template>

<style scoped>
.admin-security-view {
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
  color: #64748b;
  margin-top: 4px;
  font-size: 0.9375rem;
}

.security-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
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
  font-size: 1.5rem;
  flex-shrink: 0;
}

.header-icon.violet { background: rgba(139, 92, 246, 0.1); }
.header-icon.emerald { background: rgba(16, 185, 129, 0.1); }

.header-content {
  flex: 1;
}

.card-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.card-description {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: #64748b;
}

/* CP Key Card */
.cp-key-card {
  padding: 24px;
}

.key-details {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

.detail-item label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.detail-item p {
  margin: 0;
  font-size: 0.9375rem;
  color: #0f172a;
}

.fingerprint {
  display: block;
  font-size: 0.8125rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #7c3aed;
  word-break: break-all;
}

/* Rotate Warning */
.rotate-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(220, 38, 38, 0.05);
  border: 1px solid rgba(220, 38, 38, 0.1);
}

.warning-content {
  flex: 1;
}

.warning-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #dc2626;
}

.warning-description {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: #64748b;
}

/* Agent Keys Card */
.agent-keys-card {
  padding: 24px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}

.empty-state p {
  margin: 0;
  color: #64748b;
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
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.keys-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 0.875rem;
}

.keys-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

.server-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #0f172a;
}

.fingerprint-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #64748b;
}

.date-cell {
  color: #64748b;
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
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.1);
  border: none;
  color: #d97706;
  font-size: 0.75rem;
  font-weight: 500;
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

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  padding: 20px;
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
}

.stat-icon.emerald { background: rgba(16, 185, 129, 0.1); }
.stat-icon.amber { background: rgba(245, 158, 11, 0.1); }
.stat-icon.red { background: rgba(220, 38, 38, 0.1); }

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

/* Buttons */
.btn-danger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.2);
  cursor: pointer;
  transition: background 0.2s ease;
  white-space: nowrap;
}

.btn-danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.15);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 80px 20px;
}

.loading-state p {
  margin: 16px 0 0;
  color: #64748b;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(220, 38, 38, 0.2);
  border-top-color: #dc2626;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.large {
  width: 48px;
  height: 48px;
  border-width: 4px;
  border-color: rgba(139, 92, 246, 0.2);
  border-top-color: #8b5cf6;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 600px) {
  .rotate-warning {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-danger {
    justify-content: center;
  }
}
</style>
