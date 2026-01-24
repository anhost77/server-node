<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'

const token = ref<string | null>(null)
const loading = ref(false)
const servers = ref<any[]>([])
const apps = ref<any[]>([])
const proxies = ref<any[]>([])
const auditLogs = ref<any[]>([])
const activeMenu = ref('infrastructure')
const selectedServerId = ref<string | null>(null)

// Console Logs State
const consoleLogs = ref<{ timestamp: number, data: string, stream: string, type: string, serverId: string }[]>([])
const consoleAutoScroll = ref(true)
const consoleFilter = ref<string[]>(['stdout', 'stderr', 'system'])
const consoleContainer = ref<HTMLElement | null>(null)
const consoleContainerMini = ref<HTMLElement | null>(null)
const consoleContainerLarge = ref<HTMLElement | null>(null)
const showLargeConsole = ref(false)

// SSH Assisted Installation State
const connectTab = ref<'quick' | 'assisted'>('quick')
const sshForm = ref({
  host: '',
  port: 22,
  username: 'root',
  password: '',
  privateKey: '',
  authType: 'password' as 'password' | 'key',
  verbose: false
})
const sshSession = ref<{
  id: string | null,
  status: 'idle' | 'connecting' | 'preflight' | 'installing' | 'complete' | 'error',
  step: number,
  totalSteps: number,
  message: string,
  output: string[]
}>({
  id: null,
  status: 'idle',
  step: 0,
  totalSteps: 5,
  message: '',
  output: []
})
let sshWs: WebSocket | null = null
const sshTerminalRef = ref<HTMLElement | null>(null)

// Modal Logic
const showAddAppModal = ref(false)
const newApp = ref({ name: '', repoUrl: '', serverId: '', port: 3000, env: '' })

// Deploy Modal
const showDeployModal = ref(false)
const deployModalApp = ref<any>(null)
const deployModalLogs = ref<{ data: string, stream: string }[]>([])
const deployModalStatus = ref<string>('')
const deployModalContainer = ref<HTMLElement | null>(null)

// Restore Modal
const showRestoreModal = ref(false)
const restoreModalApp = ref<any>(null)
const restoreBranches = ref<any[]>([])
const restoreCommits = ref<any[]>([])
const restoreLoading = ref(false)
const restoreTab = ref<'branches' | 'commits' | 'manual'>('branches')
const restoreManualRef = ref('')

// Service Dropdown
const openServiceMenu = ref<string | null>(null)
function toggleServiceMenu(service: string) {
  openServiceMenu.value = openServiceMenu.value === service ? null : service
}

// Add Domain Modal
const showAddDomainModal = ref(false)
const domainTargetMode = ref<'existing' | 'git'>('existing')
const domainSelectedApp = ref<string>('')
const domainGitUrl = ref('')
const domainAppName = ref('')

// MCP Token Management
const mcpTokens = ref<any[]>([])
const showNewTokenModal = ref(false)
const newlyGeneratedToken = ref<string | null>(null)
const newTokenName = ref('')

const modal = ref<{
  show: boolean,
  title: string,
  message: string,
  type: 'info' | 'confirm' | 'error' | 'input',
  inputValue?: string,
  inputPlaceholder?: string,
  onConfirm?: (value: any) => void
}>({
  show: false,
  title: '',
  message: '',
  type: 'info',
  inputValue: ''
})

function showAlert(title: string, message: string, type: 'info' | 'error' = 'info') {
  modal.value = { show: true, title, message, type }
}

function showConfirm(title: string, message: string, onConfirm: () => void) {
  modal.value = { show: true, title, message, type: 'confirm', onConfirm }
}

function showInput(title: string, message: string, placeholder: string, onConfirm: (val: string) => void) {
  modal.value = { show: true, title, message, type: 'input', inputPlaceholder: placeholder, inputValue: '', onConfirm }
}

// Auth Logic
const user = ref<any>(null)
const authMode = ref<'login' | 'register' | 'forgot'>('login')
const authForm = ref({ email: '', password: '', name: '' })
const authError = ref('')

async function checkAuth() {
  try {
    const res = await request('/api/auth/me');
    if (res && res.id) {
      user.value = res;
      return true;
    }
  } catch (e) {}
  user.value = null;
  return false;
}

async function handleEmailAuth() {
  authError.value = ''
  loading.value = true
  try {
    const endpoint = authMode.value === 'login' ? '/api/auth/login' : '/api/auth/register'
    const res = await request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm.value)
    })
    
    if (res.error) {
      authError.value = res.error
    } else {
      const ok = await checkAuth()
      if (ok) {
        refreshData()
        // Force WS reconnect with new session
        if (ws) ws.close()
        connectWS()
      }
    }
  } catch (e: any) {
    authError.value = 'Connection failed'
  } finally {
    loading.value = false
  }
}

async function logout() {
  await request('/api/auth/logout', { method: 'POST' })
  user.value = null
  ghToken.value = null
  localStorage.removeItem('gh_token')
}

// GitHub Logic
const githubUser = ref('')
const githubRepos = ref<any[]>([])
const loadingRepos = ref(false)
const repoSource = ref<'manual' | 'github'>('manual')
const ghToken = ref<string | null>(localStorage.getItem('gh_token'))

// Check for token in URL callback (legacy support)
const urlParams = new URLSearchParams(window.location.search)
const tokenFromUrl = urlParams.get('gh_token')
if (tokenFromUrl) {
  ghToken.value = tokenFromUrl
  localStorage.setItem('gh_token', tokenFromUrl)
  window.history.replaceState({}, document.title, '/')
  checkAuth() // Fetch user info from session created during callback
}

async function loginWithGithub() {
  window.location.href = `${baseUrl}/api/auth/github/login`;
}

async function fetchGithubRepos() {
  loadingRepos.value = true
  try {
    if (ghToken.value) {
      // Authenticated Request via Proxy
       const res = await request('/api/github/repos', {
         headers: { 'x-github-token': ghToken.value }
       })
       if (res.error) throw new Error(res.error)
       githubRepos.value = res
    } else {
      // Public Request (Legacy)
      if (!githubUser.value) return
      const res = await fetch(`https://api.github.com/users/${githubUser.value}/repos?sort=updated`)
      if (res.ok) githubRepos.value = await res.json()
      else showAlert('GitHub Error', 'User not found or rate limited', 'error')
    }
  } catch (e) {
    showAlert('GitHub Session', 'Failed to fetch repos. Token might be expired.', 'error')
    ghToken.value = null
    localStorage.removeItem('gh_token')
  } finally {
    loadingRepos.value = false
  }
}

function selectRepo(repo: any) {
  newApp.value.name = repo.name
  
  if (repo.private && ghToken.value) {
    // Inject token into URL: https://TOKEN@github.com/user/repo.git
    const cleanUrl = repo.clone_url.replace('https://', '')
    newApp.value.repoUrl = `https://oauth2:${ghToken.value}@${cleanUrl}`
  } else {
    newApp.value.repoUrl = repo.clone_url
  }
}

// Provision Form
const provisionDomain = ref('')
const provisionPort = ref(3000)
const provisionRepo = ref('')

// Computed states
const activeServer = computed(() => {
  if (selectedServerId.value === 'pending') return null
  if (!selectedServerId.value && servers.value.length > 0) return servers.value[0]
  return servers.value.find(s => s.id === selectedServerId.value)
})
const serverStatus = computed(() => activeServer.value?.status || 'offline')
const activeProxies = computed(() => {
  if (!activeServer.value) return []
  return proxies.value.filter(p => p.nodeId === activeServer.value.id)
})
const activeApps = computed(() => {
  if (!activeServer.value) return []
  return apps.value.filter(a => a.nodeId === activeServer.value.id)
})

// Infra / Deploy 
const deployStatus = ref<string | null>(null)
const logs = ref<{ data: string, stream: string }[]>([])
const logContainer = ref<HTMLElement | null>(null)
const domainName = ref('')
const appPort = ref(3000)

// Backend URL (direct connection for most APIs)
const baseUrl = window.location.origin.includes(':5173')
  ? window.location.origin.replace(':5173', ':3000')
  : window.location.origin
const wsUrl = baseUrl.replace('http', 'ws') + '/api/dashboard/ws'

// SSH auth uses token-based auth (see startSSHInstallation)

let ws: WebSocket | null = null

const filteredConsoleLogs = computed(() => {
  return consoleLogs.value.filter(log => 
    log.stream && 
    consoleFilter.value.includes(log.stream) && 
    (!activeServer.value || log.serverId === activeServer.value.id)
  )
})

watch(activeServer, (newS) => {
  if (newS) {
    provisionDomain.value = newS.domain || ''
    provisionPort.value = newS.port || 3000
  }
}, { immediate: true })

async function request(path: string, options?: any) {
  try {
    options = options || {}
    options.credentials = 'include'
    const res = await fetch(`${baseUrl}${path}`, options)
    if (res.status === 401) {
      user.value = null
      return { error: 'Unauthorized' }
    }
    return await res.json()
  } catch (e) {
    return { error: 'Network error' }
  }
}

async function refreshData() {
  if (!user.value) return
  
  const [logsRes, appsRes, serversRes] = await Promise.all([
    request('/api/audit/logs'),
    request('/api/apps'),
    request('/api/internal/servers')
  ])
  
  if (Array.isArray(logsRes)) auditLogs.value = logsRes
  if (Array.isArray(appsRes)) apps.value = appsRes
  if (Array.isArray(serversRes)) servers.value = serversRes
}

function connectWS() {
  if (!user.value) return
  ws = new WebSocket(wsUrl)
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'INITIAL_STATE') {
         const data = msg.servers || {}
         servers.value = Array.isArray(data) ? data : Object.values(data)
         apps.value = msg.apps || []
         proxies.value = msg.proxies || []
      } 
      else if (msg.type === 'SERVER_STATUS') {
        const s = servers.value.find(s => s.id === msg.serverId)
        if (s) s.status = msg.status
        else refreshData()
      } 
      else if (msg.type === 'LOG_STREAM') {
        logs.value.push(msg)
        // Also push to deploy modal if open
        if (showDeployModal.value) {
          deployModalLogs.value.push(msg)
          nextTick(() => { if (deployModalContainer.value) deployModalContainer.value.scrollTop = deployModalContainer.value.scrollHeight })
        }
        nextTick(() => { if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight })
      }
      else if (msg.type === 'STATUS_UPDATE') {
        deployStatus.value = msg.status
        // Also update deploy modal status
        if (showDeployModal.value) {
          deployModalStatus.value = msg.status
        }
        if (msg.status === 'nginx_ready' || msg.status === 'failure') refreshData()
      }
      else if (msg.type === 'PROXIES_UPDATE') {
        proxies.value = msg.proxies || []
      }
      else if (msg.type === 'APPS_UPDATE') {
        apps.value = msg.apps || []
      }
      else if (msg.type === 'SYSTEM_LOG') {
        consoleLogs.value.push({
          timestamp: Date.now(),
          data: msg.data,
          stream: msg.stream || 'stdout',
          type: msg.source || 'system',
          serverId: msg.serverId
        })
        // Also push to deploy modal if open
        if (showDeployModal.value) {
          deployModalLogs.value.push({ data: msg.data, stream: msg.stream || 'stdout' })
          nextTick(() => { if (deployModalContainer.value) deployModalContainer.value.scrollTop = deployModalContainer.value.scrollHeight })
        }
        if (consoleAutoScroll.value) {
          nextTick(() => {
            if (consoleContainer.value) consoleContainer.value.scrollTop = consoleContainer.value.scrollHeight
            if (consoleContainerMini.value) consoleContainerMini.value.scrollTop = consoleContainerMini.value.scrollHeight
            if (consoleContainerLarge.value) consoleContainerLarge.value.scrollTop = consoleContainerLarge.value.scrollHeight
          })
        }
      }
    } catch(e) {}
  }
  if (ws) ws.onclose = () => setTimeout(connectWS, 3000)
}

const provisionAppId = ref<string | null>(null)

// When selecting an app in the provision form, auto-fill the port
watch(provisionAppId, (id) => {
  const app = apps.value.find(a => a.id === id)
  if (app) provisionPort.value = app.port
})

onMounted(async () => {
  const ok = await checkAuth()
  if (ok) {
    refreshData()
    connectWS()
  }
  // Close service dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.service-dropdown')) {
      openServiceMenu.value = null
    }
  })
})

async function generateToken() {
  loading.value = true
  try {
    const data = await request('/api/servers/token', { method: 'POST' })
    token.value = data.token
    selectedServerId.value = 'pending'
    activeMenu.value = 'infrastructure'
  } finally { loading.value = false }
}

// SSH Assisted Installation Functions
function resetSSHSession() {
  sshSession.value = {
    id: null,
    status: 'idle',
    step: 0,
    totalSteps: 5,
    message: '',
    output: []
  }
  if (sshWs) {
    sshWs.close()
    sshWs = null
  }
}

