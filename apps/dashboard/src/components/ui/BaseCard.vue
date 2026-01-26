<script setup lang="ts">
interface Props {
  hoverable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  noBorder?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hoverable: true,
  padding: 'md',
  noBorder: false
})
</script>

<template>
  <div
    :class="[
      'glass-card',
      `padding-${padding}`,
      { hoverable, 'no-border': noBorder }
    ]"
  >
    <div v-if="$slots.header" class="card-header">
      <slot name="header" />
    </div>

    <div class="card-body">
      <slot />
    </div>

    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
/* Base glass-card styles inherited from index.css */

.glass-card:not(.hoverable) {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
}

.glass-card:not(.hoverable):hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  transform: none;
}

.no-border {
  border: none;
}

/* Padding variants */
.padding-none {
  padding: 0;
}

.padding-none .card-body {
  padding: 0;
}

.padding-sm {
  padding: 0;
}

.padding-sm .card-body {
  padding: 12px;
}

.padding-md {
  padding: 0;
}

.padding-md .card-body {
  padding: 20px;
}

.padding-lg {
  padding: 0;
}

.padding-lg .card-body {
  padding: 32px;
}

/* Header */
.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Footer */
.card-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

/* Responsive */
@media (max-width: 600px) {
  .padding-md .card-body {
    padding: 16px;
  }

  .padding-lg .card-body {
    padding: 20px;
  }

  .card-header,
  .card-footer {
    padding: 12px 16px;
  }
}
</style>
