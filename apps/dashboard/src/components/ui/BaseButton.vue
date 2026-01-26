<script setup lang="ts">
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button',
  fullWidth: false
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    :type="type"
    :class="[
      'base-button',
      `variant-${variant}`,
      `size-${size}`,
      { loading, 'full-width': fullWidth }
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="spinner" />
    <span class="button-content" :class="{ invisible: loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.base-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}

.base-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.full-width {
  width: 100%;
}

/* Sizes */
.size-sm {
  padding: 8px 16px;
  font-size: 0.85rem;
}

.size-md {
  padding: 12px 24px;
  font-size: 0.95rem;
}

.size-lg {
  padding: 14px 32px;
  font-size: 1rem;
}

/* Variants */
.variant-primary {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: #fff;
  border: none;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.variant-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.variant-primary:active:not(:disabled) {
  transform: translateY(0);
}

.variant-secondary {
  background: var(--surface-color);
  color: var(--text-main);
  border: 1px solid var(--surface-border);
}

.variant-secondary:hover:not(:disabled) {
  background: var(--bg-color);
  border-color: var(--text-muted);
}

.variant-danger {
  background: var(--error-color);
  color: #fff;
  border: none;
}

.variant-danger:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-1px);
}

.variant-ghost {
  background: transparent;
  color: var(--text-main);
  border: none;
}

.variant-ghost:hover:not(:disabled) {
  background: var(--bg-color);
}

/* Loading state */
.spinner {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.invisible {
  visibility: hidden;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Button content */
.button-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
