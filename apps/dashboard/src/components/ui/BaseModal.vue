<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export type ModalVariant = 'default' | 'success' | 'error' | 'warning' | 'danger'
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface Props {
  show: boolean
  title?: string
  size?: ModalSize
  variant?: ModalVariant
  zIndex?: number
  closeOnOverlay?: boolean
  showClose?: boolean
  persistent?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: 'md',
  variant: 'default',
  zIndex: 10000,
  closeOnOverlay: true,
  showClose: true,
  persistent: false,
  loading: false
})

const emit = defineEmits<{
  close: []
  confirm: []
}>()

function handleOverlayClick() {
  if (props.closeOnOverlay && !props.persistent && !props.loading) {
    emit('close')
  }
}

function handleClose() {
  if (!props.persistent && !props.loading) {
    emit('close')
  }
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw]'
}

const variantHeaderClasses: Record<ModalVariant, string> = {
  default: 'border-b border-white/10',
  success: 'border-b border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-transparent',
  error: 'border-b border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent',
  warning: 'border-b border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent',
  danger: 'border-b border-red-600/30 bg-gradient-to-r from-red-600/15 to-transparent'
}

const variantIconClasses: Record<ModalVariant, string> = {
  default: 'text-white/80',
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  danger: 'text-red-500'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 flex items-center justify-center p-4"
        :style="{ zIndex }"
        @click.self="handleOverlayClick"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <!-- Modal Content -->
        <div
          :class="[
            'relative w-full flex flex-col',
            'bg-[#1a1a2e]/95 backdrop-blur-xl',
            'border border-white/10 rounded-2xl shadow-2xl',
            'max-h-[90vh]',
            sizeClasses[size]
          ]"
        >
          <!-- Header -->
          <div
            v-if="title || $slots.header || showClose"
            :class="[
              'flex items-center justify-between px-6 py-5',
              variantHeaderClasses[variant]
            ]"
          >
            <slot name="header">
              <h3 class="m-0 text-xl font-bold text-white">{{ title }}</h3>
            </slot>
            <button
              v-if="showClose && !persistent"
              type="button"
              :disabled="loading"
              class="w-8 h-8 flex items-center justify-center rounded-lg
                     text-white/50 hover:text-white hover:bg-white/10
                     transition-all duration-200 text-2xl leading-none
                     disabled:opacity-50 disabled:cursor-not-allowed"
              @click="handleClose"
            >
              &times;
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-6 py-6">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95);
  opacity: 0;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .modal-enter-active > div:last-child,
  .modal-leave-active > div:last-child {
    margin: 0.5rem;
    max-height: calc(100vh - 1rem);
  }
}
</style>
