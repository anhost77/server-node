import { ref } from 'vue'
import { useApi } from './useApi'
import { useModal } from './useModal'

// MCP state (singleton)
const mcpTokens = ref<any[]>([])
const showNewTokenModal = ref(false)
const newlyGeneratedToken = ref<string | null>(null)
const newTokenName = ref('')

export function useMcp() {
  const { request, baseUrl } = useApi()
  const { showAlert, showConfirm } = useModal()

  async function loadMcpTokens() {
    try {
      const res = await fetch(`${baseUrl}/api/mcp-tokens`, { credentials: 'include' })
      const data = await res.json()
      mcpTokens.value = data.tokens || []
    } catch (e) {
      console.error('Failed to load MCP tokens:', e)
    }
  }

  async function generateMcpToken() {
    try {
      const res = await fetch(`${baseUrl}/api/mcp-tokens`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.value || 'Default MCP Token' })
      })
      const data = await res.json()
      newlyGeneratedToken.value = data.token
      showNewTokenModal.value = true
      newTokenName.value = ''
      loadMcpTokens()
    } catch (e) {
      showAlert('Error', 'Failed to generate token', 'error')
    }
  }

  async function revokeMcpToken(tokenId: string) {
    showConfirm('Revoke Token', 'MCP connections using this token will stop working. Continue?', async () => {
      try {
        await fetch(`${baseUrl}/api/mcp-tokens/${tokenId}`, {
          method: 'DELETE',
          credentials: 'include'
        })
        showAlert('Token Revoked', 'The token has been revoked', 'info')
        loadMcpTokens()
      } catch (e) {
        showAlert('Error', 'Failed to revoke token', 'error')
      }
    })
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token)
    showAlert('Copied!', 'Token copied to clipboard', 'info')
  }

  function closeTokenModal() {
    showNewTokenModal.value = false
    newlyGeneratedToken.value = null
  }

  function copyMcpConfig() {
    const config = JSON.stringify({
      mcpServers: {
        serverflow: {
          command: 'npx',
          args: ['-y', 'serverflow-mcp@latest'],
          env: {
            SERVERFLOW_API_KEY: 'your-token-here',
            SERVERFLOW_URL: baseUrl
          }
        }
      }
    }, null, 2)
    navigator.clipboard.writeText(config)
    showAlert('Copied!', 'MCP configuration copied to clipboard', 'info')
  }

  return {
    // State
    mcpTokens,
    showNewTokenModal,
    newlyGeneratedToken,
    newTokenName,
    // Functions
    loadMcpTokens,
    generateMcpToken,
    revokeMcpToken,
    copyToken,
    closeTokenModal,
    copyMcpConfig
  }
}
