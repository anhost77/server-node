<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { App } from '@/types'

const { t } = useI18n()

interface Props {
  app: App
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deploy: [id: string]
  restore: [id: string]
  start: [id: string]
  restart: [id: string]
  stop: [id: string]
  delete: [id: string]
}>()

const repoName = computed(() => {
  const parts = props.app.repoUrl.split('/')
  return parts[parts.length - 1]?.replace('.git', '') || props.app.repoUrl
})

const parsedPorts = computed(() => {
  try {
    return JSON.parse(props.app.ports || '[]')
  } catch {
    return []
  }
})

const detectedPortsList = computed(() => {
  try {
    return JSON.parse(props.app.detectedPorts || '[]')
  } catch {
    return []
  }
})

const portsDisplay = computed(() => {
  if (parsedPorts.value.length > 0) {
    return parsedPorts.value
      .map((p: { port: number; isMain?: boolean }) => `${p.port}${p.isMain ? '*' : ''}`)
      .join(', ')
  }
  return String(props.app.port)
})
</script>

<template>
  <div class="glass-card app-card">
    <div class="app-header">
      <div class="app-icon">📦</div>
      <div class="app-meta">
        <h4>{{ app.name }}</h4>
        <p>{{ repoName }}</p>
      </div>
      <div class="app-status">{{ t('applications.running') }}</div>
    </div>

    <div class="app-details">
      <span class="detail-item">
        <span class="detail-label">Node:</span>
        {{ app.nodeId?.slice(0, 8) }}
      </span>

      <span class="detail-item">
        <span class="detail-label">
          {{ parsedPorts.length > 1 ? t('applications.ports') || 'Ports' : t('applications.port') }}:
        </span>
        {{ portsDisplay }}
      </span>

      <span
        v-if="detectedPortsList.length > 0"
        class="detail-item detected"
        title="Detected from server"
      >
        🔍 {{ detectedPortsList.join(', ') }}
      </span>
    </div>

    <div class="app-actions">
      <button class="action-btn primary" @click="emit('deploy', app.id)">
        {{ t('applications.deploy') }}
      </button>
      <button class="action-btn" @click="emit('restore', app.id)">
        {{ t('applications.restore') }}
      </button>
      <button class="action-btn" @click="emit('start', app.id)">
        {{ t('applications.start') }}
      </button>
      <button class="action-btn" @click="emit('restart', app.id)">
        {{ t('applications.restart') }}
      </button>
      <button class="action-btn secondary" @click="emit('stop', app.id)">
        {{ t('applications.stop') }}
      </button>
      <button class="action-btn danger" @click="emit('delete', app.id)">
        {{ t('common.delete') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-card {
  padding: 20px;
}

.app-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 16px;
}

.app-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.app-meta {
  flex: 1;
  min-width: 0;
}

.app-meta h4 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-meta p {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-status {
  padding: 4px 10px;
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  flex-shrink: 0;
}

.app-details {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 16px;
}

.detail-item {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.detail-label {
  color: var(--text-main);
  font-weight: 500;
}

.detail-item.detected {
  color: var(--primary-color);
}

.app-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-btn {
  padding: 8px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--surface-border);
  background: var(--surface-color);
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-color);
  border-color: var(--text-muted);
}

.action-btn.primary {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}

.action-btn.primary:hover {
  background: #2563eb;
}

.action-btn.secondary {
  color: var(--text-muted);
}

.action-btn.danger {
  color: var(--error-color);
  border-color: rgba(239, 68, 68, 0.3);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error-color);
}

/* Responsive */
@media (max-width: 600px) {
  .app-card {
    padding: 16px;
  }

  .app-actions {
    gap: 6px;
  }

  .action-btn {
    padding: 6px 10px;
    font-size: 0.75rem;
  }
}
</style>
