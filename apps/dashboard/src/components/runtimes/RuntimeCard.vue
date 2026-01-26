<script setup lang="ts">
import { computed } from 'vue'
import type { Runtime, RuntimeType } from '@/types'

interface Props {
  runtime: Runtime
  installingRuntime?: string | null
  updatingRuntime?: string | null
  removingRuntime?: string | null
  canRemove?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canRemove: true
})

const emit = defineEmits<{
  install: [type: RuntimeType]
  update: [type: RuntimeType]
  remove: [type: RuntimeType]
  viewLogs: [type: RuntimeType]
}>()

const runtimeIcons: Record<RuntimeType, string> = {
  nodejs: '🟢',
  python: '🐍',
  go: '🔵',
  docker: '🐳',
  rust: '🦀',
  ruby: '💎'
}

const runtimeNames: Record<RuntimeType, string> = {
  nodejs: 'Node.js',
  python: 'Python',
  go: 'Go',
  docker: 'Docker',
  rust: 'Rust',
  ruby: 'Ruby'
}

const icon = computed(() => runtimeIcons[props.runtime.type] || '📦')
const name = computed(() => runtimeNames[props.runtime.type] || props.runtime.type)

const isInstalling = computed(() => props.installingRuntime === props.runtime.type)
const isUpdating = computed(() => props.updatingRuntime === props.runtime.type)
const isRemoving = computed(() => props.removingRuntime === props.runtime.type)
const isBusy = computed(() =>
  props.installingRuntime !== null ||
  props.updatingRuntime !== null ||
  props.removingRuntime !== null
)

// Node.js is always installed and cannot be removed
const isNodeJs = computed(() => props.runtime.type === 'nodejs')
const showRemoveButton = computed(() =>
  props.runtime.installed &&
  props.canRemove &&
  !isNodeJs.value
)
</script>

<template>
  <div
    class="runtime-card"
    :class="{
      installed: runtime.installed,
      'has-update': runtime.updateAvailable
    }"
  >
    <div class="runtime-icon">{{ icon }}</div>

    <div class="runtime-info">
      <span class="runtime-name">{{ name }}</span>

      <span v-if="runtime.installed" class="runtime-version">
        {{ runtime.version || 'installed' }}
      </span>

      <span v-if="runtime.updateAvailable" class="latest-version">
        → {{ runtime.latestVersion }}
      </span>

      <span v-if="!runtime.installed" class="runtime-size">
        {{ runtime.estimatedSize }}
      </span>
    </div>

    <div class="runtime-actions">
      <!-- Install button -->
      <button
        v-if="!runtime.installed"
        class="install-btn"
        :disabled="isBusy"
        @click="emit('install', runtime.type)"
      >
        {{ isInstalling ? 'Installing...' : 'Install' }}
      </button>

      <!-- Update button -->
      <button
        v-else-if="runtime.updateAvailable"
        class="update-btn"
        :disabled="isBusy"
        @click="emit('update', runtime.type)"
      >
        {{ isUpdating ? 'Updating...' : '⬆️ Update' }}
      </button>

      <!-- Installed badge -->
      <span v-else class="runtime-badge installed">✓ Installed</span>

      <!-- View logs button -->
      <button
        v-if="runtime.installed"
        class="logs-btn"
        title="View installation logs"
        @click="emit('viewLogs', runtime.type)"
      >
        📋
      </button>

      <!-- Remove button -->
      <button
        v-if="showRemoveButton"
        class="remove-btn"
        :disabled="isBusy"
        :title="`Remove ${name}`"
        @click="emit('remove', runtime.type)"
      >
        🗑️
      </button>
    </div>
  </div>
</template>

<style scoped>
.runtime-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  transition: all 0.2s;
}

.runtime-card.installed {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.03);
}

.runtime-card.has-update {
  border-color: rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.05);
}

.runtime-icon {
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

.runtime-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.runtime-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-main);
}

.runtime-version {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.latest-version {
  font-size: 0.75rem;
  color: var(--primary-color);
  font-family: var(--font-mono);
}

.runtime-size {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.runtime-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.install-btn,
.update-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.install-btn {
  background: var(--primary-color);
  color: #fff;
}

.install-btn:hover:not(:disabled) {
  background: #2563eb;
}

.update-btn {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.update-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
}

.install-btn:disabled,
.update-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.runtime-badge {
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
}

.runtime-badge.installed {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
}

.logs-btn,
.remove-btn {
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

.logs-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--primary-color);
}

.remove-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error-color);
}

.remove-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 600px) {
  .runtime-card {
    flex-wrap: wrap;
    gap: 12px;
  }

  .runtime-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
