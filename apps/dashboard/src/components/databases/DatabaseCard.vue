<script setup lang="ts">
import { computed } from 'vue'
import type { Database, DatabaseType } from '@/types'

interface Props {
  database: Database
  configuringDatabase?: string | null
  removingDatabase?: string | null
  reconfiguringDatabase?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  configure: [type: DatabaseType]
  reconfigure: [type: DatabaseType]
  remove: [type: DatabaseType]
  viewLogs: [type: DatabaseType]
}>()

const databaseIcons: Record<DatabaseType, string> = {
  postgresql: '🐘',
  mysql: '🐬',
  redis: '🔴'
}

const databaseNames: Record<DatabaseType, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL/MariaDB',
  redis: 'Redis'
}

const icon = computed(() => databaseIcons[props.database.type] || '🗄️')
const name = computed(() => databaseNames[props.database.type] || props.database.type)

const isConfiguring = computed(() => props.configuringDatabase === props.database.type)
const isRemoving = computed(() => props.removingDatabase === props.database.type)
const isReconfiguring = computed(() => props.reconfiguringDatabase === props.database.type)
const isBusy = computed(() =>
  props.configuringDatabase !== null ||
  props.removingDatabase !== null ||
  props.reconfiguringDatabase !== null
)

const statusText = computed(() => {
  if (!props.database.installed) return 'Not configured'
  if (props.database.running) return 'Running'
  return 'Stopped'
})

const statusClass = computed(() => {
  if (!props.database.installed) return 'not-configured'
  if (props.database.running) return 'running'
  return 'stopped'
})
</script>

<template>
  <div
    class="database-card"
    :class="{ configured: database.installed }"
  >
    <div class="database-icon">{{ icon }}</div>

    <div class="database-info">
      <span class="database-name">{{ name }}</span>

      <span v-if="database.installed && database.version" class="database-version">
        {{ database.version }}
      </span>

      <span :class="['database-status', statusClass]">
        {{ statusText }}
      </span>
    </div>

    <div class="database-actions">
      <!-- Configure button (not installed) -->
      <button
        v-if="!database.installed"
        class="configure-btn"
        :disabled="isBusy"
        @click="emit('configure', database.type)"
      >
        {{ isConfiguring ? 'Setting up...' : '⚙️ Setup' }}
      </button>

      <!-- Actions when installed -->
      <template v-else>
        <!-- Running indicator -->
        <span v-if="database.running" class="status-dot running" />

        <!-- Reconfigure button -->
        <button
          class="action-btn"
          :disabled="isBusy"
          title="Reconfigure database"
          @click="emit('reconfigure', database.type)"
        >
          {{ isReconfiguring ? '...' : '🔄' }}
        </button>

        <!-- View logs button -->
        <button
          class="action-btn"
          title="View installation logs"
          @click="emit('viewLogs', database.type)"
        >
          📋
        </button>

        <!-- Remove button -->
        <button
          class="action-btn danger"
          :disabled="isBusy"
          title="Remove database"
          @click="emit('remove', database.type)"
        >
          {{ isRemoving ? '...' : '🗑️' }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.database-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  transition: all 0.2s;
}

.database-card.configured {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.03);
}

.database-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border-radius: 10px;
  flex-shrink: 0;
}

.database-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.database-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-main);
}

.database-version {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.database-status {
  font-size: 0.75rem;
  font-weight: 500;
}

.database-status.not-configured {
  color: var(--text-muted);
}

.database-status.running {
  color: var(--success-color);
}

.database-status.stopped {
  color: var(--error-color);
}

.database-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.configure-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: var(--primary-color);
  color: #fff;
}

.configure-btn:hover:not(:disabled) {
  background: #2563eb;
}

.configure-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.running {
  background: var(--success-color);
  box-shadow: 0 0 8px var(--success-color);
}

.action-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--primary-color);
}

.action-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error-color);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 600px) {
  .database-card {
    flex-wrap: wrap;
    gap: 12px;
  }

  .database-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
