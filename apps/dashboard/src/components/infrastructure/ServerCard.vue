<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Server, App, Proxy } from '@/types'

const { t } = useI18n()

interface Props {
  server: Server
  apps: App[]
  proxies: Proxy[]
  bundleVersion?: string | null
  updatingAgent?: string | null
  updateStatus?: { message?: string } | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
  update: []
}>()

const serverApps = computed(() => props.apps.filter(a => a.nodeId === props.server.id))
const serverProxies = computed(() => props.proxies.filter(p => p.nodeId === props.server.id))

const hasUpdate = computed(() =>
  props.server.updateAvailable && props.server.status === 'online'
)

const isUpdating = computed(() =>
  props.updatingAgent === props.server.id
)

function handleClick() {
  emit('click')
}

function handleUpdate(event: MouseEvent) {
  event.stopPropagation()
  emit('update')
}
</script>

<template>
  <div class="glass-card server-card" @click="handleClick">
    <div class="card-header">
      <div class="server-icon" :class="server.status" />
      <div class="server-info">
        <span class="server-id">
          {{ server.id.slice(0, 8) }}{{ server.alias ? ` (${server.alias})` : '' }}
        </span>
        <span :class="['server-status', server.status]">
          {{ t('infrastructure.' + server.status) }}
        </span>
        <span v-if="server.agentVersion" class="server-version">
          v{{ server.agentVersion }}
        </span>
      </div>

      <!-- Update Badge -->
      <span
        v-if="hasUpdate"
        class="update-badge"
        @click="handleUpdate"
      >
        <template v-if="isUpdating">
          ⏳ {{ updateStatus?.message || 'Updating...' }}
        </template>
        <template v-else>
          ⬆️ {{ server.agentVersion || '?' }} → {{ bundleVersion || '?' }}
        </template>
      </span>
    </div>

    <div class="card-stats">
      <div class="stat">
        <span class="stat-value">{{ serverApps.length }}</span>
        <span class="stat-label">{{ t('nav.applications') }}</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ serverProxies.length }}</span>
        <span class="stat-label">{{ t('nav.domains') }}</span>
      </div>
    </div>

    <div class="card-action">
      <span>{{ t('common.details') }} →</span>
    </div>
  </div>
</template>

<style scoped>
.server-card {
  cursor: pointer;
  padding: 20px;
  transition: all 0.2s;
}

.server-card:hover {
  transform: translateY(-4px);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.server-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--bg-color);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.server-icon::before {
  content: '🖥️';
  font-size: 1.2rem;
}

.server-icon.online::after {
  content: '';
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  background: var(--success-color);
  border-radius: 50%;
  border: 2px solid var(--surface-color);
}

.server-icon.offline::after {
  content: '';
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  background: var(--error-color);
  border-radius: 50%;
  border: 2px solid var(--surface-color);
}

.server-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.server-id {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-main);
}

.server-status {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.server-status.online {
  color: var(--success-color);
}

.server-status.offline {
  color: var(--error-color);
}

.server-version {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.update-badge {
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.update-badge:hover {
  background: rgba(59, 130, 246, 0.2);
}

.card-stats {
  display: flex;
  gap: 24px;
  padding: 12px 0;
  border-top: 1px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.card-action {
  display: flex;
  justify-content: flex-end;
}

.card-action span {
  font-size: 0.85rem;
  color: var(--primary-color);
  font-weight: 500;
}

/* Responsive */
@media (max-width: 600px) {
  .server-card {
    padding: 16px;
  }

  .card-stats {
    gap: 16px;
  }
}
</style>
