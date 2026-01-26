<script setup lang="ts">
type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  size?: SpinnerSize
  color?: string
  text?: string
  fullPage?: boolean
  overlay?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  fullPage: false,
  overlay: false
})
</script>

<template>
  <div
    :class="[
      'loading-container',
      { 'full-page': fullPage, overlay }
    ]"
  >
    <div class="spinner-wrapper">
      <div
        :class="['spinner', `size-${size}`]"
        :style="color ? { borderTopColor: color } : {}"
      />
      <span v-if="text" class="loading-text">{{ text }}</span>
    </div>
  </div>
</template>

<style scoped>
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.full-page {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.overlay {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(4px);
}

.spinner-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner {
  border: 3px solid var(--surface-border);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Sizes */
.size-sm {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.size-md {
  width: 24px;
  height: 24px;
  border-width: 3px;
}

.size-lg {
  width: 36px;
  height: 36px;
  border-width: 3px;
}

.size-xl {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

.loading-text {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 500;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
