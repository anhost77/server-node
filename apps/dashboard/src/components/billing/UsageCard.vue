<script setup lang="ts">
import { computed } from 'vue'
import type { UsageItem } from '@/types'

interface Props {
  icon: string
  label: string
  usage: UsageItem
}

const props = defineProps<Props>()

const percentage = computed(() => {
  if (props.usage.limit === -1) return 0
  return Math.min(props.usage.percentage, 100)
})

const statusClass = computed(() => {
  if (props.usage.percentage >= 100) return 'critical'
  if (props.usage.percentage >= 80) return 'warning'
  return ''
})

const limitDisplay = computed(() => {
  return props.usage.limit === -1 ? '∞' : props.usage.limit
})
</script>

<template>
  <div class="usage-card" :class="statusClass">
    <div class="usage-header">
      <span class="usage-icon">{{ icon }}</span>
      <span class="usage-name">{{ label }}</span>
    </div>

    <div class="usage-numbers">
      <span class="usage-current">{{ usage.current }}</span>
      <span class="usage-separator">/</span>
      <span class="usage-max">{{ limitDisplay }}</span>
    </div>

    <div class="usage-bar">
      <div
        class="usage-bar-fill"
        :style="{ width: `${percentage}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.usage-card {
  background: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
}

.usage-card.warning {
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.05);
}

.usage-card.critical {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.05);
}

.usage-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.usage-icon {
  font-size: 1.2rem;
}

.usage-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
}

.usage-numbers {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 12px;
}

.usage-current {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-main);
}

.usage-separator {
  font-size: 1rem;
  color: var(--text-muted);
}

.usage-max {
  font-size: 1rem;
  color: var(--text-muted);
}

.usage-bar {
  height: 6px;
  background: var(--bg-color);
  border-radius: 3px;
  overflow: hidden;
}

.usage-bar-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.usage-card.warning .usage-bar-fill {
  background: #f59e0b;
}

.usage-card.critical .usage-bar-fill {
  background: var(--error-color);
}
</style>
