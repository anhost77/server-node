<script setup lang="ts">
import { computed } from 'vue'

type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea'

interface Props {
  modelValue: string | number
  label?: string
  placeholder?: string
  type?: InputType
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  error?: string
  help?: string
  rows?: number
  maxlength?: number
  autocomplete?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  readonly: false,
  required: false,
  rows: 3
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  keyup: [event: KeyboardEvent]
}>()

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <div class="form-group" :class="{ 'has-error': error }">
    <label v-if="label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>

    <textarea
      v-if="type === 'textarea'"
      v-model="inputValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :rows="rows"
      :maxlength="maxlength"
      :class="{ error: !!error }"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
      @keyup="emit('keyup', $event)"
    />

    <input
      v-else
      v-model="inputValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :maxlength="maxlength"
      :autocomplete="autocomplete"
      :class="{ error: !!error }"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
      @keyup="emit('keyup', $event)"
    />

    <small v-if="error" class="error-message">{{ error }}</small>
    <small v-else-if="help" class="form-help">{{ help }}</small>
  </div>
</template>

<style scoped>
/* Base styles inherited from index.css .form-group */

.required {
  color: var(--error-color);
  margin-left: 2px;
}

.has-error input,
.has-error textarea,
input.error,
textarea.error {
  border-color: var(--error-color) !important;
}

.has-error input:focus,
.has-error textarea:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
}

.error-message {
  color: var(--error-color);
  font-size: 0.8rem;
}

input:disabled,
textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--surface-color);
}

input:read-only,
textarea:read-only {
  background: var(--surface-color);
}
</style>
