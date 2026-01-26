export interface Ticket {
  id: string
  userId: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  createdAt: number
  updatedAt: number
  // Joined fields
  userEmail?: string
  userName?: string
}

export type TicketCategory = 'general' | 'billing' | 'technical' | 'feature'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'

export interface TicketMessage {
  id: string
  ticketId: string
  userId: string
  content: string
  isInternal: boolean
  isFromAdmin: boolean
  createdAt: number
  // Joined fields
  userName?: string
  userEmail?: string
}

export interface TicketAttachment {
  id: string
  ticketId: string
  messageId?: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: number
}

export interface NewTicketForm {
  subject: string
  message: string
  category: TicketCategory
  priority: TicketPriority
}

export interface CannedResponse {
  id: string
  title: string
  content: string
  category: string
  keywords: string
  isAutoResponse: boolean
  sortOrder: number
}

export interface SupportMetrics {
  totalTickets: number
  openTickets: number
  avgResponseTime: number
  resolvedToday: number
}
