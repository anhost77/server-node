<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAdmin, useBilling } from '@/composables'

const { t } = useI18n()
const { formatCurrency } = useBilling()
const {
  adminMetrics,
  loadAdminMetrics,
  getFreeUsersArc,
  getPaidUsersArc,
  getFreeUsersOffset,
  getBarWidth
} = useAdmin()

interface Props {
  proxiesCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  proxiesCount: 0
})
</script>

<template>
  <div class="admin-metrics-view">
    <!-- Header -->
    <div class="view-header">
      <h1 class="gradient-text">{{ t('admin.metrics.title') }}</h1>
      <p class="view-subtitle">Platform analytics and metrics</p>
    </div>

    <!-- KPI Cards -->
    <div v-if="adminMetrics" class="kpi-grid">
      <!-- Users -->
      <div class="glass-card kpi-card kpi-blue">
        <div class="kpi-header">
          <div class="kpi-icon blue">👥</div>
          <span class="kpi-label">{{ t('admin.metrics.totalUsers') }}</span>
        </div>
        <div class="kpi-value">{{ adminMetrics.users.total }}</div>
        <div v-if="adminMetrics.users.recentSignups > 0" class="kpi-trend positive">
          <span>↑</span> +{{ adminMetrics.users.recentSignups }} {{ t('admin.metrics.thisWeek') }}
        </div>
      </div>

      <!-- Subscriptions -->
      <div class="glass-card kpi-card kpi-violet">
        <div class="kpi-header">
          <div class="kpi-icon violet">💳</div>
          <span class="kpi-label">{{ t('admin.metrics.activeSubscriptions') }}</span>
        </div>
        <div class="kpi-value">{{ adminMetrics.subscriptions.active }}</div>
        <div class="kpi-subtext">
          {{ adminMetrics.users.total > 0 ? Math.round((adminMetrics.subscriptions.active / adminMetrics.users.total) * 100) : 0 }}% {{ t('admin.metrics.conversion') }}
        </div>
      </div>

      <!-- Servers -->
      <div class="glass-card kpi-card kpi-emerald">
        <div class="kpi-header">
          <div class="kpi-icon emerald">🖥️</div>
          <span class="kpi-label">{{ t('admin.metrics.connectedServers') }}</span>
        </div>
        <div class="kpi-value">{{ adminMetrics.infrastructure.servers }}</div>
        <div class="kpi-subtext">{{ adminMetrics.infrastructure.apps }} {{ t('admin.metrics.appsDeployed') }}</div>
      </div>

      <!-- Revenue -->
      <div class="glass-card kpi-card kpi-amber">
        <div class="kpi-header">
          <div class="kpi-icon amber">💰</div>
          <span class="kpi-label">{{ t('admin.metrics.mrr') }}</span>
        </div>
        <div class="kpi-value">{{ adminMetrics.revenue.mrrFormatted }}</div>
        <div v-if="adminMetrics.revenue.mrr > 0" class="kpi-trend positive">
          <span>↑</span> {{ t('admin.metrics.activeBilling') }}
        </div>
        <div v-else class="kpi-subtext">{{ t('admin.metrics.noPaidSubs') }}</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div v-if="adminMetrics" class="charts-grid">
      <!-- User Distribution -->
      <div class="glass-card chart-card">
        <h3 class="chart-title">{{ t('admin.metrics.userDistribution') }}</h3>
        <div class="chart-content">
          <svg class="donut-chart" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" stroke-width="12" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke="#3b82f6" stroke-width="12"
              :stroke-dasharray="getFreeUsersArc()"
              stroke-dashoffset="0"
              transform="rotate(-90 50 50)"
              class="chart-segment"
            />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke="#10b981" stroke-width="12"
              :stroke-dasharray="getPaidUsersArc()"
              :stroke-dashoffset="'-' + getFreeUsersOffset()"
              transform="rotate(-90 50 50)"
              class="chart-segment"
            />
          </svg>
          <div class="donut-center">
            <div class="donut-value">{{ adminMetrics.users.total }}</div>
            <div class="donut-label">{{ t('admin.metrics.users') }}</div>
          </div>
        </div>
        <div class="chart-legend">
          <div class="legend-item">
            <div class="legend-dot blue"></div>
            <span>{{ t('admin.metrics.free') }}: {{ adminMetrics.users.total - adminMetrics.subscriptions.active }}</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot emerald"></div>
            <span>{{ t('admin.metrics.paid') }}: {{ adminMetrics.subscriptions.active }}</span>
          </div>
        </div>
      </div>

      <!-- Infrastructure -->
      <div class="glass-card chart-card">
        <h3 class="chart-title">{{ t('admin.metrics.infrastructureOverview') }}</h3>
        <div class="bars-container">
          <div class="bar-item">
            <div class="bar-header">
              <span class="bar-label">{{ t('admin.metrics.servers') }}</span>
              <span class="bar-value">{{ adminMetrics.infrastructure.servers }}</span>
            </div>
            <div class="bar-track">
              <div
                class="bar-fill violet"
                :style="{ width: getBarWidth(adminMetrics.infrastructure.servers, Math.max(adminMetrics.infrastructure.servers, adminMetrics.infrastructure.apps, 1) * 1.5) }"
              />
            </div>
          </div>
          <div class="bar-item">
            <div class="bar-header">
              <span class="bar-label">{{ t('admin.metrics.applications') }}</span>
              <span class="bar-value">{{ adminMetrics.infrastructure.apps }}</span>
            </div>
            <div class="bar-track">
              <div
                class="bar-fill emerald"
                :style="{ width: getBarWidth(adminMetrics.infrastructure.apps, Math.max(adminMetrics.infrastructure.servers, adminMetrics.infrastructure.apps, 1) * 1.5) }"
              />
            </div>
          </div>
          <div class="bar-item">
            <div class="bar-header">
              <span class="bar-label">{{ t('admin.metrics.domains') }}</span>
              <span class="bar-value">{{ proxiesCount }}</span>
            </div>
            <div class="bar-track">
              <div
                class="bar-fill amber"
                :style="{ width: getBarWidth(proxiesCount, Math.max(adminMetrics.infrastructure.servers, adminMetrics.infrastructure.apps, proxiesCount, 1) * 1.5) }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Revenue -->
      <div class="glass-card chart-card">
        <h3 class="chart-title">{{ t('admin.metrics.revenueMetrics') }}</h3>
        <div class="revenue-display">
          <div class="revenue-main">{{ adminMetrics.revenue.mrrFormatted }}</div>
          <div class="revenue-period">per month</div>
        </div>
        <div class="revenue-details">
          <div class="revenue-row">
            <span class="revenue-label">ARR (Annual)</span>
            <span class="revenue-value">{{ formatCurrency(adminMetrics.revenue.mrr * 12) }}</span>
          </div>
          <div class="revenue-row">
            <span class="revenue-label">Avg. per User</span>
            <span class="revenue-value">
              {{ adminMetrics.subscriptions.active > 0 ? formatCurrency(adminMetrics.revenue.mrr / adminMetrics.subscriptions.active) : '0,00 €' }}
            </span>
          </div>
          <div class="revenue-row">
            <span class="revenue-label">Conversion Rate</span>
            <span class="revenue-value">
              {{ adminMetrics.users.total > 0 ? Math.round((adminMetrics.subscriptions.active / adminMetrics.users.total) * 100) : 0 }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div v-if="adminMetrics" class="glass-card stats-card">
      <h3 class="stats-title">Quick Stats</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-icon violet">📈</div>
          <div class="stat-content">
            <div class="stat-value">{{ adminMetrics.users.recentSignups }}</div>
            <div class="stat-label">New signups (7 days)</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon emerald">🎯</div>
          <div class="stat-content">
            <div class="stat-value">
              {{ adminMetrics.users.total > 0 ? (adminMetrics.infrastructure.apps / adminMetrics.users.total).toFixed(1) : 0 }}
            </div>
            <div class="stat-label">Apps per user</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon blue">⚡</div>
          <div class="stat-content">
            <div class="stat-value">
              {{ adminMetrics.infrastructure.servers > 0 ? (adminMetrics.infrastructure.apps / adminMetrics.infrastructure.servers).toFixed(1) : 0 }}
            </div>
            <div class="stat-label">Apps per server</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon amber">🌐</div>
          <div class="stat-content">
            <div class="stat-value">{{ proxiesCount }}</div>
            <div class="stat-label">Active domains</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-metrics-view {
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

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  padding: 20px;
}

.kpi-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.kpi-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.kpi-icon.blue { background: rgba(59, 130, 246, 0.1); }
.kpi-icon.violet { background: rgba(139, 92, 246, 0.1); }
.kpi-icon.emerald { background: rgba(16, 185, 129, 0.1); }
.kpi-icon.amber { background: rgba(245, 158, 11, 0.1); }

.kpi-label {
  font-size: 0.875rem;
  color: #64748b;
}

.kpi-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 4px;
}

