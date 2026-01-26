<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ConsoleLog, Server } from '@/types'

const { t } = useI18n()

interface Props {
  logs: ConsoleLog[]
  activeServer?: Server | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  clear: []
}>()

const consoleContainer = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
const filters = ref<string[]>(['stdout', 'stderr', 'system'])

const filteredLogs = computed(() => {
  return props.logs.filter(log =>
    log.stream &&
    filters.value.includes(log.stream) &&
    (!props.activeServer || log.serverId === props.activeServer.id)
  )
})

function toggleFilter(filter: string) {
  const idx = filters.value.indexOf(filter)
  if (idx === -1) {
    filters.value.push(filter)
  } else {
    filters.value.splice(idx, 1)
  }
}

function clearLogs() {
  emit('clear')
}

// Auto-scroll when new logs come in
watch(filteredLogs, () => {
  if (autoScroll.value) {
    nextTick(() => {
      if (consoleContainer.value) {
        consoleContainer.value.scrollTop = consoleContainer.value.scrollHeight
      }
    })
  }
})
</script>

<template>
  <div class="console-view">
    <h1 class="gradient-text">{{ t('console.liveConsole') }}</h1>

    <!-- No server selected -->
    <div v-if="!activeServer" class="empty-msg">
      {{ t('console.selectServer') }}
    </div>

    <!-- Console Card -->
    <div v-else class="glass-card console-card">
      <div class="console-toolbar">
        <div class="console-info">
          <span class="console-server">{{ activeServer.id?.slice(0, 12) }}</span>
          <span class="console-count">{{ filteredLogs.length }} {{ t('console.lines') }}</span>
        </div>

        <div class="console-controls">
          <!-- Stream Filters -->
          <div class="filter-group">
            <button
              :class="['filter-btn', { active: filters.includes('stdout') }]"
              @click="toggleFilter('stdout')"
            >
              stdout
            </button>
            <button
              :class="['filter-btn', { active: filters.includes('stderr') }]"
              @click="toggleFilter('stderr')"
            >
              stderr
            </button>
            <button
              :class="['filter-btn', { active: filters.includes('system') }]"
              @click="toggleFilter('system')"
            >
              system
            </button>
          </div>

          <!-- Auto-scroll toggle -->
          <button
            :class="['toggle-btn', { active: autoScroll }]"
            @click="autoScroll = !autoScroll"
          >
            {{ autoScroll ? '⏸' : '▶' }} Auto-scroll
          </button>

          <!-- Clear button -->
          <button class="clear-btn" @click="clearLogs">
            {{ t('common.clear') }}
          </button>
        </div>
      </div>

      <!-- Console Body -->
      <div ref="consoleContainer" class="console-body">
        <!-- Empty state -->
        <div v-if="filteredLogs.length === 0" class="console-empty">
          <div class="empty-icon">📝</div>
          <p>No logs yet. Logs will appear here in real-time.</p>
          <small>Deploy an application or perform actions to see logs</small>
        </div>

        <!-- Log lines -->
        <div
          v-for="(log, idx) in filteredLogs"
          :key="idx"
          :class="['console-line', log.stream, log.type]"
        >
          <span class="console-timestamp">
            {{ new Date(log.timestamp).toLocaleTimeString() }}
          </span>
          <span class="console-stream">{{ log.stream }}</span>
          <span class="console-content">{{ log.data }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.console-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.gradient-text {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 24px;
}

.empty-msg {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: 1rem;
}

.console-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.console-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--surface-border);
  flex-wrap: wrap;
  gap: 12px;
}

.console-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.console-server {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-main);
  font-weight: 600;
}

.console-count {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.console-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  background: var(--bg-color);
  border-radius: 6px;
  padding: 2px;
}

.filter-btn {
  padding: 6px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--font-mono);
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.filter-btn.active {
  background: var(--surface-color);
  color: var(--text-main);
}

.filter-btn:hover:not(.active) {
  color: var(--text-main);
}

.toggle-btn {
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--surface-border);
  background: var(--surface-color);
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.clear-btn {
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--surface-border);
  background: var(--surface-color);
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error-color);
  color: var(--error-color);
}

.console-body {
  flex: 1;
  overflow-y: auto;
  background: #0d1117;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.6;
}

.console-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: #6e7681;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 16px;
}

.console-empty p {
  margin: 0 0 8px;
}

.console-empty small {
  font-size: 0.75rem;
  opacity: 0.7;
}

.console-line {
  display: flex;
  gap: 12px;
  padding: 2px 0;
}

.console-timestamp {
  color: #6e7681;
  flex-shrink: 0;
}

.console-stream {
  color: #8b949e;
  flex-shrink: 0;
  min-width: 50px;
}

.console-content {
  color: #c9d1d9;
  word-break: break-all;
}

/* Stream colors */
.console-line.stdout .console-stream {
  color: #7ee787;
}

.console-line.stderr .console-stream {
  color: #f85149;
}

.console-line.system .console-stream {
  color: #58a6ff;
}

/* Responsive */
@media (max-width: 768px) {
  .console-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .console-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