async function startSSHInstallation() {
  console.log('[SSH] Starting installation...')
  if (!sshForm.value.host || !sshForm.value.username) {
    showAlert('Missing Info', 'Please enter server address and username', 'error')
    return
  }

  if (sshForm.value.authType === 'password' && !sshForm.value.password) {
    showAlert('Missing Info', 'Please enter password', 'error')
    return
  }

  if (sshForm.value.authType === 'key' && !sshForm.value.privateKey) {
    showAlert('Missing Info', 'Please paste your SSH private key', 'error')
    return
  }

  resetSSHSession()
  sshSession.value.status = 'connecting'
  sshSession.value.message = 'Connecting to server...'

  // Get temporary auth token for WebSocket (cookies don't work cross-origin)
  let sshToken: string
  try {
    console.log('[SSH] Fetching token from', `${baseUrl}/api/ssh/token`)
    const tokenRes = await fetch(`${baseUrl}/api/ssh/token`, {
      method: 'POST',
      credentials: 'include'
    })
    console.log('[SSH] Token response status:', tokenRes.status)
    if (!tokenRes.ok) {
      console.error('[SSH] Token fetch failed:', tokenRes.status, tokenRes.statusText)
      showAlert('Auth Error', 'Failed to authenticate for SSH session', 'error')
      resetSSHSession()
      return
    }
    const tokenData = await tokenRes.json()
    sshToken = tokenData.token
    console.log('[SSH] Got token:', sshToken.substring(0, 8) + '...')
  } catch (e) {
    console.error('[SSH] Token fetch error:', e)
    showAlert('Connection Error', 'Failed to connect to server', 'error')
    resetSSHSession()
    return
  }

  // Connect via WebSocket with token in URL (cross-origin auth)
  const sshWsUrl = baseUrl.replace('http', 'ws') + `/api/ssh/session?token=${sshToken}`
  console.log('[SSH] Connecting WebSocket to', sshWsUrl)
  sshWs = new WebSocket(sshWsUrl)

  sshWs.onopen = () => {
    console.log('[SSH] WebSocket connected, sending CONNECT message')
    // Send connection request
    sshWs?.send(JSON.stringify({
      type: 'CONNECT',
      host: sshForm.value.host,
      port: sshForm.value.port,
      username: sshForm.value.username,
      password: sshForm.value.authType === 'password' ? sshForm.value.password : undefined,
      privateKey: sshForm.value.authType === 'key' ? sshForm.value.privateKey : undefined,
      verbose: sshForm.value.verbose,
      autoInstall: true
    }))
  }

  sshWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      console.log('[SSH] Received message:', msg.type, msg)

      switch (msg.type) {
        case 'CONNECTED':
          sshSession.value.id = msg.sessionId
          sshSession.value.status = 'preflight'
          break

        case 'STATUS':
          sshSession.value.step = msg.step
          sshSession.value.totalSteps = msg.total
          sshSession.value.message = msg.message
          if (msg.step >= 3) sshSession.value.status = 'installing'
          break

        case 'OUTPUT':
          sshSession.value.output.push(msg.data)
          // Auto-scroll terminal
          nextTick(() => {
            if (sshTerminalRef.value) {
              sshTerminalRef.value.scrollTop = sshTerminalRef.value.scrollHeight
            }
          })
          break

        case 'COMPLETE':
          sshSession.value.status = 'complete'
          sshSession.value.message = 'Installation complete!'
          // Refresh servers list
          setTimeout(() => refreshData(), 2000)
          break

        case 'ERROR':
          console.error('[SSH] Error from server:', msg)
          sshSession.value.status = 'error'
          sshSession.value.message = msg.message
          break
      }
    } catch (e) {
      console.error('[SSH] Message parse error:', e)
    }
  }

  sshWs.onerror = (e) => {
    console.error('[SSH] WebSocket error:', e)
    sshSession.value.status = 'error'
    sshSession.value.message = 'WebSocket connection failed'
  }

  sshWs.onclose = (e) => {
    console.log('[SSH] WebSocket closed, code:', e.code, 'reason:', e.reason)
    if (sshSession.value.status !== 'complete' && sshSession.value.status !== 'error') {
      sshSession.value.status = 'error'
      sshSession.value.message = 'Connection closed unexpectedly'
    }
  }
}

function cancelSSHInstallation() {
  if (sshWs) {
    sshWs.send(JSON.stringify({ type: 'DISCONNECT' }))
    sshWs.close()
    sshWs = null
  }
  resetSSHSession()
}

async function triggerProvision() {
  const targetId = activeServer.value?.id
  if (!targetId) {
    showAlert('Target Error', 'No active node selected', 'error')
    return
  }
  if (!provisionDomain.value) {
    showAlert('Input Error', 'Please fill in domain', 'info')
    return
  }
  activeMenu.value = 'infrastructure'
  deployStatus.value = 'Provisioning...'
  logs.value = []
  
  ws?.send(JSON.stringify({
    type: 'PROVISION_DOMAIN',
    serverId: targetId,
    domain: provisionDomain.value,
    port: provisionPort.value,
    appId: provisionAppId.value,
    repoUrl: 'system-provision'
  }))
}

function onAppSelected() {
  const app = apps.value.find(a => a.id === domainSelectedApp.value)
  if (app) {
    provisionPort.value = app.port
  }
}

async function provisionDomainWithApp() {
  const targetId = activeServer.value?.id
  if (!targetId) {
    showAlert('Target Error', 'No active node selected', 'error')
    return
  }
  if (!provisionDomain.value) {
    showAlert('Input Error', 'Please enter a domain name', 'info')
    return
  }

  showAddDomainModal.value = false

  if (domainTargetMode.value === 'existing') {
    // Mode: Link to existing app
    if (!domainSelectedApp.value) {
      showAlert('Input Error', 'Please select an application', 'info')
      return
    }
    const app = apps.value.find(a => a.id === domainSelectedApp.value)
    provisionPort.value = app?.port || 3000
    triggerProvision()
  } else {
    // Mode: Deploy from Git + Provision
    if (!domainGitUrl.value || !domainAppName.value) {
      showAlert('Input Error', 'Please fill in app name and git URL', 'info')
      return
    }

    // Open deploy modal to show progress
    deployModalApp.value = { name: domainAppName.value, domain: provisionDomain.value }
    deployModalLogs.value = []
    deployModalStatus.value = `Deploying ${domainAppName.value} + provisioning ${provisionDomain.value}...`
    showDeployModal.value = true

    // Send combined deploy + provision request
    ws?.send(JSON.stringify({
      type: 'DEPLOY_WITH_DOMAIN',
      serverId: targetId,
      appName: domainAppName.value,
      repoUrl: domainGitUrl.value,
      port: provisionPort.value,
      domain: provisionDomain.value
    }))

    // Reset fields
    domainAppName.value = ''
    domainGitUrl.value = ''
  }

  // Reset domain fields
  provisionDomain.value = ''
  domainSelectedApp.value = ''
}

async function deleteProxy(domain: string) {
  showConfirm('Delete Domain', `Delete Nginx configuration for ${domain}?`, () => {
    const targetId = activeServer.value?.id
    if (!targetId) return
    
    ws?.send(JSON.stringify({
      type: 'DELETE_PROXY',
      serverId: targetId,
      domain
    }))
    setTimeout(refreshData, 500)
  })
}

function serviceAction(service: string, action: string) {
  const targetId = activeServer.value?.id
  if (!targetId || selectedServerId.value === 'pending') return;

  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1)

  showConfirm(`${actionLabel} ${service.toUpperCase()}`, `Are you sure you want to ${action} ${service}?`, () => {
    // Open console modal for service action
    deployModalApp.value = { name: service.toUpperCase(), repoUrl: 'system-service' }
    deployModalLogs.value = []
    deployModalStatus.value = `${actionLabel}ing ${service}...`
    showDeployModal.value = true

    ws?.send(JSON.stringify({
      type: 'SERVICE_ACTION',
      serverId: targetId,
      service,
      action
    }));
  })
}

async function createApp() {
  try {
    const envObj = newApp.value.env.split('\n').reduce((acc: any, line) => {
      const [k, v] = line.split('='); if(k && v) acc[k.trim()] = v.trim(); return acc;
    }, {})
    await request('/api/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newApp.value, env: envObj })
    })
    showAddAppModal.value = false
    newApp.value = { name: '', repoUrl: '', serverId: '', port: 3000, env: '' }
    refreshData()
    activeMenu.value = 'applications'
  } catch(e) {}
}

