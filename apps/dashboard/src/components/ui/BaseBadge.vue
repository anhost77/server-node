<script setup lang="ts">
type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral'
type BadgeSize = 'sm' | 'md'

interface Props {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  pulse?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'neutral',
  size: 'md',
  dot: false,
  pulse: false
})
</script>

<template>
  <span
    :class="[
      'base-badge',
      `variant-${variant}`,
      `size-${size}`,
      { 'with-dot': dot, pulse }
    ]"
  >
    <span v-if="dot" class="dot" />
    <slot />
  </span>
</template>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 99px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Sizes */
.size-sm {
  padding: 2px 8px;
  font-size: 0.65rem;
}

.size-md {
  padding: 4px 12px;
  font-size: 0.75rem;
}

/* Dot indicator */
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

/* Variants */
.variant-success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.variant-success .dot {
  background: var(--success-color);
  box-shadow: 0 0 8px var(--success-color);
}

.variant-error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.variant-error .dot {
  background: var(--error-color);
}

.variant-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.variant-warning .dot {
  background: #f59e0b;
}

.variant-info {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.variant-info .dot {
  background: #3b82f6;
}

.variant-neutral {
  background: rgba(100, 116, 139, 0.1);
  color: var(--text-muted);
  border: 1px solid rgba(100, 116, 139, 0.2);
}

.variant-neutral .dot {
  background: var(--text-muted);
}

/* Pulse animation */
.pulse .dot {
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
