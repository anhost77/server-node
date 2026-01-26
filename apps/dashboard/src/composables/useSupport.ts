import { ref } from 'vue'
import { useApi } from './useApi'
import { useModal } from './useModal'

// Support state (singleton)
const supportTickets = ref<any[]>([])
const selectedTicket = ref<any>(null)
const ticketMessages = ref<any[]>([])
const ticketAttachments = ref<any[]>([])
const showNewTicketModal = ref(false)
const newTicketForm = ref({
  subject: '',
  message: '',
  category: 'general',
  priority: 'normal'
})
const newMessage = ref('')
const sendingMessage = ref(false)
const uploadingFile = ref(false)
const supportMetrics = ref<any>(null)

// Admin Support state
const adminTickets = ref<any[]>([])
const adminTicketFilters = ref({
  status: '',
  category: '',
  priority: ''
})
const cannedResponses = ref<any[]>([])

export function useSupport() {
  const { request, baseUrl } = useApi()
  const { showAlert } = useModal()

  async function loadSupportTickets() {
    try {
      supportTickets.value = await request('/api/support/tickets') || []
    } catch (e) {
      console.error('Failed to load support tickets:', e)
    }
  }

  async function loadTicketDetails(ticketId: string) {
    try {
      const data = await request(`/api/support/tickets/${ticketId}`)
      if (data) {
        selectedTicket.value = data.ticket
        ticketMessages.value = data.messages || []
        ticketAttachments.value = data.attachments || []
      }
    } catch (e) {
      console.error('Failed to load ticket details:', e)
    }
  }

  async function createSupportTicket() {
    if (!newTicketForm.value.subject.trim() || !newTicketForm.value.message.trim()) {
      showAlert('Error', 'Subject and message are required', 'error')
      return
    }

    try {
      const res = await request('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicketForm.value)
      })

      if (res?.success) {
        showNewTicketModal.value = false
        newTicketForm.value = { subject: '', message: '', category: 'general', priority: 'normal' }
        await loadSupportTickets()
        await loadTicketDetails(res.ticketId)
        if (res.hasAutoResponse) {
          showAlert('Info', 'An automated response has been added to your ticket.', 'info')
        }
      } else {
        showAlert('Error', res?.error || 'Failed to create ticket', 'error')
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to create ticket', 'error')
    }
  }

  async function sendTicketMessage() {
    if (!newMessage.value.trim() || !selectedTicket.value) return

    sendingMessage.value = true
    try {
      const res = await request(`/api/support/tickets/${selectedTicket.value.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.value })
      })

      if (res?.success) {
        newMessage.value = ''
        await loadTicketDetails(selectedTicket.value.id)
        await loadSupportTickets()
      } else {
        showAlert('Error', res?.error || 'Failed to send message', 'error')
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to send message', 'error')
    } finally {
      sendingMessage.value = false
    }
  }

  function autoResizeTextarea(event: Event) {
    const textarea = event.target as HTMLTextAreaElement
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  async function uploadTicketFile(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files?.length || !selectedTicket.value) return

    uploadingFile.value = true
    try {
      const formData = new FormData()
      const filesArray = Array.from(input.files)
      for (const file of filesArray) {
        formData.append('files', file)
      }

      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.value.id}/attachments`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      const data = await res.json()
      if (data.success) {
        await loadTicketDetails(selectedTicket.value.id)
        showAlert('Success', `${data.files.length} file(s) uploaded`, 'info')
      } else {
        showAlert('Error', data.error || 'Failed to upload files', 'error')
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to upload files', 'error')
    } finally {
      uploadingFile.value = false
      input.value = ''
    }
  }

  function downloadAttachment(attachment: any) {
    window.open(`${baseUrl}/api/support/attachments/${attachment.id}`, '_blank')
  }

  function getTicketStatusClass(status: string): string {
    switch (status) {
      case 'open': return 'status-open'
      case 'pending': return 'status-pending'
      case 'in_progress': return 'status-progress'
      case 'resolved': return 'status-resolved'
      case 'closed': return 'status-closed'
      default: return ''
    }
  }

  function getPriorityClass(priority: string): string {
    switch (priority) {
      case 'urgent': return 'priority-urgent'
      case 'high': return 'priority-high'
      case 'normal': return 'priority-normal'
      case 'low': return 'priority-low'
      default: return ''
    }
  }

  function getCategoryLabel(category: string): string {
    switch (category) {
      case 'general': return 'General'
      case 'billing': return 'Billing'
      case 'technical': return 'Technical'
      case 'feature_request': return 'Feature Request'
      case 'bug_report': return 'Bug Report'
      default: return category
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Admin Support Functions
  async function loadAdminTickets() {
    try {
      const params = new URLSearchParams()
      if (adminTicketFilters.value.status) params.append('status', adminTicketFilters.value.status)
      if (adminTicketFilters.value.category) params.append('category', adminTicketFilters.value.category)
      if (adminTicketFilters.value.priority) params.append('priority', adminTicketFilters.value.priority)

      const url = `/api/admin/support/tickets${params.toString() ? '?' + params.toString() : ''}`
      adminTickets.value = await request(url) || []
    } catch (e) {
      console.error('Failed to load admin tickets:', e)
    }
  }

  async function loadSupportMetrics() {
    try {
      supportMetrics.value = await request('/api/admin/support/metrics')
    } catch (e) {
      console.error('Failed to load support metrics:', e)
    }
  }

  async function loadCannedResponses() {
    try {
      cannedResponses.value = await request('/api/admin/support/canned-responses') || []
    } catch (e) {
      console.error('Failed to load canned responses:', e)
    }
  }

  async function updateTicketStatus(ticketId: string, status: string) {
    try {
      await request(`/api/admin/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      await loadAdminTickets()
      if (selectedTicket.value?.id === ticketId) {
        await loadTicketDetails(ticketId)
      }
    } catch (e) {
      showAlert('Error', 'Failed to update ticket status', 'error')
    }
  }

  async function assignTicket(ticketId: string, agentId: string) {
    try {
      await request(`/api/admin/support/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      })
      await loadAdminTickets()
    } catch (e) {
      showAlert('Error', 'Failed to assign ticket', 'error')
    }
  }

  return {
    // State
    supportTickets,
    selectedTicket,
    ticketMessages,
    ticketAttachments,
    showNewTicketModal,
    newTicketForm,
    newMessage,
    sendingMessage,
    uploadingFile,
    supportMetrics,
    adminTickets,
    adminTicketFilters,
    cannedResponses,
    // Functions
    loadSupportTickets,
    loadTicketDetails,
    createSupportTicket,
    sendTicketMessage,
    autoResizeTextarea,
    uploadTicketFile,
    downloadAttachment,
    getTicketStatusClass,
    getPriorityClass,
    getCategoryLabel,
    formatFileSize,
    loadAdminTickets,
    loadSupportMetrics,
    loadCannedResponses,
    updateTicketStatus,
    assignTicket
  }
}
