<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSupport } from '@/composables'

const { t } = useI18n()
const {
  supportTickets,
  selectedTicket,
  ticketMessages,
  ticketAttachments,
  showNewTicketModal,
  newTicketForm,
  newMessage,
  sendingMessage,
  uploadingFile,
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
  formatFileSize
} = useSupport()

const chatMessagesRef = ref<HTMLElement | null>(null)

watch(ticketMessages, () => {
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  })
}, { deep: true })

function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getStatusColor(status: string) {
  const s = getTicketStatusClass(status)
  if (s === 'status-open') return 'bg-blue-100 text-blue-700'
  if (s === 'status-pending') return 'bg-amber-100 text-amber-700'
  if (s === 'status-progress') return 'bg-violet-100 text-violet-700'
  if (s === 'status-resolved') return 'bg-emerald-100 text-emerald-700'
  return 'bg-slate-100 text-slate-500'
}

function getStatusDot(status: string) {
  const s = getTicketStatusClass(status)
  if (s === 'status-open') return 'bg-blue-500'
  if (s === 'status-pending') return 'bg-amber-500'
  if (s === 'status-progress') return 'bg-violet-500'
  if (s === 'status-resolved') return 'bg-emerald-500'
  return 'bg-slate-400'
}

function getPriorityColor(priority: string) {
  const p = getPriorityClass(priority)
  if (p === 'priority-urgent') return 'bg-red-100 text-red-700'
  if (p === 'priority-high') return 'bg-orange-100 text-orange-700'
  if (p === 'priority-normal') return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-500'
}
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-140px)] min-h-[600px]">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ t('support.title') }}</h1>
        <p class="text-slate-500 text-sm mt-1">{{ t('support.subtitle') }}</p>
      </div>
      <button class="premium-btn flex items-center gap-2" @click="showNewTicketModal = true">
        <span class="text-lg">+</span>
        <span>{{ t('support.newTicket') }}</span>
      </button>
    </div>

    <!-- Layout 2 colonnes -->
    <div class="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 flex-1 min-h-0">

      <!-- Panneau tickets (gauche) -->
      <div class="glass-card flex flex-col overflow-hidden max-h-80 lg:max-h-full" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
        <!-- Header -->
        <div class="flex justify-between items-center p-5 border-b border-slate-200">
          <h3 class="font-semibold text-slate-800">{{ t('support.myTickets') }}</h3>
          <span class="bg-violet-500 text-white px-3 py-1 rounded-full text-xs font-bold">
            {{ supportTickets.length }}
          </span>
        </div>

        <!-- Etat vide -->
        <div v-if="supportTickets.length === 0" class="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div class="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p class="font-semibold text-slate-800">{{ t('support.noTickets') }}</p>
          <p class="text-slate-500 text-sm">{{ t('support.noTicketsDesc') }}</p>
        </div>

        <!-- Liste tickets -->
        <div v-else class="flex-1 overflow-y-auto p-4 space-y-3">
          <div
            v-for="ticket in supportTickets"
            :key="ticket.id"
            class="relative p-5 rounded-xl border-2 cursor-pointer transition-all"
            :class="selectedTicket?.id === ticket.id
              ? 'bg-violet-50 border-violet-300'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'"
            @click="loadTicketDetails(ticket.id)"
          >
            <!-- Indicateur selection -->
            <div
              v-if="selectedTicket?.id === ticket.id"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-violet-500 rounded-r-full"
            />

            <!-- Status + unread -->
            <div class="flex justify-between items-center mb-3">
              <span
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                :class="getStatusColor(ticket.status)"
              >
                <span class="w-2 h-2 rounded-full" :class="getStatusDot(ticket.status)" />
                {{ ticket.status }}
              </span>
              <span
                v-if="ticket.unreadCount > 0"
                class="bg-violet-500 text-white px-3 py-1 rounded-full text-xs font-bold"
              >
                {{ ticket.unreadCount }} {{ t('support.newLabel') }}
              </span>
            </div>

            <!-- Sujet -->
            <div class="font-semibold text-slate-800 mb-3 truncate">{{ ticket.subject }}</div>

            <!-- Meta -->
            <div class="flex items-center gap-3 text-xs text-slate-400">
              <span class="bg-slate-100 text-slate-600 px-3 py-1 rounded-md">
                {{ getCategoryLabel(ticket.category) }}
              </span>
              <span>{{ formatDate(ticket.lastMessageAt || ticket.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Panneau chat (droite) -->
      <div class="glass-card flex flex-col overflow-hidden" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">

        <!-- Etat vide -->
        <div v-if="!selectedTicket" class="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div class="w-20 h-20 bg-violet-100 rounded-2xl flex items-center justify-center mb-4">
            <svg class="w-10 h-10 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p class="font-bold text-slate-800 text-lg">{{ t('support.selectConversation') }}</p>
          <p class="text-slate-500 text-sm max-w-xs">{{ t('support.selectConversationDesc') }}</p>
        </div>

        <!-- Ticket selectionne -->
        <template v-else>
          <!-- Header chat -->
          <div class="p-5 border-b border-slate-200 bg-slate-50">
            <h3 class="text-lg font-bold text-slate-900 mb-4">{{ selectedTicket.subject }}</h3>
            <div class="flex flex-wrap gap-3">
              <span
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                :class="getStatusColor(selectedTicket.status)"
              >
                <span class="w-2 h-2 rounded-full" :class="getStatusDot(selectedTicket.status)" />
                {{ selectedTicket.status }}
              </span>
              <span
                class="px-3 py-1.5 rounded-full text-xs font-semibold"
                :class="getPriorityColor(selectedTicket.priority)"
              >
                {{ selectedTicket.priority }}
              </span>
              <span class="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-medium">
                {{ getCategoryLabel(selectedTicket.category) }}
              </span>
            </div>
          </div>

          <!-- Messages -->
          <div ref="chatMessagesRef" class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6">
            <div
              v-for="msg in ticketMessages"
              :key="msg.id"
              class="flex w-full"
              :class="msg.senderType === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div class="max-w-[70%] min-w-0">
                <!-- Nom expediteur -->
                <div
                  class="text-xs font-semibold mb-2"
                  :class="{
                    'text-right text-violet-600': msg.senderType === 'user',
                    'text-emerald-600': msg.senderType === 'ai',
                    'text-slate-500': msg.senderType !== 'user' && msg.senderType !== 'ai'
                  }"
                >
                  <template v-if="msg.senderType === 'user'">{{ t('support.senderYou') }}</template>
                  <template v-else-if="msg.senderType === 'ai'">{{ t('support.senderAi') }}</template>
                  <template v-else-if="msg.senderType === 'system'">{{ t('support.senderSystem') }}</template>
                  <template v-else>{{ msg.senderName || t('support.senderSupport') }}</template>
                </div>

                <!-- Bulle message -->
                <div
                  class="rounded-2xl px-5 py-4"
                  :class="{
                    'bg-violet-500 text-white rounded-br-sm': msg.senderType === 'user',
                    'bg-emerald-50 border border-emerald-200 rounded-bl-sm': msg.senderType === 'ai',
                    'bg-slate-100 border border-slate-200 rounded-bl-sm': msg.senderType !== 'user' && msg.senderType !== 'ai'
                  }"
                >
                  <div
                    class="text-sm leading-relaxed whitespace-pre-wrap break-words"
                    :class="msg.senderType === 'user' ? 'text-white' : 'text-slate-700'"
                  >
                    {{ msg.content }}
                  </div>
                </div>

                <!-- Timestamp -->
                <div
                  class="text-xs mt-2 text-slate-400"
                  :class="msg.senderType === 'user' ? 'text-right' : 'text-left'"
                >
                  {{ formatDate(msg.createdAt) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Pieces jointes -->
          <div v-if="ticketAttachments.length > 0" class="p-5 border-t border-slate-200 bg-slate-50">
            <div class="flex items-center gap-3 text-sm text-slate-600 mb-4">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span class="font-semibold">{{ t('support.attachments') }}</span>
              <span class="text-slate-400">({{ ticketAttachments.length }})</span>
            </div>
            <div class="flex flex-wrap gap-3">
              <button
                v-for="att in ticketAttachments"
                :key="att.id"
                class="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                @click="downloadAttachment(att)"
              >
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div class="flex flex-col items-start gap-0.5">
                  <span class="text-sm text-slate-700 font-medium max-w-32 truncate">{{ att.fileName }}</span>
                  <span class="text-xs text-slate-400">{{ formatFileSize(att.fileSize) }}</span>
                </div>
                <svg class="w-5 h-5 text-slate-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Zone saisie -->
          <div v-if="selectedTicket.status !== 'closed'" class="p-5 border-t border-slate-200">
            <div class="flex gap-4 items-end">
              <textarea
                v-model="newMessage"
                :placeholder="t('support.typeMessage')"
                rows="1"
                class="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                @keydown.enter.exact.prevent="sendTicketMessage"
                @input="autoResizeTextarea"
              />
              <label
                class="w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                :class="{ 'opacity-50': uploadingFile }"
              >
                <input type="file" multiple hidden :disabled="uploadingFile" accept="image/*,.pdf,.txt,.zip" @change="uploadTicketFile" />
                <svg v-if="!uploadingFile" class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <div v-else class="w-5 h-5 border-2 border-slate-300 border-t-violet-500 rounded-full animate-spin" />
              </label>
              <button
                class="w-12 h-12 flex items-center justify-center rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :class="newMessage.trim() ? 'bg-violet-500 text-white hover:bg-violet-600' : 'bg-slate-200 text-slate-400'"
                :disabled="sendingMessage || !newMessage.trim()"
                @click="sendTicketMessage"
              >
                <div v-if="sendingMessage" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
            <p class="mt-3 text-xs text-slate-400">{{ t('support.inputHint') }}</p>
          </div>

          <!-- Ticket ferme -->
          <div v-else class="m-4 flex items-center justify-center gap-3 py-4 px-5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span class="text-sm font-medium">{{ t('support.ticketClosed') }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Modal nouveau ticket -->
    <Teleport to="body">
      <div
        v-if="showNewTicketModal"
        class="modal-overlay"
        @click.self="showNewTicketModal = false"
      >
        <div class="glass-card w-full max-w-xl mx-4 max-h-[90vh] overflow-hidden">
          <!-- Header modal -->
          <div class="flex justify-between items-center p-5 border-b border-slate-200">
            <h3 class="text-lg font-bold text-slate-900">{{ t('support.createTicket') }}</h3>
            <button
              class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              @click="showNewTicketModal = false"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body modal -->
          <div class="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="form-group">
                <label>{{ t('support.category') }}</label>
                <select v-model="newTicketForm.category">
                  <option value="general">{{ t('support.categories.general') }}</option>
                  <option value="billing">{{ t('support.categories.billing') }}</option>
                  <option value="technical">{{ t('support.categories.technical') }}</option>
                  <option value="feature_request">{{ t('support.categories.featureRequest') }}</option>
                  <option value="bug_report">{{ t('support.categories.bugReport') }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>{{ t('support.priority') }}</label>
                <select v-model="newTicketForm.priority">
                  <option value="low">{{ t('support.priorities.low') }}</option>
                  <option value="normal">{{ t('support.priorities.normal') }}</option>
                  <option value="high">{{ t('support.priorities.high') }}</option>
                  <option value="urgent">{{ t('support.priorities.urgent') }}</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>{{ t('support.subject') }}</label>
              <input
                v-model="newTicketForm.subject"
                type="text"
                :placeholder="t('support.subjectPlaceholder')"
              />
            </div>

            <div class="form-group">
              <label>{{ t('support.description') }}</label>
              <textarea
                v-model="newTicketForm.message"
                rows="5"
                :placeholder="t('support.descriptionPlaceholder')"
              />
            </div>
          </div>

          <!-- Footer modal -->
          <div class="flex justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50">
            <button class="secondary-btn" @click="showNewTicketModal = false">
              {{ t('common.cancel') }}
            </button>
            <button
              class="premium-btn"
              :disabled="!newTicketForm.subject.trim() || !newTicketForm.message.trim()"
              @click="createSupportTicket"
            >
              {{ t('support.createTicket') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style>
/* Force glass-card styles in this view */
.glass-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 16px !important;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07) !important;
}
</style>