.kpi-trend {
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

.kpi-trend.positive {
  color: #059669;
}

.kpi-subtext {
  font-size: 0.875rem;
  color: #64748b;
}

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}

@media (max-width: 1024px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  padding: 24px;
}

.chart-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 24px;
}

/* Donut Chart */
.chart-content {
  position: relative;
  display: flex;
  justify-content: center;
}

.donut-chart {
  width: 160px;
  height: 160px;
}

.chart-segment {
  transition: stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.donut-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.donut-label {
  font-size: 0.75rem;
  color: #64748b;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 24px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: #64748b;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.blue { background: #3b82f6; }
.legend-dot.emerald { background: #10b981; }

/* Bar Chart */
.bars-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.bar-label {
  color: #64748b;
}

.bar-value {
  color: #0f172a;
  font-weight: 500;
}

.bar-track {
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease;
}

.bar-fill.violet {
  background: linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%);
}

.bar-fill.emerald {
  background: linear-gradient(90deg, #10b981 0%, #14b8a6 100%);
}

.bar-fill.amber {
  background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
}

/* Revenue */
.revenue-display {
  text-align: center;
  margin-bottom: 24px;
}

.revenue-main {
  font-size: 2.5rem;
  font-weight: 700;
  color: #0f172a;
}

.revenue-period {
  font-size: 0.875rem;
  color: #64748b;
}

.revenue-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.revenue-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.revenue-label {
  color: #64748b;
}

.revenue-value {
  color: #0f172a;
  font-weight: 500;
}

/* Quick Stats */
.stats-card {
  padding: 24px;
}

.stats-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.stat-icon.violet { background: rgba(139, 92, 246, 0.1); }
.stat-icon.emerald { background: rgba(16, 185, 129, 0.1); }
.stat-icon.blue { background: rgba(59, 130, 246, 0.1); }
.stat-icon.amber { background: rgba(245, 158, 11, 0.1); }

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
}
</style>
