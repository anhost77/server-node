<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Server, App, Proxy } from '@/types'

const { t } = useI18n()

interface Props {
  servers: Server[]
  apps: App[]
  proxies: Proxy[]
}

const props = defineProps<Props>()

const onlineServers = () => props.servers.filter(s => s.status === 'online').length
</script>

<template>
  <div class="stats-bar">
    <div class="stat-card">
      <span class="stat-value">{{ servers.length }}</span>
      <span class="stat-label">{{ t('infrastructure.servers') }}</span>
    </div>
    <div class="stat-card">
      <span class="stat-value success">{{ onlineServers() }}</span>
      <span class="stat-label">{{ t('infrastructure.online') }}</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{{ apps.length }}</span>
      <span class="stat-label">{{ t('nav.applications') }}</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{{ proxies.length }}</span>
      <span class="stat-label">{{ t('nav.domains') }}</span>
    </div>
  </div>
</template>

<style scoped>
.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-main);
}

.stat-value.success {
  color: var(--success-color);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
  .stats-bar {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-bar {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-value {
    font-size: 1.5rem;
  }
}
</style>
