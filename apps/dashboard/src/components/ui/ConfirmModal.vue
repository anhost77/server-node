<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

const { t } = useI18n()

interface Props {
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger' | 'warning'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'default',
  loading: false
})

const emit = defineEmits<{
  close: []
  confirm: []
}>()

const confirmBtnClasses = {
  default: 'bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700',
  danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
  warning: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
}
</script>

<template>
  <BaseModal
    :show="show"
    :title="title"
    :variant="variant"
    size="sm"
    :loading="loading"
    @close="emit('close')"
  >
    <p class="text-white/70 m-0">{{ message }}</p>

    <template #footer>
      <button
        type="button"
        :disabled="loading"
        class="px-4 py-2.5 rounded-lg font-medium text-white/80
               bg-white/5 hover:bg-white/10 border border-white/10
               transition-all duration-200
               disabled:opacity-50 disabled:cursor-not-allowed"
        @click="emit('close')"
      >
        {{ cancelText }}
      </button>
      <button
        type="button"
        :disabled="loading"
        :class="[
          'px-4 py-2.5 rounded-lg font-medium text-white',
          'transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          confirmBtnClasses[variant]
        ]"
        @click="emit('confirm')"
      >
        <span v-if="loading" class="inline-flex items-center gap-2">
          <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Loading...
        </span>
        <span v-else>{{ confirmText }}</span>
      </button>
    </template>
  </BaseModal>
</template>