async function triggerDeploy(appId: string, commitHash: string = 'main') {
  const app = apps.value.find(a => a.id === appId)
  deployModalApp.value = app
  deployModalLogs.value = []
  deployModalStatus.value = `Deploying ${commitHash}...`
  showDeployModal.value = true

  try {
    await request(`/api/apps/${appId}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitHash })
    })
  } catch(e) {
    deployModalStatus.value = 'Deploy request failed'
  }
}

async function restoreApp(appId: string) {
  const app = apps.value.find(a => a.id === appId)
  if (!app) return

  restoreModalApp.value = app
  restoreBranches.value = []
  restoreCommits.value = []
  restoreManualRef.value = ''
  restoreTab.value = 'branches'
  showRestoreModal.value = true

  // Extract owner/repo from URL
  const repoMatch = app.repoUrl?.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
  if (repoMatch && ghToken.value) {
    restoreLoading.value = true
    try {
      const [, owner, repo] = repoMatch
      // Fetch branches
      const branchesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=20`, {
        headers: { Authorization: `Bearer ${ghToken.value}` }
      })
      if (branchesRes.ok) {
        restoreBranches.value = await branchesRes.json()
      }
      // Fetch recent commits
      const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`, {
        headers: { Authorization: `Bearer ${ghToken.value}` }
      })
      if (commitsRes.ok) {
        restoreCommits.value = await commitsRes.json()
      }
    } catch (e) {
      console.error('Failed to fetch branches/commits:', e)
    } finally {
      restoreLoading.value = false
    }
  }
}

function selectRestore(ref: string) {
  showRestoreModal.value = false
  if (restoreModalApp.value) {
    triggerDeploy(restoreModalApp.value.id, ref)
  }
}

async function deleteApp(appId: string) {
  showConfirm('Delete Application', 'Delete this application and all associated data?', () => {
    request(`/api/apps/${appId}`, { method: 'DELETE' }).then(refreshData)
  })
}

async function lifecycleAction(appId: string, action: 'start' | 'stop' | 'restart') {
  const app = apps.value.find(a => a.id === appId)
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1)

  showConfirm(`${actionLabel} App`, `Do you want to ${action} the application "${app?.name}"?`, async () => {
    // Open deploy modal with console
    deployModalApp.value = app
    deployModalLogs.value = []
    deployModalStatus.value = `${actionLabel}ing ${app?.name}...`
    showDeployModal.value = true

    try {
      await request(`/api/apps/${appId}/${action}`, { method: 'POST' })
    } catch (e) {
      deployModalStatus.value = `${actionLabel} failed`
    }
  })
}

function copyCommand() {
  const cmd = `curl -sSL ${baseUrl}/install.sh | bash -s -- --token ${token.value} --url ${baseUrl}`
  navigator.clipboard.writeText(cmd)
}

function copyMcpConfig() {
  const tokenToUse = newlyGeneratedToken.value || (mcpTokens.value[0]?.prefix + '••••••••') || 'YOUR_TOKEN_HERE'
  const config = `{
  "mcpServers": {
    "serverflow": {
      "command": "npx",
      "args": ["-y", "serverflow-mcp@latest"],
      "env": {
        "SERVERFLOW_API_KEY": "${tokenToUse}",
        "SERVERFLOW_URL": "${baseUrl}"
      }
    }
  }
}`
  navigator.clipboard.writeText(config)
  showAlert('Copied!', 'MCP configuration copied to clipboard', 'info')
}

// MCP Token Management Functions
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

function clearConsoleLogs() {
  consoleLogs.value = []
}

function toggleConsoleFilter(type: string) {
  const idx = consoleFilter.value.indexOf(type)
  if (idx > -1) consoleFilter.value.splice(idx, 1)
  else consoleFilter.value.push(type)
}
</script>

<template>
  <!-- Auth Screen -->
  <div v-if="!user" class="login-screen">
    <div class="glass-card login-card">
      <div class="login-logo">ServerFlow</div>
      <p>Modern Node.js Fleet Management</p>

      <div class="auth-tabs">
        <div class="auth-tab" :class="{ active: authMode === 'login' }" @click="authMode = 'login'">Login</div>
        <div class="auth-tab" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">Register</div>
      </div>

      <form class="login-form" @submit.prevent="handleEmailAuth">
        <div v-if="authMode === 'register'">
          <label>Full Name</label>
          <input v-model="authForm.name" placeholder="John Doe" required />
        </div>
        
        <label>Email Address</label>
        <input v-model="authForm.email" type="email" placeholder="john@example.com" required />
        
        <label>Password</label>
        <input v-model="authForm.password" type="password" placeholder="••••••••" required />

        <button type="submit" class="primary-btn" :disabled="loading">
          {{ authMode === 'login' ? 'Sign In' : 'Create Account' }}
        </button>

        <div v-if="authError" class="auth-error">{{ authError }}</div>
      </form>

      <div class="oauth-divider">Or continue with</div>

      <button class="github-btn" style="width: 100%" @click="loginWithGithub">
        <div class="gh-icon"></div> Login with GitHub
      </button>
    </div>
  </div>

  <!-- Unified Notification Modal -->
  <div v-if="modal.show" class="modal-overlay" style="z-index: 10000;" @click.self="modal.show = false">
    <div class="glass-card modal-card" style="max-width: 460px; text-align: center; padding: 48px;">
      <!-- Dynamic Icons for Actions -->
      <div v-if="modal.title.toLowerCase().includes('start')" class="modal-icon" style="color: #00ffbd; font-size: 4.5rem; margin-bottom: 24px;">▶️</div>
      <div v-else-if="modal.title.toLowerCase().includes('stop')" class="modal-icon" style="color: #ff4d4d; font-size: 4.5rem; margin-bottom: 24px;">⏹️</div>
      <div v-else-if="modal.title.toLowerCase().includes('restart')" class="modal-icon" style="color: #fff; font-size: 4.5rem; margin-bottom: 24px;">🔄</div>
      <div v-else-if="modal.type === 'error'" class="modal-icon" style="color: #ff4d4d; font-size: 4rem; margin-bottom: 24px;">⚠️</div>
      <div v-else-if="modal.type === 'confirm'" class="modal-icon" style="color: #0070f3; font-size: 4rem; margin-bottom: 24px;">❓</div>
      <div v-else-if="modal.type === 'input'" class="modal-icon" style="color: #0070f3; font-size: 4rem; margin-bottom: 24px;">📝</div>
      <div v-else class="modal-icon" style="color: #00ffbd; font-size: 4rem; margin-bottom: 24px;">ℹ️</div>
      
      <h2 style="margin-bottom: 12px; font-weight: 800; font-size: 1.8rem; letter-spacing: -0.02em; color: #0f172a;">{{ modal.title }}</h2>
      <p style="color: #888; font-size: 1.1rem; line-height: 1.5; margin-bottom: 0;">{{ modal.message }}</p>
      
      <div v-if="modal.type === 'input'" class="form-group" style="margin-top: 24px;">
        <input v-model="modal.inputValue" :placeholder="modal.inputPlaceholder" @keyup.enter="if(modal.onConfirm) modal.onConfirm(modal.inputValue); modal.show = false" style="text-align: center; font-size: 1.1rem;" />
      </div>

      <div class="modal-actions" style="margin-top: 40px; justify-content: center; gap: 16px;">
        <button v-if="['confirm', 'input'].includes(modal.type)" class="secondary" @click="modal.show = false" style="padding: 14px 28px; font-size: 1rem; font-weight: 600;">Cancel</button>
        <button class="premium-btn" style="margin-top: 0; padding: 14px 32px; font-size: 1rem; font-weight: 700; min-width: 140px;" @click="if(modal.onConfirm) modal.onConfirm(modal.inputValue); modal.show = false">
          {{ modal.type === 'confirm' || modal.type === 'input' ? 'Confirm' : 'OK' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Expanded Console Modal -->
  <div v-if="showLargeConsole" class="modal-overlay" style="z-index: 9999;" @click.self="showLargeConsole = false">
     <div class="glass-card expanded-console-card">
        <div class="console-toolbar">
           <div class="console-info">
              <span class="console-server">🛰️ {{ activeServer?.id?.slice(0, 12) }} - Live System Analytics</span>
           </div>
           <div class="console-controls">
              <button class="clear-btn" @click="clearConsoleLogs">Clear</button>
              <button class="secondary" @click="showLargeConsole = false">Close</button>
           </div>
        </div>
        <div class="console-body" ref="consoleContainerLarge">
            <div v-for="(log, idx) in filteredConsoleLogs" :key="idx" :class="['console-line', log.stream, log.type]">
               <span class="console-timestamp">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
               <span class="console-stream">{{ log.stream }}</span>
               <span class="console-content">{{ log.data }}</span>
            </div>
        </div>
     </div>
  </div>

  <!-- Deploy Modal with Live Console -->
  <div v-if="showDeployModal" class="modal-overlay" style="z-index: 9998;" @click.self="showDeployModal = false">
     <div class="glass-card deploy-modal-card">
        <div class="deploy-modal-header">
           <div class="deploy-info">
              <div class="deploy-app-icon"></div>
              <div>
                 <h3>{{ deployModalApp?.name || 'Deployment' }}</h3>
                 <span class="deploy-repo">{{ deployModalApp?.repoUrl?.split('/').pop() }}</span>
              </div>
           </div>
           <div class="deploy-status-badge" :class="{
              success: deployModalStatus.includes('ready') || deployModalStatus.includes('success'),
              error: deployModalStatus.includes('fail') || deployModalStatus.includes('error'),
              pending: !deployModalStatus.includes('ready') && !deployModalStatus.includes('fail')
           }">
              {{ deployModalStatus }}
           </div>
        </div>
        <div class="deploy-console" ref="deployModalContainer">
           <div v-if="deployModalLogs.length === 0" class="deploy-console-empty">
              <div class="loader"></div>
              <p>Waiting for deployment logs...</p>
           </div>
           <div v-for="(log, idx) in deployModalLogs" :key="idx" :class="['deploy-log-line', log.stream]">
              <span class="log-content">{{ log.data }}</span>
           </div>
        </div>
        <div class="deploy-modal-footer">
           <button class="secondary" @click="showDeployModal = false">Close</button>
        </div>
     </div>
  </div>

  <!-- Restore Modal with Branch/Commit Selection -->
  <div v-if="showRestoreModal" class="modal-overlay" style="z-index: 9997;" @click.self="showRestoreModal = false">
     <div class="glass-card restore-modal-card">
        <div class="restore-modal-header">
           <div class="deploy-info">
              <div class="deploy-app-icon"></div>
              <div>
                 <h3>Restore {{ restoreModalApp?.name }}</h3>
                 <span class="deploy-repo">Select a version to restore</span>
              </div>
           </div>
           <button class="icon-btn" @click="showRestoreModal = false">✕</button>
        </div>

        <div class="restore-tabs">
           <button :class="{ active: restoreTab === 'branches' }" @click="restoreTab = 'branches'">Branches</button>
           <button :class="{ active: restoreTab === 'commits' }" @click="restoreTab = 'commits'">Commits</button>
           <button :class="{ active: restoreTab === 'manual' }" @click="restoreTab = 'manual'">Manual</button>
        </div>

        <div class="restore-content">
           <div v-if="restoreLoading" class="restore-loading">
              <div class="loader"></div>
              <p>Loading from GitHub...</p>
           </div>

           <!-- Branches Tab -->
           <div v-else-if="restoreTab === 'branches'" class="restore-list">
              <div v-if="restoreBranches.length === 0" class="restore-empty">
                 <p>No branches found. Connect GitHub or use Manual tab.</p>
              </div>
              <div v-for="branch in restoreBranches" :key="branch.name" class="restore-item" @click="selectRestore(branch.name)">
                 <div class="restore-item-icon branch">🌿</div>
                 <div class="restore-item-info">
                    <span class="restore-item-name">{{ branch.name }}</span>
                    <span class="restore-item-meta">{{ branch.commit?.sha?.slice(0, 7) }}</span>
                 </div>
                 <div class="restore-item-action">Deploy →</div>
              </div>
           </div>

           <!-- Commits Tab -->
           <div v-else-if="restoreTab === 'commits'" class="restore-list">
              <div v-if="restoreCommits.length === 0" class="restore-empty">
                 <p>No commits found. Connect GitHub or use Manual tab.</p>
              </div>
              <div v-for="commit in restoreCommits" :key="commit.sha" class="restore-item" @click="selectRestore(commit.sha)">
                 <div class="restore-item-icon commit">📌</div>
                 <div class="restore-item-info">
                    <span class="restore-item-name">{{ commit.commit?.message?.split('\n')[0]?.slice(0, 50) }}</span>
                    <span class="restore-item-meta">
                       {{ commit.sha?.slice(0, 7) }} · {{ commit.commit?.author?.name }} · {{ new Date(commit.commit?.author?.date).toLocaleDateString() }}
                    </span>
                 </div>
                 <div class="restore-item-action">Deploy →</div>
              </div>
           </div>

           <!-- Manual Tab -->
           <div v-else-if="restoreTab === 'manual'" class="restore-manual">
              <p>Enter a branch name, tag, or commit SHA:</p>
              <input v-model="restoreManualRef" placeholder="main, v1.0.0, a1b2c3d..." @keyup.enter="selectRestore(restoreManualRef)" />
              <button class="premium-btn" :disabled="!restoreManualRef" @click="selectRestore(restoreManualRef)">
                 Deploy Version
              </button>
           </div>
        </div>
     </div>
  </div>

  <div v-if="user" class="dashboard-layout">
    <!-- Modal -->
    <div v-if="showAddAppModal" class="modal-overlay" @click.self="showAddAppModal = false">
      <div class="glass-card modal-card">
        <h3>Deploy New Application</h3>
        <label>App Name</label><input v-model="newApp.name" placeholder="My Awesome API" />
        <div class="source-toggle">
           <button :class="{ active: repoSource === 'manual' }" @click="repoSource = 'manual'">Manual URL</button>
           <button :class="{ active: repoSource === 'github' }" @click="repoSource = 'github'">GitHub Public</button>
        </div>

        <div v-if="repoSource === 'github'" class="github-box">
           <div v-if="!ghToken">
             <div class="gh-connect-prompt">
                <p>Connect your GitHub account to access private repositories.</p>
                <button class="github-btn" @click="loginWithGithub">
                  <div class="gh-icon"></div> Connect GitHub
                </button>
             </div>
           </div>
           
           <div v-else>
              <div class="gh-connected">
                 <span>✅ Connected to GitHub</span>
                 <button class="link-btn" @click="fetchGithubRepos">Refresh Repos</button>
              </div>
              <div v-if="githubRepos.length === 0" style="margin-top: 10px;">
                 <button @click="fetchGithubRepos" :disabled="loadingRepos" class="load-repo-btn">{{ loadingRepos ? 'Loading...' : 'Load My Repositories' }}</button>
              </div>
           </div>

           <select v-if="githubRepos.length > 0" @change="selectRepo(githubRepos[($event.target as HTMLSelectElement).selectedIndex - 1])" style="margin-top: 12px;">
             <option disabled selected>Select a repository...</option>
             <option v-for="r in githubRepos" :key="r.id" :value="r">{{ r.private ? '🔒' : 'globe' }} {{ r.name }}</option>
           </select>
        </div>

        <label>Git Repository URL</label><input v-model="newApp.repoUrl" placeholder="https://github.com/..." />
        <label>Target Node</label>
        <select v-model="newApp.serverId">
          <option v-for="s in servers" :key="s.id" :value="s.id">{{ s.id.slice(0,12) }} ({{ s.status }})</option>
        </select>
        <label>Container Port</label><input v-model="newApp.port" type="number" />
        <label>Environment Variables (KEY=VALUE)</label>
        <textarea v-model="newApp.env" placeholder="API_KEY=xyz\nDB_PASS=123"></textarea>
        <div class="modal-actions">
           <button class="secondary" @click="showAddAppModal = false">Cancel</button>
           <button class="premium-btn" @click="createApp">Register App</button>
        </div>
      </div>
    </div>

    <!-- Add Domain Modal -->
    <div v-if="showAddDomainModal" class="modal-overlay" @click.self="showAddDomainModal = false">
      <div class="glass-card modal-card" style="max-width: 480px;">
        <h3>Add Domain</h3>
        <p class="modal-subtitle">Configure SSL certificate and link to an application</p>

        <label>Domain Name</label>
        <input v-model="provisionDomain" type="text" placeholder="api.example.com" />

        <label>Target Application</label>
        <div class="source-toggle" style="margin-bottom: 0;">
           <button :class="{ active: domainTargetMode === 'existing' }" @click="domainTargetMode = 'existing'">Existing App</button>
           <button :class="{ active: domainTargetMode === 'git' }" @click="domainTargetMode = 'git'">Deploy from Git</button>
        </div>

        <!-- Existing App Mode -->
        <div v-if="domainTargetMode === 'existing'" class="target-section">
           <select v-model="domainSelectedApp" @change="onAppSelected">
              <option value="" disabled>Select an application...</option>
              <option v-for="app in activeApps" :key="app.id" :value="app.id">{{ app.name }} (port {{ app.port }})</option>
           </select>
        </div>

        <!-- Git Deploy Mode -->
        <div v-if="domainTargetMode === 'git'" class="target-section">
           <div class="git-deploy-box">
              <label>App Name</label>
              <input v-model="domainAppName" type="text" placeholder="my-api" />

              <label>Git Repository</label>
              <input v-model="domainGitUrl" type="text" placeholder="https://github.com/user/repo" />

              <label>Port</label>
              <input v-model.number="provisionPort" type="number" placeholder="3000" />
           </div>
        </div>

        <div class="ssl-info">
          <span class="ssl-icon">🔒</span>
          <span>SSL certificate auto-provisioned via Let's Encrypt</span>
        </div>

        <div class="modal-actions">
           <button class="secondary" @click="showAddDomainModal = false">Cancel</button>
           <button class="premium-btn" @click="provisionDomainWithApp">
              {{ domainTargetMode === 'git' ? 'Deploy & Provision' : 'Provision SSL' }}
           </button>
        </div>
      </div>
    </div>

    <!-- Token Generation Modal -->
    <div v-if="showNewTokenModal && !newlyGeneratedToken" class="modal-overlay" @click.self="showNewTokenModal = false">
      <div class="modal-box token-modal">
        <h2>Generate MCP Token</h2>
        <p class="modal-subtitle">This token will be shown only once. Store it securely.</p>

        <div class="form-group">
          <label>Token Name</label>
          <input v-model="newTokenName" placeholder="e.g., Claude Desktop, Cursor IDE" />
        </div>

        <div class="token-warning">
          <span class="warning-icon">⚠️</span>
          <span>You won't be able to see this token again after closing. Make sure to copy it.</span>
        </div>

        <div class="modal-actions">
           <button class="secondary" @click="showNewTokenModal = false">Cancel</button>
           <button class="premium-btn" @click="generateMcpToken">Generate Token</button>
        </div>
      </div>
    </div>

    <!-- Token Generated Success Modal -->
    <div v-if="showNewTokenModal && newlyGeneratedToken" class="modal-overlay" @click.self="closeTokenModal">
      <div class="modal-box token-modal token-success">
        <div class="success-icon">✅</div>
        <h2>Token Generated!</h2>
        <p class="modal-subtitle">Copy this token now. It won't be shown again.</p>

        <div class="token-display">
          <code class="token-value">{{ newlyGeneratedToken }}</code>
          <button class="copy-token-btn" @click="copyToken(newlyGeneratedToken)">Copy</button>
        </div>

        <div class="token-warning critical">
          <span class="warning-icon">🔒</span>
          <span>Store this token in a secure location. You will not be able to retrieve it later.</span>
        </div>

        <div class="modal-actions">
           <button class="premium-btn" @click="closeTokenModal">I've Copied It</button>
        </div>
      </div>
    </div>

    <aside class="sidebar">
      <div class="logo"><div class="logo-icon"></div><span>ServerFlow</span></div>
      <div class="nav-label">ORCHESTRATION</div>
      <nav>
        <a href="#" :class="{ active: activeMenu === 'infrastructure' }" @click="activeMenu = 'infrastructure'; selectedServerId = null">Infrastructure</a>
        <a href="#" :class="{ active: activeMenu === 'applications' }" @click="activeMenu = 'applications'">Applications</a>
        <a href="#" :class="{ active: activeMenu === 'activity' }" @click="activeMenu = 'activity'; refreshData()">Activity</a>
      </nav>
      <div class="nav-label">INTEGRATIONS</div>
      <nav>
        <a href="#" :class="{ active: activeMenu === 'mcp' }" @click="activeMenu = 'mcp'; loadMcpTokens()">MCP Bridge</a>
      </nav>
      <div class="nav-label">MANAGEMENT</div>
      <nav><a href="#" @click="generateToken" :class="{ active: selectedServerId === 'pending' }">+ Connect Node</a></nav>
      <div class="server-list" style="flex: 1; overflow-y: auto;">
        <div v-for="s in servers" :key="s.id" class="server-item" :class="{ selected: selectedServerId === s.id, online: s.status === 'online' }" @click="selectedServerId = s.id; activeMenu = 'infrastructure'">
           <div class="status-dot"></div>
           <div class="node-info"><p>{{ s.id.slice(0, 12) }}</p><span>{{ s.status }}</span></div>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="user-profile">
          <div class="avatar-mini" :style="{ backgroundImage: user.avatarUrl ? `url(${user.avatarUrl})` : '' }"></div>
          <div class="user-info">
            <p>{{ user.name }}</p>
            <span @click="logout" style="cursor:pointer; color: #ff4d4d;">Sign Out</span>
          </div>
        </div>
      </div>
    </aside>

    <div class="main-wrapper">
      <header class="top-bar">
        <div class="actions" style="margin-left: auto;">
           <button v-if="activeMenu === 'applications'" class="premium-btn" @click="showAddAppModal = true">+ New App</button>
           <span :class="['status-badge', serverStatus]" v-if="selectedServerId !== 'pending'">
             {{ serverStatus === 'online' ? 'Engine Online' : 'Node Offline' }}
          </span>
        </div>
      </header>

      <main class="content">
        <!-- APPLICATIONS VIEW -->
        <div v-if="activeMenu === 'applications'" class="apps-view">
           <h1 class="gradient-text">Applications</h1>
           <div class="apps-grid">
              <div v-for="app in apps" :key="app.id" class="glass-card app-card">
                 <div class="app-header">
                    <div class="app-icon"></div>
                    <div class="app-meta">
                       <h4>{{ app.name }}</h4>
                       <p>{{ app.repoUrl.split('/').pop() }}</p>
                    </div>
                    <div class="app-status">Running</div>
                 </div>
                 <div class="app-details">
                    <span>Node: {{ app.nodeId?.slice(0,8) }}</span>
                    <span>Port: {{ app.port }}</span>
                 </div>
                 <div class="app-actions">
                    <button class="action-btn" @click="triggerDeploy(app.id)">Deploy</button>
                    <button class="action-btn restore" @click="restoreApp(app.id)">Restore</button>
                    <button class="action-btn" @click="lifecycleAction(app.id, 'start')">Start</button>
                    <button class="action-btn" @click="lifecycleAction(app.id, 'restart')">Restart</button>
                    <button class="action-btn secondary" @click="lifecycleAction(app.id, 'stop')">Stop</button>
                    <button class="action-btn error" @click="deleteApp(app.id)">Delete</button>
                 </div>
              </div>
              <div v-if="apps.length === 0" class="empty-msg">No applications registered.</div>
           </div>
        </div>

        <!-- ACTIVITY VIEW -->
        <div v-else-if="activeMenu === 'activity'" class="activity-view">
           <h1 class="gradient-text">System Activity</h1>
           <div class="glass-card audit-table">
              <div v-for="log in auditLogs" :key="log.id" class="audit-row">
                 <div class="log-time">{{ new Date(log.timestamp).toLocaleTimeString() }}</div>
                 <div class="log-type"><span :class="['badge-mini', log.status]">{{ log.type }}</span></div>
                 <div class="log-server">#{{ log.serverId?.slice(0,6) }}</div>
                 <div class="log-details">{{ JSON.stringify(log.details) }}</div>
              </div>
           </div>
        </div>

        <!-- MCP BRIDGE VIEW -->
        <div v-else-if="activeMenu === 'mcp'" class="mcp-view">
           <h1 class="gradient-text">MCP Bridge</h1>
           <p class="mcp-subtitle">Connect AI assistants (Claude, Cursor) to control your infrastructure via natural language.</p>

           <div class="mcp-grid">
              <!-- Setup Card -->
              <div class="glass-card mcp-setup-card">
                 <h3>Quick Setup</h3>
                 <p class="mcp-desc">Add ServerFlow to your Claude Desktop or Cursor configuration.</p>

                 <div class="mcp-step">
                    <span class="step-number">1</span>
                    <div class="step-content">
                       <strong>Open config file</strong>
                       <code class="config-path">~/.config/claude/claude_desktop_config.json</code>
                    </div>
                 </div>

                 <div class="mcp-step">
                    <span class="step-number">2</span>
                    <div class="step-content">
                       <strong>Add MCP server</strong>
                       <div class="code-block">
                          <pre>{
  "mcpServers": {
    "serverflow": {
      "command": "npx",
      "args": ["-y", "serverflow-mcp@latest"],
      "env": {
        "SERVERFLOW_API_KEY": "your-token-here",
        "SERVERFLOW_URL": "{{ baseUrl }}"
      }
    }
  }
}</pre>
                          <button class="copy-code-btn" @click="copyMcpConfig">Copy</button>
                       </div>
                    </div>
                 </div>

                 <div class="mcp-step">
                    <span class="step-number">3</span>
                    <div class="step-content">
                       <strong>Restart Claude Desktop</strong>
                       <span class="step-hint">ServerFlow tools will appear automatically.</span>
                    </div>
                 </div>
              </div>

              <!-- Token Management Card -->
              <div class="glass-card mcp-tokens-card">
                 <div class="tokens-header">
                    <div>
                       <h3>API Tokens</h3>
                       <p class="mcp-desc">Secure tokens for MCP authentication.</p>
                    </div>
                    <button class="premium-btn" @click="showNewTokenModal = true; newTokenName = ''">
                       + Generate Token
                    </button>
                 </div>

                 <div v-if="mcpTokens.length === 0" class="no-tokens">
                    <span class="no-tokens-icon">🔑</span>
                    <p>No tokens yet. Generate one to connect your AI assistant.</p>
                 </div>

                 <div v-else class="tokens-list">
                    <div v-for="token in mcpTokens" :key="token.id" class="token-item">
                       <div class="token-info">
                          <code class="token-prefix">{{ token.prefix }}••••••••</code>
                          <span class="token-name">{{ token.name }}</span>
                          <span class="token-meta">
                             Created {{ new Date(token.createdAt * 1000).toLocaleDateString() }}
                             <template v-if="token.lastUsedAt">
                                · Last used {{ new Date(token.lastUsedAt * 1000).toLocaleDateString() }}
                             </template>
                          </span>
                       </div>
                       <button class="revoke-btn" @click="revokeMcpToken(token.id)">Revoke</button>
                    </div>
                 </div>
              </div>

              <!-- Tools Card -->
              <div class="glass-card mcp-tools-card">
                 <h3>Available Tools</h3>
                 <p class="mcp-desc">14 tools available for AI-powered infrastructure management.</p>

                 <div class="tools-list">
                    <div class="tool-item">
                       <div class="tool-icon">📋</div>
                       <div class="tool-info">
                          <span class="tool-name">list_servers</span>
                          <span class="tool-desc">List all nodes and their connection status</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">📦</div>
                       <div class="tool-info">
                          <span class="tool-name">list_apps</span>
                          <span class="tool-desc">List all registered applications</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">🚀</div>
                       <div class="tool-info">
                          <span class="tool-name">deploy_app</span>
                          <span class="tool-desc">Trigger deployment by app name</span>
                       </div>
                       <span class="tool-tag">dry-run</span>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">⚡</div>
                       <div class="tool-info">
                          <span class="tool-name">app_action</span>
                          <span class="tool-desc">Start, stop, restart, or delete an app</span>
                       </div>
                       <span class="tool-tag">dry-run</span>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">📊</div>
                       <div class="tool-info">
                          <span class="tool-name">get_activity_logs</span>
                          <span class="tool-desc">Retrieve recent system activity</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">🌐</div>
                       <div class="tool-info">
                          <span class="tool-name">provision_domain</span>
                          <span class="tool-desc">Setup domain with nginx + SSL</span>
                       </div>
                       <span class="tool-tag">dry-run</span>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">🔗</div>
                       <div class="tool-info">
                          <span class="tool-name">list_domains</span>
                          <span class="tool-desc">List all configured domain proxies</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">📈</div>
                       <div class="tool-info">
                          <span class="tool-name">get_server_metrics</span>
                          <span class="tool-desc">Real-time CPU, RAM, disk usage</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">💓</div>
                       <div class="tool-info">
                          <span class="tool-name">check_app_health</span>
                          <span class="tool-desc">HTTP health check for an app</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">📜</div>
                       <div class="tool-info">
                          <span class="tool-name">get_deployment_history</span>
                          <span class="tool-desc">List recent deployments</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">📝</div>
                       <div class="tool-info">
                          <span class="tool-name">get_server_logs</span>
                          <span class="tool-desc">Read nginx/pm2/system logs (GDPR-safe)</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">🔄</div>
                       <div class="tool-info">
                          <span class="tool-name">service_action</span>
                          <span class="tool-desc">Control nginx/pm2 services</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">🛡️</div>
                       <div class="tool-info">
                          <span class="tool-name">get_security_status</span>
                          <span class="tool-desc">Firewall, failed services, load average</span>
                       </div>
                    </div>
                    <div class="tool-item">
                       <div class="tool-icon">🔧</div>
                       <div class="tool-info">
                          <span class="tool-name">install_server_extras</span>
                          <span class="tool-desc">Install ufw, fail2ban, htop, etc.</span>
                       </div>
                    </div>
                 </div>
              </div>

              <!-- Examples Card -->
              <div class="glass-card mcp-examples-card">
                 <h3>Example Prompts</h3>
                 <p class="mcp-desc">Try these commands with Claude or Cursor.</p>

                 <div class="example-list">
                    <div class="example-item">
                       <span class="example-label">Deploy</span>
                       <span class="example-text">"Deploy my-api to production"</span>
                    </div>
                    <div class="example-item">
                       <span class="example-label">Status</span>
                       <span class="example-text">"Show me all my servers and their status"</span>
                    </div>
                    <div class="example-item">
                       <span class="example-label">Restart</span>
                       <span class="example-text">"Restart nginx on server abc123"</span>
                    </div>
                    <div class="example-item">
                       <span class="example-label">Domain</span>
                       <span class="example-text">"Setup api.example.com pointing to port 3000"</span>
                    </div>
                    <div class="example-item">
                       <span class="example-label">Dry Run</span>
                       <span class="example-text">"What would happen if I deploy my-api? (dry run)"</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <!-- CONSOLE VIEW -->
        <div v-else-if="activeMenu === 'console'" class="console-view">
           <h1 class="gradient-text">Live Console</h1>
           <div v-if="!activeServer || selectedServerId === 'pending'" class="empty-msg">
              Select an online server to view console logs
           </div>
           <div v-else class="glass-card console-card">
              <div class="console-toolbar">
                 <div class="console-info">
                    <span class="console-server">{{ activeServer.id?.slice(0, 12) }}</span>
                    <span class="console-count">{{ filteredConsoleLogs.length }} lines</span>
                 </div>
                 <div class="console-controls">
                    <div class="filter-group">
                       <button 
                          :class="['filter-btn', { active: consoleFilter.includes('stdout') }]" 
                          @click="toggleConsoleFilter('stdout')">
                          stdout
                       </button>
                       <button 
                          :class="['filter-btn', { active: consoleFilter.includes('stderr') }]" 
                          @click="toggleConsoleFilter('stderr')">
                          stderr
                       </button>
                       <button 
                          :class="['filter-btn', { active: consoleFilter.includes('system') }]" 
                          @click="toggleConsoleFilter('system')">
                          system
                       </button>
                    </div>
                    <button 
                       :class="['toggle-btn', { active: consoleAutoScroll }]" 
                       @click="consoleAutoScroll = !consoleAutoScroll">
                       {{ consoleAutoScroll ? '⏸' : '▶' }} Auto-scroll
                    </button>
                    <button class="clear-btn" @click="clearConsoleLogs">Clear</button>
                 </div>
              </div>
              <div class="console-body" ref="consoleContainer">
                 <div v-if="filteredConsoleLogs.length === 0" class="console-empty">
                    <div class="empty-icon">📝</div>
                    <p>No logs yet. Logs will appear here in real-time.</p>
                    <small>Deploy an application or perform actions to see logs</small>
                 </div>
                 <div 
                    v-for="(log, idx) in filteredConsoleLogs" 
                    :key="idx" 
                    :class="['console-line', log.stream, log.type]">
                    <span class="console-timestamp">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
                    <span class="console-stream">{{ log.stream }}</span>
                    <span class="console-content">{{ log.data }}</span>
                 </div>
              </div>
           </div>
        </div>

        <!-- INFRASTRUCTURE VIEW -->
        <div v-else-if="activeMenu === 'infrastructure'">
           <!-- Connect New Node -->
           <div v-if="selectedServerId === 'pending'" class="onboarding-view">
              <div class="connect-header">
                <button class="back-btn" @click="selectedServerId = null; resetSSHSession()">← Back</button>
                <h1 class="gradient-text">Connect New Node</h1>
              </div>

              <!-- Tab Navigation -->
              <div class="connect-tabs">
                <button
                  :class="['tab-btn', { active: connectTab === 'quick' }]"
                  @click="connectTab = 'quick'; if (!token) generateToken()"
                >Quick Install</button>
                <button
                  :class="['tab-btn', { active: connectTab === 'assisted' }]"
                  @click="connectTab = 'assisted'"
                >Assisted Setup</button>
              </div>

              <!-- Quick Install Tab -->
              <div v-if="connectTab === 'quick' && token" class="glass-card onboarding-box">
                <p class="quick-install-desc">Run this command on your Debian/Ubuntu server:</p>
                <div class="terminal-mini" @click="copyCommand">
                  <code class="code-line"><span class="prompt">$</span> curl -sSL {{ baseUrl }}/install.sh | bash -s -- --token <span class="token">{{ token }}</span> --url {{ baseUrl }}</code>
                  <span class="copy-hint">Click to copy</span>
                </div>
                <div class="status-waiting"><div class="loader"></div> Waiting for connection...</div>
                <div class="requirements-inline">
                  <span>Requirements:</span> Debian/Ubuntu, root or sudo access, internet connectivity
                </div>
              </div>

              <!-- Assisted Setup Tab -->
              <div v-else-if="connectTab === 'assisted'" class="glass-card assisted-setup-box">
                <!-- Idle/Form State -->
                <div v-if="sshSession.status === 'idle'" class="ssh-form">
                  <p class="assisted-desc">Enter your server SSH credentials:</p>

                  <div class="ssh-fields">
                    <div class="form-row">
                      <div class="form-group flex-grow">
                        <label>Server Address</label>
                        <input v-model="sshForm.host" placeholder="192.168.1.100 or hostname" />
                      </div>
                      <div class="form-group port-field">
                        <label>Port</label>
                        <input v-model.number="sshForm.port" type="number" />
                      </div>
                    </div>

                    <div class="form-group">
                      <label>Username</label>
                      <input v-model="sshForm.username" placeholder="root" />
                    </div>

                    <div class="form-group">
                      <label>Authentication</label>
                      <div class="auth-toggle">
                        <button
                          :class="['auth-btn', { active: sshForm.authType === 'password' }]"
                          @click="sshForm.authType = 'password'"
                        >Password</button>
                        <button
                          :class="['auth-btn', { active: sshForm.authType === 'key' }]"
                          @click="sshForm.authType = 'key'"
                        >SSH Key</button>
                      </div>
                    </div>

                    <div v-if="sshForm.authType === 'password'" class="form-group">
                      <label>Password</label>
                      <input v-model="sshForm.password" type="password" placeholder="Enter SSH password" />
                    </div>

                    <div v-else class="form-group">
                      <label>Private Key</label>
                      <textarea
                        v-model="sshForm.privateKey"
                        placeholder="Paste your private key here..."
                        rows="3"
                        class="key-textarea"
                      ></textarea>
                    </div>
                  </div>

                  <div class="ssh-options">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="sshForm.verbose" />
                      <span>Show detailed output</span>
                    </label>
                  </div>

                  <button class="premium-btn full-width" @click="startSSHInstallation">
                    🚀 Start Installation
                  </button>

                  <div class="privacy-notice-inline">
                    🔒 Credentials are <strong>never stored</strong> - used only for this session
                  </div>
                </div>

                <!-- Installing State -->
                <div v-else class="ssh-progress">
                  <div class="progress-header">
                    <h3>Installing ServerFlow Agent</h3>
                    <button
                      v-if="sshSession.status !== 'complete'"
                      class="cancel-btn"
                      @click="cancelSSHInstallation"
                    >Cancel</button>
                  </div>

                  <!-- Progress Steps -->
                  <div class="progress-steps">
                    <div
                      v-for="(step, idx) in [
                        { name: 'Connected', icon: '🔗' },
                        { name: 'Pre-flight checks', icon: '✅' },
                        { name: 'Installing dependencies', icon: '📦' },
                        { name: 'Configuring agent', icon: '⚙️' },
                        { name: 'Starting service', icon: '🚀' }
                      ]"
                      :key="idx"
                      :class="['progress-step', {
                        completed: sshSession.step > idx + 1,
                        active: sshSession.step === idx + 1,
                        error: sshSession.status === 'error' && sshSession.step === idx + 1
                      }]"
                    >
                      <span class="step-icon">
                        <template v-if="sshSession.step > idx + 1">✅</template>
                        <template v-else-if="sshSession.step === idx + 1 && sshSession.status !== 'error'">
                          <span class="spinner"></span>
                        </template>
                        <template v-else-if="sshSession.status === 'error' && sshSession.step === idx + 1">❌</template>
                        <template v-else>○</template>
                      </span>
                      <span class="step-name">{{ step.name }}</span>
                    </div>
                  </div>

                  <!-- Status Message -->
                  <div :class="['status-message', sshSession.status]">
                    {{ sshSession.message }}
                  </div>

                  <!-- Terminal Output -->
                  <div ref="sshTerminalRef" class="ssh-terminal">
                    <div v-for="(line, idx) in sshSession.output" :key="idx" class="terminal-line">{{ line }}</div>
                    <div v-if="sshSession.output.length === 0" class="terminal-placeholder">
                      Waiting for output...
                    </div>
                  </div>

                  <!-- Progress Bar -->
                  <div class="progress-bar-container">
                    <div
                      class="progress-bar-fill"
                      :style="{ width: ((sshSession.step / sshSession.totalSteps) * 100) + '%' }"
                    ></div>
                  </div>

                  <!-- Success Actions -->
                  <div v-if="sshSession.status === 'complete'" class="success-actions">
                    <p>✅ Your node has been successfully connected!</p>
                    <button class="premium-btn" @click="selectedServerId = null; resetSSHSession()">
                      View Infrastructure
                    </button>
                  </div>

                  <!-- Error Actions -->
                  <div v-if="sshSession.status === 'error'" class="error-actions">
                    <button class="secondary-btn" @click="resetSSHSession()">Try Again</button>
                    <button class="secondary-btn" @click="connectTab = 'quick'; if (!token) generateToken()">Use Quick Install</button>
                  </div>
                </div>
              </div>
           </div>

           <!-- Infrastructure Overview -->
           <div v-else-if="!selectedServerId" class="infra-overview">
              <div class="infra-header">
                 <h1 class="gradient-text">Infrastructure</h1>
                 <button class="add-node-btn" @click="selectedServerId = 'pending'; generateToken()">
                    <span>+</span> Add Node
                 </button>
              </div>

              <!-- Stats Bar -->
              <div class="infra-stats">
                 <div class="stat-card">
                    <span class="stat-value">{{ servers.length }}</span>
                    <span class="stat-label">Total Nodes</span>
                 </div>
                 <div class="stat-card">
                    <span class="stat-value success">{{ servers.filter(s => s.status === 'online').length }}</span>
                    <span class="stat-label">Online</span>
                 </div>
                 <div class="stat-card">
                    <span class="stat-value">{{ apps.length }}</span>
                    <span class="stat-label">Applications</span>
                 </div>
                 <div class="stat-card">
                    <span class="stat-value">{{ proxies.length }}</span>
                    <span class="stat-label">Domains</span>
                 </div>
              </div>

              <!-- Nodes Grid -->
              <div class="nodes-grid">
                 <div
                    v-for="server in servers"
                    :key="server.id"
                    class="glass-card node-card"
                    @click="selectedServerId = server.id"
                 >
                    <div class="node-card-header">
                       <div class="node-icon" :class="server.status"></div>
                       <div class="node-info">
                          <span class="node-id">{{ server.id.slice(0, 12) }}</span>
                          <span :class="['node-status', server.status]">{{ server.status }}</span>
                       </div>
                    </div>
                    <div class="node-card-stats">
                       <div class="node-stat">
                          <span class="node-stat-value">{{ apps.filter(a => a.nodeId === server.id).length }}</span>
                          <span class="node-stat-label">Apps</span>
                       </div>
                       <div class="node-stat">
                          <span class="node-stat-value">{{ proxies.filter(p => p.nodeId === server.id).length }}</span>
                          <span class="node-stat-label">Domains</span>
                       </div>
                    </div>
                    <div class="node-card-action">
                       <span>View Details →</span>
                    </div>
                 </div>

                 <!-- Empty State -->
                 <div v-if="servers.length === 0" class="empty-infra">
                    <div class="empty-icon">🖥️</div>
                    <p>No nodes connected yet</p>
                    <button class="premium-btn" @click="selectedServerId = 'pending'; generateToken()">Connect First Node</button>
                 </div>
              </div>
           </div>

           <!-- Node Details -->
           <div v-else-if="activeServer" class="grid-layout">
              <div class="node-detail-header">
                 <button class="back-btn" @click="selectedServerId = null">← Back</button>
                 <h1 class="gradient-text">Node Details</h1>
              </div>

              <!-- Status Bar - Full Width -->
              <div class="glass-card status-bar">
                 <div class="status-item">
                    <span class="status-label">Status</span>
                    <span :class="['status-value', serverStatus === 'online' ? 'success' : 'error']">{{ serverStatus }}</span>
                 </div>
                 <div class="status-item">
                    <span class="status-label">Uptime</span>
                    <span class="status-value">99.9%</span>
                 </div>
                 <div class="status-item">
                    <span class="status-label">Node ID</span>
                    <span class="status-value mono">{{ activeServer.id.slice(0, 12) }}</span>
                 </div>
                 <div class="status-item">
                    <span class="status-label">Apps</span>
                    <span class="status-value">{{ activeApps.length }}</span>
                 </div>
                 <div class="status-item">
                    <span class="status-label">Domains</span>
                    <span class="status-value">{{ activeProxies.length }}</span>
                 </div>
              </div>

              <div class="node-detail-grid">
                 <!-- Left Column: Services + Applications -->
                 <div class="glass-card provision-card">
                    <!-- Applications Header with Add button and Services dropdown -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                       <div style="display: flex; align-items: center; gap: 8px;">
                          <h3 style="margin: 0;">Applications</h3>
                          <span class="badge-mini">{{ activeApps.length }}</span>
                       </div>
                       <div style="display: flex; gap: 8px; align-items: center;">
                          <button class="add-app-btn" @click="newApp.serverId = activeServer?.id; showAddAppModal = true" title="Add application">+</button>
                          <div class="services-dropdown-wrapper">
                          <button class="services-toggle-btn" @click.stop="openServiceMenu = openServiceMenu === 'services' ? null : 'services'">
                             <span>Services</span>
                             <span class="service-chevron" :class="{ open: openServiceMenu === 'services' }">▾</span>
                          </button>
                          <div v-if="openServiceMenu === 'services'" class="services-dropdown-menu">
                             <div class="service-row">
                                <span class="service-label">Nginx</span>
                                <div class="service-actions">
                                   <button class="svc-btn start" @click.stop="serviceAction('nginx', 'start')">▶</button>
                                   <button class="svc-btn stop" @click.stop="serviceAction('nginx', 'stop')">⏹</button>
                                   <button class="svc-btn restart" @click.stop="serviceAction('nginx', 'restart')">↻</button>
                                </div>
                             </div>
                             <div class="service-row">
                                <span class="service-label">PM2</span>
                                <div class="service-actions">
                                   <button class="svc-btn start" @click.stop="serviceAction('pm2', 'start')">▶</button>
                                   <button class="svc-btn stop" @click.stop="serviceAction('pm2', 'stop')">⏹</button>
                                   <button class="svc-btn restart" @click.stop="serviceAction('pm2', 'restart')">↻</button>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                    </div>
                    <div v-if="activeApps.length === 0" class="empty-msg" style="padding: 12px 0;">No applications on this node.</div>
                    <div v-else class="apps-list" style="max-height: 250px; overflow-y: auto;">
                       <div v-for="app in activeApps" :key="app.id" class="app-row">
                          <div class="app-info">
                             <span class="app-name">{{ app.name }}</span>
                             <span class="app-meta">Port {{ app.port }}</span>
                          </div>
                          <div class="app-actions">
                             <button class="action-btn small" @click="triggerDeploy(app.id)" title="Deploy latest">▶</button>
                             <button class="action-btn small restore" @click="restoreApp(app.id)" title="Restore version">⏪</button>
                             <button class="action-btn small" @click="lifecycleAction(app.id, 'restart')" title="Restart">↻</button>
                             <button class="icon-btn danger" @click="deleteApp(app.id)" title="Delete">🗑️</button>
                          </div>
                       </div>
                    </div>
                 </div>

                 <!-- Right Column: Domains -->
                 <div class="glass-card provision-card">
                    <!-- Domains Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                       <div style="display: flex; align-items: center; gap: 8px;">
                          <h3 style="margin: 0;">Domains</h3>
                          <span class="badge-mini">{{ activeProxies.length }}</span>
                       </div>
                       <button class="add-app-btn" @click="showAddDomainModal = true" title="Add domain">+</button>
                    </div>
                    <div v-if="activeProxies.length === 0" class="empty-msg" style="padding: 12px 0;">No domains configured.</div>
                    <div v-else class="proxies-list" style="max-height: 250px; overflow-y: auto;">
                       <div v-for="p in activeProxies" :key="p.id" class="proxy-item">
                          <div class="proxy-info">
                             <span class="proxy-domain">{{ p.domain }}</span>
                             <span class="proxy-target">:{{ p.port }}</span>
                          </div>
                          <div class="proxy-actions">
                             <span class="ssl-badge" title="SSL Active">🔒</span>
                             <button class="icon-btn danger" @click="deleteProxy(p.domain)" title="Delete">🗑️</button>
                          </div>
                       </div>
                    </div>
                 </div>

                 <!-- Row 3: Console (full width) -->
                 <div class="glass-card console-mini-card" style="grid-column: 1 / -1;">
                    <div class="console-mini-header">
                       <span>Live Console</span>
                       <button class="expand-btn" @click="showLargeConsole = true">Expand</button>
                    </div>
                    <div class="console-mini-body" ref="consoleContainerMini" style="min-height: 120px; max-height: 180px;">
                       <div v-if="filteredConsoleLogs.length === 0" class="mini-empty">Waiting for logs...</div>
                       <div v-for="(log, idx) in filteredConsoleLogs.slice(-15)" :key="idx" :class="['mini-line', log.stream, log.type]">
                          <span class="mini-content">{{ log.data }}</span>
                       </div>
                    </div>
                 </div>

                 <!-- Terminal (full width, shown when deploying) -->
                 <div class="glass-card terminal-card" v-if="deployStatus || logs.length > 0">
                    <div class="terminal-toolbar">
                       <span>{{ deployStatus || 'Ready' }}</span>
                       <button @click="logs = []">Clear</button>
                    </div>
                    <div class="terminal-body" ref="logContainer">
                       <div v-for="(log, idx) in logs" :key="idx" class="line"><span class="line-content">{{ log.data }}</span></div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ============================================
   LIGHT THEME - MODERN DESIGN SYSTEM
   ============================================ */

/* Light Theme - Direct Colors (scoped doesn't support :root) */
.dashboard-layout { display: flex; min-height: 100vh; background-color: #f5f7fa; }
.sidebar { width: 280px; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; padding: 24px; position: fixed; height: 100vh; background: #1a1f2e; }
.logo { display: flex; align-items: center; gap: 12px; font-size: 1.2rem; font-weight: 800; margin-bottom: 32px; color: #fff; }
.logo-icon { width: 28px; height: 28px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 6px; }
.nav-label { font-size: 0.65rem; color: rgba(255,255,255,0.4); font-weight: 800; letter-spacing: 0.1em; margin: 24px 0 12px 12px; }
nav a { text-decoration: none; color: rgba(255,255,255,0.6); padding: 10px 16px; border-radius: 8px; font-size: 0.85rem; display: block; margin-bottom: 4px; transition: 0.2s; }
nav a:hover, nav a.active { color: #fff; background: rgba(255, 255, 255, 0.1); }
.main-wrapper { flex: 1; margin-left: 280px; background: #f5f7fa; }
.top-bar { height: 64px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; background: #ffffff; backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 50; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.content { padding: 40px; }

/* Glass Card - Base Component */
.glass-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.07);
  transition: box-shadow 0.2s, transform 0.2s;
}
.glass-card:hover {
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
}

/* Gradient Text */
.gradient-text {
  font-size: 1.8rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

/* Terminal Card */
.terminal-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  height: 400px;
  display: flex;
  flex-direction: column;
  grid-column: 1 / -1;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
}
.terminal-toolbar {
  padding: 12px 20px;
  border-bottom: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  font-weight: 500;
  color: #94a3b8;
  background: rgba(255,255,255,0.02);
}
.terminal-toolbar span {
  display: flex;
  align-items: center;
  gap: 8px;
}
.terminal-toolbar span::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}
/* Dynamic Status Colors */
.terminal-card:has(span:contains("ready")) .terminal-toolbar span::before { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.5); }
.terminal-card:has(span:contains("Provisioning")) .terminal-toolbar span::before { background: #f59e0b; animation: pulse 1.5s infinite; }
.terminal-card:has(span:contains("failure")) .terminal-toolbar span::before { background: #ef4444; }

.terminal-toolbar button {
  background: rgba(255,255,255,0.05);
  border: 1px solid #475569;
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
}
.terminal-toolbar button:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: #64748b; }

.terminal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  font-family: 'Fira Code', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  color: #e2e8f0;
}
.line { margin-bottom: 2px; }
.line-content { white-space: pre-wrap; word-break: break-all; }

/* Status Bar - Horizontal Summary */
.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 16px 24px;
  margin-top: 20px;
  gap: 24px;
}
.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.status-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  font-weight: 600;
}
.status-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
}
.status-value.success { color: #10b981; }
.status-value.error { color: #ef4444; }
.status-value.mono { font-family: monospace; font-size: 0.95rem; }

/* Dashboard Grid - 2 Column Layout */
.dashboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 24px; }
.node-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-top: 20px;
}
.form-row {
  display: flex;
  gap: 12px;
}
@media (max-width: 1200px) {
  .node-detail-grid { grid-template-columns: 1fr; }
  .status-bar { flex-wrap: wrap; justify-content: center; }
}

.apps-list { display: flex; flex-direction: column; gap: 8px; }
.app-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f5f7fa; border-radius: 8px; border: 1px solid #e2e8f0; transition: 0.2s; }
.app-row:hover { border-color: #3b82f6; }
.app-info { display: flex; flex-direction: column; gap: 2px; }
.app-name { font-weight: 600; color: #0f172a; font-size: 0.9rem; }
.app-meta { font-size: 0.75rem; color: #64748b; }
.app-actions { display: flex; gap: 8px; align-items: center; }

/* Stats Card */
.stats-card { padding: 24px; display: flex; flex-direction: column; justify-content: space-between; }
.metrics { display: flex; gap: 24px; margin-bottom: 24px; }
.metric { display: flex; flex-direction: column; gap: 4px; }
.metric label { font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.05em; }
.metric .value { font-size: 1.5rem; font-weight: 600; color: #0f172a; }
.metric .value.success { color: #10b981; }
.metric .value.error { color: #ef4444; }
.node-id {
  font-family: monospace;
  font-size: 0.8rem;
  color: #64748b;
  background: #f5f7fa;
  padding: 8px 12px;
  border-radius: 6px;
  word-break: break-all;
  border: 1px solid #e2e8f0;
}

/* Provisioning & Services */
.provision-card { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.provision-card h3 { margin: 0 0 8px 0; font-size: 1.1rem; color: #0f172a; font-weight: 700; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group label { font-size: 0.8rem; color: #64748b; font-weight: 500; }
.form-group input, .form-group select {
  background: #f5f7fa;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
}
.form-group input:focus, .form-group select:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

.proxies-list { display: flex; flex-direction: column; gap: 12px; }
.proxy-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: #f5f7fa;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  transition: 0.2s;
}
.proxy-item:hover { background: #f1f5f9; transform: translateX(4px); }
.proxy-info { display: flex; flex-direction: column; gap: 4px; }
.proxy-domain { font-weight: 600; color: #0f172a; font-size: 0.95rem; }
.proxy-target { font-size: 0.75rem; color: #64748b; font-family: monospace; }
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: 0.2s;
  opacity: 0.6;
}
.icon-btn:hover { opacity: 1; background: #f5f7fa; }
.icon-btn.danger:hover { background: rgba(239,68,68,0.1); }

/* Service Dropdown */
.services-dropdown-wrapper {
  position: relative;
}
.services-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  z-index: 100;
  min-width: 220px;
  padding: 8px;
}
.add-app-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}
.add-app-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 3px 8px rgba(16, 185, 129, 0.4);
}
.services-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f5f7fa;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: 0.2s;
}
.services-toggle-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}
.service-chevron {
  transition: transform 0.2s;
  font-size: 0.7rem;
}
.service-chevron.open {
  transform: rotate(180deg);
}
.service-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  transition: 0.15s;
}
.service-row:hover {
  background: #ffffff;
}
.service-label {
  font-weight: 600;
  color: #0f172a;
  font-size: 0.85rem;
}
.service-actions {
  display: flex;
  gap: 6px;
}
.svc-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 0.75rem;
  transition: 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.svc-btn.start {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.svc-btn.start:hover {
  background: rgba(16, 185, 129, 0.2);
  border-color: #10b981;
}
.svc-btn.stop {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
.svc-btn.stop:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}
.svc-btn.restart {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}
.svc-btn.restart:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
}

.action-btn.small { padding: 8px 12px; font-size: 0.75rem; }

.premium-btn {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(59,130,246,0.3);
}
.premium-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59,130,246,0.4); }

/* GitHub Styles */
.gh-connect-prompt { text-align: center; padding: 12px; }
.gh-connect-prompt p { margin: 0 0 12px 0; font-size: 0.8rem; color: #888; }
.github-btn { 
  background: #24292e; 
  color: #fff; 
  border: 1px solid #000; 
  padding: 10px 16px; 
  border-radius: 6px; 
  font-weight: 600; 
  display: inline-flex; 
  align-items: center; 
  gap: 8px; 
  cursor: pointer;
}
.github-btn:hover { background: #2f363d; }
.gh-icon { width: 16px; height: 16px; background: #fff; mask: url('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png') no-repeat center/contain; -webkit-mask: url('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png') no-repeat center/contain; }
.divider { 
  display: flex; 
  align-items: center; 
  text-align: center; 
  color: #444; 
  font-size: 0.7rem; 
  margin: 16px 0; 
  text-transform: uppercase; 
  letter-spacing: 0.05em;
}
.divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid #222; }
.divider::before { margin-right: .5em; }
.divider::after { margin-left: .5em; }
.load-repo-btn { width: 100%; padding: 8px; background: #222; border: 1px solid #333; color: #fff; cursor: pointer; border-radius: 6px; }
.gh-connected { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #00ffbd; margin-bottom: 8px; }
.link-btn { background: none; border: none; color: #0070f3; text-decoration: underline; cursor: pointer; font-size: 0.75rem; }

/* Apps Grid */
.apps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; margin-top: 32px; }
.app-card { padding: 20px; transition: 0.3s; }
.app-card:hover { transform: translateY(-2px); }
.app-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.app-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 10px; }
.app-meta h4 { margin: 0; font-size: 1rem; color: #0f172a; }
.app-meta p { margin: 0; font-size: 0.75rem; color: #64748b; }
.app-status { margin-left: auto; font-size: 0.7rem; color: #10b981; background: rgba(16,185,129,0.1); padding: 4px 10px; border-radius: 20px; font-weight: 600; }
.app-details { font-size: 0.8rem; color: #64748b; display: flex; gap: 16px; margin-bottom: 20px; }
.app-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.app-actions .action-btn:nth-child(1),
.app-actions .action-btn:nth-child(2) { grid-column: span 1; }
.action-btn { padding: 10px; border-radius: 8px; font-size: 0.8rem; background: #f5f7fa; border: 1px solid #e2e8f0; color: #0f172a; cursor: pointer; transition: 0.2s; }
.action-btn:hover { background: #f1f5f9; border-color: #3b82f6; }
.action-btn.secondary { color: #64748b; }
.action-btn.error { color: #ef4444; }
.action-btn.error:hover { background: rgba(239,68,68,0.1); border-color: #ef4444; }
.action-btn.restore { color: #f59e0b; border-color: rgba(245,158,11,0.3); }
.action-btn.restore:hover { background: rgba(245,158,11,0.1); border-color: #f59e0b; }
.action-btn.small.restore { background: rgba(245,158,11,0.1); color: #f59e0b; border-color: rgba(245,158,11,0.3); }
.action-btn.small.restore:hover { background: rgba(245,158,11,0.2); }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(245, 166, 35, 0.4); }
  70% { box-shadow: 0 0 0 4px rgba(245, 166, 35, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 166, 35, 0); }
}

.modal-card { width: 500px; padding: 32px; background: #ffffff; }
.modal-card h3 { color: #0f172a; margin-bottom: 8px; }
.modal-card label { color: #64748b; font-size: 0.85rem; }
.modal-subtitle { color: #64748b; font-size: 0.85rem; margin-bottom: 20px; }
.ssl-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 8px;
  font-size: 0.85rem;
  color: #059669;
  margin-top: 8px;
}
.ssl-icon { font-size: 1.1rem; }
.target-section {
  margin-top: 12px;
}
.target-section select {
  width: 100%;
  background: #f5f7fa;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}
.git-deploy-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
}
.git-deploy-box label {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
}
.git-deploy-box input {
  width: 100%;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  padding: 10px 12px;
  border-radius: 6px;
  margin: 6px 0 12px;
  font-size: 0.9rem;
}
.git-deploy-box input:last-child {
  margin-bottom: 0;
}
.proxy-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ssl-badge {
  font-size: 0.9rem;
  opacity: 0.7;
}

/* GitHub Integration */
.source-toggle { display: flex; gap: 8px; margin-bottom: 16px; background: #f5f7fa; padding: 4px; border-radius: 8px; }
.source-toggle button { flex: 1; border: none; background: transparent; color: #64748b; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; transition: 0.2s; }
.source-toggle button.active { background: #ffffff; color: #0f172a; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

.github-box { margin-bottom: 16px; background: #f5f7fa; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
.gh-search { display: flex; gap: 8px; margin-bottom: 8px; }
.gh-search input { margin: 0 !important; }
.gh-search button { width: auto; padding: 0 16px; background: #ffffff; border: 1px solid #e2e8f0; color: #0f172a; border-radius: 8px; cursor: pointer; }
.modal-card input, .modal-card select, .modal-card textarea { width: 100%; background: #f5f7fa; border: 1px solid #e2e8f0; color: #0f172a; padding: 12px; border-radius: 8px; margin: 8px 0 16px; font-size: 0.9rem; }
.modal-card textarea { min-height: 100px; font-family: monospace; resize: vertical; }
.modal-actions { display: flex; gap: 12px; margin-top: 20px; }
.modal-actions button { flex: 1; padding: 12px; border-radius: 8px; cursor: pointer; }
.modal-actions .secondary { background: #f5f7fa; border: 1px solid #e2e8f0; color: #0f172a; }

/* Existing components refactored */
.server-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 10px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; transition: 0.2s; }
.server-item:hover { background: rgba(255, 255, 255, 0.05); }
.server-item.selected { background: rgba(255, 255, 255, 0.08); border-color: rgba(255,255,255,0.1); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; }
.online .status-dot { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.5); }
.node-info p { color: #fff; margin: 0; font-size: 0.85rem; }
.node-info span { color: rgba(255,255,255,0.5); font-size: 0.75rem; }
/* Audit Log Styles */
.audit-table {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  padding: 16px;
}
.audit-row {
  display: grid;
  grid-template-columns: 80px 140px 100px 1fr;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.85rem;
  align-items: center;
  transition: background 0.2s;
}
.audit-row:hover { background: #f5f7fa; border-radius: 8px; }
.log-time { color: #94a3b8; font-family: monospace; font-size: 0.75rem; }
.log-server { color: #64748b; font-family: monospace; }
.log-details { color: #64748b; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* MCP Bridge Page */
.mcp-subtitle {
  color: #64748b;
  font-size: 1rem;
  margin-bottom: 32px;
}
.mcp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.mcp-setup-card {
  grid-row: span 2;
  padding: 24px;
}
.mcp-tools-card,
.mcp-examples-card {
  padding: 24px;
}
.mcp-setup-card h3,
.mcp-tools-card h3,
.mcp-examples-card h3 {
  font-size: 1.1rem;
  color: #0f172a;
  margin-bottom: 8px;
}
.mcp-desc {
  color: #64748b;
  font-size: 0.85rem;
  margin-bottom: 20px;
}
.mcp-step {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}
.step-number {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}
.step-content {
  flex: 1;
}
.step-content strong {
  display: block;
  color: #0f172a;
  margin-bottom: 6px;
}
.step-hint {
  color: #64748b;
  font-size: 0.85rem;
}
.config-path {
  display: inline-block;
  background: #f5f7fa;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #64748b;
  font-family: 'JetBrains Mono', monospace;
}
.code-block {
  position: relative;
  background: #1e293b;
  border-radius: 10px;
  padding: 16px;
  margin-top: 8px;
}
.code-block pre {
  color: #e2e8f0;
  font-size: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.5;
  margin: 0;
  overflow-x: auto;
}
.copy-code-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255,255,255,0.1);
  border: none;
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: 0.2s;
}
.copy-code-btn:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
}
.tools-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tool-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 10px;
  transition: 0.2s;
}
.tool-item:hover {
  background: #f1f5f9;
}
.tool-icon {
  font-size: 1.2rem;
}
.tool-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tool-name {
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  color: #0f172a;
}
.tool-desc {
  font-size: 0.75rem;
  color: #64748b;
}
.tool-tag {
  padding: 3px 8px;
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}
.example-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.example-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
}
.example-label {
  padding: 4px 8px;
  background: #e2e8f0;
  color: #64748b;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  min-width: 60px;
  text-align: center;
}
.example-text {
  font-size: 0.85rem;
  color: #0f172a;
  font-style: italic;
}

/* Token Management */
.mcp-tokens-card {
  grid-column: span 2;
  padding: 24px;
}
.mcp-tokens-card h3 {
  font-size: 1.1rem;
  color: #0f172a;
  margin-bottom: 4px;
}
.tokens-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.tokens-header .premium-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
}
.no-tokens {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: #64748b;
  text-align: center;
}
.no-tokens-icon {
  font-size: 2.5rem;
  opacity: 0.5;
}
.tokens-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.token-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}
.token-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.token-prefix {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  color: #0f172a;
  background: #e2e8f0;
  padding: 4px 8px;
  border-radius: 4px;
}
.token-name {
  font-weight: 600;
  color: #334155;
  font-size: 0.85rem;
}
.token-meta {
  color: #94a3b8;
  font-size: 0.75rem;
}
.revoke-btn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #fca5a5;
  color: #ef4444;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  transition: 0.2s;
}
.revoke-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

/* Token Modal */
.token-modal {
  max-width: 500px;
}
.token-modal h2 {
  color: #0f172a;
  margin-bottom: 8px;
}
.modal-subtitle {
  color: #64748b;
  font-size: 0.9rem;
  margin-bottom: 24px;
}
.token-modal .form-group {
  margin-bottom: 20px;
}
.token-modal .form-group label {
  display: block;
  color: #334155;
  font-weight: 500;
  margin-bottom: 8px;
  font-size: 0.9rem;
}
.token-modal .form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: 0.2s;
}
.token-modal .form-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.token-warning {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: #fefce8;
  border: 1px solid #fef08a;
  border-radius: 8px;
  color: #854d0e;
  font-size: 0.85rem;
  margin-bottom: 24px;
}
.token-warning.critical {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}
.token-warning .warning-icon {
  font-size: 1rem;
  flex-shrink: 0;
}
.token-success .success-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}
.token-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #1e293b;
  border-radius: 10px;
  margin-bottom: 20px;
}
.token-value {
  flex: 1;
  color: #10b981;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  word-break: break-all;
}
.copy-token-btn {
  padding: 8px 16px;
  background: rgba(255,255,255,0.1);
  border: none;
  color: #fff;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: 0.2s;
  flex-shrink: 0;
}
.copy-token-btn:hover {
  background: rgba(255,255,255,0.2);
}

.badge-mini {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  background: #f5f7fa;
  border: 1px solid #e2e8f0;
  text-align: center;
  width: fit-content;
}
.badge-mini.status_update { color: #3b82f6; border-color: rgba(59,130,246,0.3); background: rgba(59,130,246,0.1); }
.badge-mini.connection_established { color: #10b981; border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.1); }
.badge-mini.connection_lost { color: #ef4444; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.1); }
.badge-mini.success { color: #10b981; border-color: rgba(16,185,129,0.2); }

/* Onboarding Styles */
/* Infrastructure Overview */
.infra-overview { }
.infra-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.add-node-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}
.add-node-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}
.infra-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}
.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}
.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 800;
  color: #0f172a;
}
.stat-value.success { color: #10b981; }
.stat-label {
  font-size: 0.85rem;
  color: #64748b;
  margin-top: 4px;
}
.nodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.node-card {
  padding: 20px;
  cursor: pointer;
  transition: 0.2s;
}
.node-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}
.node-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.node-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
}
.node-icon.online {
  background: rgba(16, 185, 129, 0.1);
  box-shadow: inset 0 0 0 2px rgba(16, 185, 129, 0.3);
}
.node-icon.online::after {
  content: '';
  width: 12px;
  height: 12px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 8px #10b981;
}
.node-icon.offline::after {
  content: '';
  width: 12px;
  height: 12px;
  background: #ef4444;
  border-radius: 50%;
}
.node-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.node-id {
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.95rem;
  color: #0f172a;
}
.node-status {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}
.node-status.online { color: #10b981; }
.node-status.offline { color: #ef4444; }
.node-card-stats {
  display: flex;
  gap: 24px;
  padding: 12px 0;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 12px;
}
.node-stat {
  display: flex;
  flex-direction: column;
}
.node-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}
.node-stat-label {
  font-size: 0.75rem;
  color: #64748b;
}
.node-card-action {
  color: #3b82f6;
  font-size: 0.85rem;
  font-weight: 500;
}
.empty-infra {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  background: #f8fafc;
  border: 2px dashed #e2e8f0;
  border-radius: 16px;
}
.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}
.empty-infra p {
  color: #64748b;
  margin-bottom: 20px;
}
.node-detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.back-btn {
  padding: 8px 16px;
  background: #f5f7fa;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #64748b;
  font-size: 0.85rem;
  cursor: pointer;
  transition: 0.2s;
}
.back-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.onboarding-view { margin-top: 40px; }
.onboarding-box {
  margin-top: 24px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
}
.sidebar-footer { border-top: 1px solid rgba(255,255,255,0.1); padding: 20px; }
.user-profile { display: flex; gap: 12px; align-items: center; }
.avatar-mini { width: 32px; height: 32px; background: rgba(255,255,255,0.1); border-radius: 50%; background-size: cover; border: 1px solid rgba(255,255,255,0.2); }
.user-info p { font-size: 0.8rem; font-weight: 600; color: #fff; margin: 0; }
.user-info span { font-size: 0.7rem; color: rgba(255,255,255,0.5); }

.console-mini-card {
  display: flex;
  flex-direction: column;
  background: #1e293b;
  border: 1px solid #334155;
  height: 280px;
}
.console-mini-header {
  padding: 12px 16px;
  border-bottom: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.expand-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid #475569;
  color: #94a3b8;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.65rem;
  cursor: pointer;
  transition: 0.2s;
}
.expand-btn:hover { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.console-mini-body {
  flex: 1;
  padding: 12px;
  overflow-y: hidden;
  font-family: 'Fira Code', monospace;
  font-size: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #0f172a;
}
.mini-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #94a3b8; border-left: 2px solid transparent; padding-left: 6px; }
.mini-line.stdout { color: #10b981; }
.mini-line.stderr { color: #ef4444; }
.mini-line.system { color: #3b82f6; font-weight: 700; }
.mini-empty { color: #475569; text-align: center; margin-top: 40px; font-style: italic; }

.expanded-console-card {
  width: 90vw;
  height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  background: #1e293b;
}
.expanded-console-card .console-toolbar { background: #1e293b; border-bottom: 1px solid #334155; padding: 16px 24px; }
.expanded-console-card .console-body { background: #0f172a; padding: 24px; }

/* Deploy Modal */
.deploy-modal-card {
  width: 700px;
  max-width: 90vw;
  height: 500px;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  background: #ffffff;
}
.deploy-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.deploy-info {
  display: flex;
  align-items: center;
  gap: 16px;
}
.deploy-app-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 12px;
}
.deploy-info h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #0f172a;
}
.deploy-repo {
  font-size: 0.8rem;
  color: #64748b;
}
.deploy-status-badge {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: capitalize;
}
.deploy-status-badge.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}
.deploy-status-badge.success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.deploy-status-badge.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
.deploy-console {
  flex: 1;
  background: #0f172a;
  padding: 16px;
  overflow-y: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
}
.deploy-console-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  gap: 16px;
}
.deploy-log-line {
  padding: 2px 0;
  color: #e2e8f0;
  animation: fadeIn 0.2s ease-in;
}
.deploy-log-line.stdout { color: #10b981; }
.deploy-log-line.stderr { color: #fca5a5; }
.log-content { white-space: pre-wrap; word-break: break-word; }
.deploy-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  background: #f8fafc;
}
.deploy-modal-footer .secondary {
  background: #f5f7fa;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  padding: 10px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: 0.2s;
}
.deploy-modal-footer .secondary:hover {
  background: #e2e8f0;
}

/* Restore Modal */
.restore-modal-card {
  width: 550px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  background: #ffffff;
}
.restore-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.restore-modal-header .icon-btn {
  font-size: 1.2rem;
  opacity: 0.5;
}
.restore-tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 24px;
  background: #f8fafc;
}
.restore-tabs button {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: 0.2s;
}
.restore-tabs button:hover {
  color: #0f172a;
}
.restore-tabs button.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}
.restore-content {
  flex: 1;
  overflow-y: auto;
  min-height: 300px;
}
.restore-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 48px;
  color: #64748b;
  gap: 16px;
}
.restore-list {
  padding: 12px;
}
.restore-empty {
  text-align: center;
  padding: 48px;
  color: #64748b;
}
.restore-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: 0.2s;
  border: 1px solid transparent;
}
.restore-item:hover {
  background: #f5f7fa;
  border-color: #e2e8f0;
}
.restore-item-icon {
  font-size: 1.2rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.restore-item-icon.branch {
  background: rgba(16, 185, 129, 0.1);
}
.restore-item-icon.commit {
  background: rgba(59, 130, 246, 0.1);
}
.restore-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.restore-item-name {
  font-weight: 600;
  color: #0f172a;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.restore-item-meta {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.restore-item-action {
  font-size: 0.8rem;
  color: #3b82f6;
  font-weight: 500;
  opacity: 0;
  transition: 0.2s;
}
.restore-item:hover .restore-item-action {
  opacity: 1;
}
.restore-manual {
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.restore-manual p {
  color: #64748b;
  font-size: 0.9rem;
}
.restore-manual input {
  background: #f5f7fa;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  padding: 14px 16px;
  border-radius: 8px;
  font-size: 1rem;
  font-family: monospace;
}
.restore-manual input:focus {
  border-color: #3b82f6;
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.terminal-mini {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 16px 24px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9rem;
  color: #e2e8f0;
  cursor: pointer;
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
  max-width: 800px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.terminal-mini:hover { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.code-line { display: flex; align-items: center; gap: 12px; overflow-x: auto; flex: 1; margin-right: 16px; white-space: nowrap; }
.prompt { color: #f59e0b; font-weight: bold; }
.token { color: #10b981; font-weight: bold; }
.copy-hint {
  font-size: 0.7rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(255,255,255,0.05);
  padding: 4px 8px;
  border-radius: 4px;
}
.status-waiting {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #64748b;
  font-size: 0.9rem;
}
.loader {
  width: 16px;
  height: 16px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-msg { color: #94a3b8; text-align: center; padding: 24px; font-size: 0.9rem; }

/* SSH Assisted Installation Styles */
.connect-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.connect-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: #1e293b;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid #334155;
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #e2e8f0;
}

.tab-btn.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.assisted-setup-box {
  margin-top: 24px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.ssh-form {
  max-width: 420px;
  margin: 0 auto;
  width: 100%;
}

.assisted-desc {
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0;
  text-align: center;
}

.ssh-fields {
  margin-bottom: 8px;
}

.ssh-form .form-row {
  display: flex;
  gap: 12px;
}

.ssh-form .form-group {
  margin-bottom: 16px;
}

.ssh-form .form-group.flex-grow {
  flex: 1;
}

.ssh-form .port-field {
  width: 90px;
}

.ssh-form label {
  display: block;
  margin-bottom: 8px;
  color: #94a3b8;
  font-size: 0.85rem;
}

.ssh-form input,
.ssh-form textarea {
  width: 100%;
  padding: 12px 14px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.9rem;
  font-family: inherit;
}

.ssh-form input::placeholder,
.ssh-form textarea::placeholder {
  color: #475569;
}

.ssh-form textarea.key-textarea {
  resize: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
}

.ssh-form input:focus,
.ssh-form textarea:focus {
  border-color: #3b82f6;
  outline: none;
}

.auth-toggle {
  display: flex;
  gap: 8px;
}

.auth-btn {
  flex: 1;
  padding: 10px 16px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
}

.auth-btn:hover {
  border-color: #3b82f6;
  color: #e2e8f0;
}

.auth-btn.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: transparent;
  color: white;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #3b82f6;
}

.checkbox-label span {
  color: #94a3b8;
  font-size: 0.8rem;
}

.ssh-options {
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
}

.privacy-notice-inline {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #334155;
  color: #64748b;
  font-size: 0.8rem;
  text-align: center;
}

.privacy-notice-inline strong {
  color: #94a3b8;
}

.full-width {
  width: 100%;
}

/* SSH Progress Styles */
.ssh-progress .progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.ssh-progress h3 {
  margin: 0;
  color: #e2e8f0;
}

.cancel-btn {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid #ef4444;
  border-radius: 6px;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.85rem;
}

.cancel-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #64748b;
  font-size: 0.9rem;
}

.progress-step.completed {
  color: #22c55e;
}

.progress-step.active {
  color: #3b82f6;
}

.progress-step.error {
  color: #ef4444;
}

.step-icon {
  width: 24px;
  text-align: center;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #3b82f6;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.status-message {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 0.9rem;
}

.status-message.connecting,
.status-message.preflight,
.status-message.installing {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-message.complete {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-message.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.ssh-terminal {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 16px;
  height: 200px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  margin-bottom: 16px;
}

.terminal-line {
  color: #94a3b8;
  white-space: pre-wrap;
  word-break: break-all;
}

.terminal-placeholder {
  color: #475569;
  font-style: italic;
}

.progress-bar-container {
  height: 6px;
  background: #1e293b;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 20px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.success-actions,
.error-actions {
  text-align: center;
  padding-top: 8px;
}

.success-actions p {
  color: #22c55e;
  margin-bottom: 16px;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.secondary-btn {
  padding: 10px 20px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.secondary-btn:hover {
  border-color: #3b82f6;
  color: #e2e8f0;
}

/* Manual Tab Styles */
.manual-box h3 {
  margin: 0 0 8px 0;
  color: #e2e8f0;
}

.manual-box > p {
  color: #94a3b8;
  margin-bottom: 24px;
}

.manual-steps {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.manual-step {
  display: flex;
  gap: 16px;
}

.step-number {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.step-content p {
  margin: 0 0 8px 0;
  color: #94a3b8;
}

.step-content code {
  display: block;
  padding: 12px 16px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #22c55e;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  word-break: break-all;
}

.step-content code.copyable {
  cursor: pointer;
}

.step-content code.copyable:hover {
  border-color: #3b82f6;
}

.requirements-box {
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.requirements-box h4 {
  margin: 0 0 12px 0;
  color: #fbbf24;
  font-size: 0.9rem;
}

.requirements-box ul {
  margin: 0;
  padding-left: 20px;
}

.requirements-box li {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-bottom: 4px;
}

/* Quick Install Enhancements */
.quick-install-desc {
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0 0 16px 0;
}

.requirements-inline {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #334155;
  color: #64748b;
  font-size: 0.8rem;
}

.requirements-inline span {
  color: #94a3b8;
  font-weight: 500;
}
</style>

<style scoped>
/* Console View Styles */
.console-view { padding-top: 20px; }
.console-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; height: calc(100vh - 200px); display: flex; flex-direction: column; }

.console-toolbar {
  padding: 16px 20px;
  border-bottom: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  background: #1e293b;
}

.console-info { display: flex; gap: 16px; align-items: center; }
.console-server {
  font-family: monospace;
  font-size: 0.85rem;
  color: #10b981;
  background: rgba(16,185,129,0.1);
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid rgba(16,185,129,0.2);
}
.console-count { font-size: 0.75rem; color: #94a3b8; }

.console-controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.filter-group { display: flex; gap: 6px; }

.filter-btn, .toggle-btn, .clear-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid #475569;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover, .toggle-btn:hover, .clear-btn:hover { background: rgba(255,255,255,0.1); border-color: #64748b; }
.filter-btn.active {
  color: #10b981;
  background: rgba(16,185,129,0.1);
  border-color: rgba(16,185,129,0.3);
}
.toggle-btn.active { color: #3b82f6; background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); }
.clear-btn { color: #ef4444; }
.clear-btn:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); }

.console-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  background: #0f172a;
}

.console-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  text-align: center;
}

.empty-icon { font-size: 3rem; margin-bottom: 16px; opacity: 0.5; }
.console-empty p { margin: 8px 0; font-size: 0.9rem; }
.console-empty small { font-size: 0.75rem; color: #475569; }

.console-line {
  display: grid;
  grid-template-columns: 100px 80px 1fr;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255,255,255,0.02);
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}

.console-timestamp { color: #64748b; font-size: 0.7rem; }
.console-stream {
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  width: fit-content;
}

.console-line.stdout .console-stream { color: #10b981; background: rgba(16,185,129,0.1); }
.console-line.stderr .console-stream { color: #ef4444; background: rgba(239,68,68,0.1); }
.console-line.system .console-stream { color: #3b82f6; background: rgba(59,130,246,0.1); }

.console-content { color: #e2e8f0; word-break: break-word; }
.console-line.stderr .console-content { color: #fca5a5; }
.console-line.deployment .console-content { color: #93c5fd; }
/* Login Styles */
.login-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 9999;
}
.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  text-align: center;
  background: #ffffff;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
}
.login-logo { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
.login-card p { color: #64748b; margin-bottom: 32px; font-size: 0.9rem; }
.auth-tabs { display: flex; gap: 20px; justify-content: center; margin-bottom: 24px; }
.auth-tab { color: #94a3b8; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: color 0.3s; }
.auth-tab.active { color: #0f172a; text-decoration: underline; text-underline-offset: 8px; text-decoration-color: #3b82f6; }

.login-form { text-align: left; display: flex; flex-direction: column; gap: 16px; }
.login-form label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
.login-form input {
  background: #f5f7fa;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  padding: 12px;
  border-radius: 8px;
}
.login-form input:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.primary-btn {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(59,130,246,0.3);
}
.primary-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59,130,246,0.4); }
.primary-btn:disabled { opacity: 0.5; cursor: wait; transform: none; }

.oauth-divider {
  margin: 24px 0;
  display: flex;
  align-items: center;
  color: #94a3b8;
  font-size: 0.7rem;
  text-transform: uppercase;
}
.oauth-divider::before, .oauth-divider::after { content: ''; flex: 1; border-bottom: 1px solid #e2e8f0; }
.oauth-divider::before { margin-right: 16px; }
.oauth-divider::after { margin-left: 16px; }

.auth-error { color: #ef4444; font-size: 0.8rem; margin-top: 12px; text-align: center; }

/* Status Badge */
.status-badge { padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
.status-badge.online { color: #10b981; background: rgba(16,185,129,0.1); }
.status-badge.offline { color: #ef4444; background: rgba(239,68,68,0.1); }

/* Service Status Tag */
.service-status-tag { background: rgba(16,185,129,0.1) !important; color: #10b981 !important; }
</style>
