import { ref, shallowRef } from 'vue'
import { useApi } from './useApi'
import type { WSMessage, WSMessageType } from '@/types'

type MessageHandler = (message: any) => void

// Singleton state
const isConnected = ref(false)
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 5
const reconnectDelay = 3000

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

// Message handlers registry
const messageHandlers = new Map<WSMessageType, Set<MessageHandler>>()

export function useWebSocket() {
  const { wsUrl } = useApi()

  /**
   * Connect to WebSocket server
   */
  function connect(onConnected?: () => void) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return
    }

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      isConnected.value = true
      reconnectAttempts.value = 0
      onConnected?.()
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        handleMessage(msg)
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.onclose = () => {
      isConnected.value = false
      scheduleReconnect()
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
    isConnected.value = false
  }

  /**
   * Schedule a reconnection attempt
   */
  function scheduleReconnect() {
    if (reconnectAttempts.value >= maxReconnectAttempts) {
      console.warn('Max reconnect attempts reached')
      return
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    reconnectTimer = setTimeout(() => {
      reconnectAttempts.value++
      connect()
    }, reconnectDelay)
  }

  /**
   * Handle incoming message and dispatch to handlers
   */
  function handleMessage(msg: WSMessage) {
    const type = msg.type as WSMessageType
    const handlers = messageHandlers.get(type)

    if (handlers) {
      handlers.forEach(handler => handler(msg))
    }
  }

  /**
   * Register a handler for a specific message type
   * Returns unsubscribe function
   */
  function onMessage(type: WSMessageType, handler: MessageHandler): () => void {
    if (!messageHandlers.has(type)) {
      messageHandlers.set(type, new Set())
    }
    messageHandlers.get(type)!.add(handler)

    // Return unsubscribe function
    return () => {
      const handlers = messageHandlers.get(type)
      if (handlers) {
        handlers.delete(handler)
      }
    }
  }

  /**
   * Register handlers for multiple message types
   */
  function onMessages(
    handlers: Partial<Record<WSMessageType, MessageHandler>>
  ): () => void {
    const unsubscribers: (() => void)[] = []

    for (const [type, handler] of Object.entries(handlers)) {
      if (handler) {
        unsubscribers.push(onMessage(type as WSMessageType, handler))
      }
    }

    // Return combined unsubscribe function
    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }

  /**
   * Send a message to the WebSocket server
   */
  function send(message: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, message not sent:', message)
    }
  }

  /**
   * Get the raw WebSocket instance
   */
  function getSocket(): WebSocket | null {
    return ws
  }

  return {
    isConnected,
    reconnectAttempts,
    connect,
    disconnect,
    onMessage,
    onMessages,
    send,
    getSocket
  }
}
