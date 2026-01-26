import { ref, readonly } from 'vue'
import { useI18n } from 'vue-i18n'

export type ModalType = 'info' | 'confirm' | 'error' | 'input'

export interface ModalState {
  show: boolean
  title: string
  message: string
  type: ModalType
  inputValue: string
  inputPlaceholder: string
  onConfirm?: (value?: string) => void
}

// Singleton state (shared across all components)
const modalState = ref<ModalState>({
  show: false,
  title: '',
  message: '',
  type: 'info',
  inputValue: '',
  inputPlaceholder: ''
})

export function useModal() {
  const { t } = useI18n()

  /**
   * Show an info/error alert modal
   */
  function showAlert(title: string, message: string, type: 'info' | 'error' = 'info') {
    modalState.value = {
      show: true,
      title,
      message,
      type,
      inputValue: '',
      inputPlaceholder: ''
    }
  }

  /**
   * Show a confirmation modal with callback
   */
  function showConfirm(title: string, message: string, onConfirm: () => void) {
    modalState.value = {
      show: true,
      title,
      message,
      type: 'confirm',
      inputValue: '',
      inputPlaceholder: '',
      onConfirm
    }
  }

  /**
   * Show an input modal with callback
   */
  function showInput(
    title: string,
    message: string,
    placeholder: string,
    onConfirm: (value?: string) => void
  ) {
    modalState.value = {
      show: true,
      title,
      message,
      type: 'input',
      inputValue: '',
      inputPlaceholder: placeholder,
      onConfirm
    }
  }

  /**
   * Close the modal
   */
  function closeModal() {
    modalState.value.show = false
  }

  /**
   * Handle modal confirmation
   */
  function handleConfirm() {
    if (modalState.value.onConfirm) {
      modalState.value.onConfirm(modalState.value.inputValue)
    }
    closeModal()
  }

  /**
   * Update input value
   */
  function setInputValue(value: string) {
    modalState.value.inputValue = value
  }

  return {
    modal: readonly(modalState),
    modalState,
    showAlert,
    showConfirm,
    showInput,
    closeModal,
    handleConfirm,
    setInputValue
  }
}
