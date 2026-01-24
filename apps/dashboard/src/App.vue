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

// Modal Logic
const showAddAppModal = ref(false)
const newApp = ref({ name: '', repoUrl: '', serverId: '', port: 3000, env: '' })

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

const baseUrl = window.location.origin.includes(':517') 
  ? window.location.origin.replace(/:517\d/, ':3000')
  : window.location.origin
const wsUrl = baseUrl.replace('http', 'ws') + '/api/dashboard/ws'

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
        nextTick(() => { if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight })
      } 
      else if (msg.type === 'STATUS_UPDATE') {
        deployStatus.value = msg.status
        if (msg.status === 'nginx_ready' || msg.status === 'failure') refreshData()
      }
      else if (msg.type === 'PROXIES_UPDATE') {
        proxies.value = msg.proxies || []
      }
      else if (msg.type === 'SYSTEM_LOG') {
        consoleLogs.value.push({
          timestamp: Date.now(),
          data: msg.data,
          stream: msg.stream || 'stdout',
          type: msg.source || 'system',
          serverId: msg.serverId
        })
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
  
  const icons: any = { start: '▶️', stop: '⏹️', restart: '🔄' }
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1)
  
  showConfirm(`${actionLabel} ${service.toUpperCase()}`, `Are you sure you want to ${action} ${service}?`, () => {
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
  activeMenu.value = 'infrastructure'
  deployStatus.value = `deploying ${commitHash}...`
  logs.value = []
  try { 
    await request(`/api/apps/${appId}/deploy`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitHash })
    }) 
  } catch(e) {}
}

async function restoreApp(appId: string) {
  const app = apps.value.find(a => a.id === appId)
  showInput('Restore Version', `Enter Git branch, tag or commit hash for ${app?.name}:`, 'main, production, a1b2c3d...', (val) => {
    if (val) triggerDeploy(appId, val)
  })
}

async function deleteApp(appId: string) {
  showConfirm('Delete Application', 'Delete this application and all associated data?', () => {
    request(`/api/apps/${appId}`, { method: 'DELETE' }).then(refreshData)
  })
}

async function lifecycleAction(appId: string, action: 'start' | 'stop' | 'restart') {
  const app = apps.value.find(a => a.id === appId)
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1)
  
  showConfirm(`${actionLabel} App`, `Do you want to ${action} the application "${app?.name}"?`, () => {
    activeMenu.value = 'infrastructure'
    deployStatus.value = `${action}ing...`
    logs.value = []
    request(`/api/apps/${appId}/${action}`, { method: 'POST' }).catch(() => {})
  })
}

function copyCommand() {
  const cmd = `curl -sSL ${baseUrl}/install.sh | bash -s -- --token ${token.value} --url ${baseUrl}`
  navigator.clipboard.writeText(cmd)
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
      
      <h2 style="margin-bottom: 12px; font-weight: 800; font-size: 1.8rem; letter-spacing: -0.02em;">{{ modal.title }}</h2>
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

    <aside class="sidebar">
      <div class="logo"><div class="logo-icon"></div><span>ServerFlow</span></div>
      <div class="nav-label">ORCHESTRATION</div>
      <nav>
        <a href="#" :class="{ active: activeMenu === 'infrastructure' }" @click="activeMenu = 'infrastructure'; if(selectedServerId === 'pending') selectedServerId = null">Infrastructure</a>
        <a href="#" :class="{ active: activeMenu === 'applications' }" @click="activeMenu = 'applications'">Applications</a>
        <a href="#" :class="{ active: activeMenu === 'console' }" @click="activeMenu = 'console'">Live Console</a>
        <a href="#" :class="{ active: activeMenu === 'activity' }" @click="activeMenu = 'activity'; refreshData()">Activity</a>
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
           <div v-if="selectedServerId === 'pending' && token" class="onboarding-view">
              <h1 class="gradient-text">Connect New Node</h1>
              <div class="glass-card onboarding-box">
                <div class="terminal-mini" @click="copyCommand">
                  <code class="code-line"><span class="prompt">$</span> curl -sSL {{ baseUrl }}/install.sh | bash -s -- --token <span class="token">{{ token }}</span> --url {{ baseUrl }}</code>
                  <span class="copy-hint">Click to copy</span>
                </div>
                <div class="status-waiting"><div class="loader"></div> Establishing link...</div>
              </div>
           </div>

           <div v-else-if="activeServer" class="grid-layout">
              <h1 class="gradient-text">Node Details</h1>
              <div class="dashboard-grid">
                 <div class="glass-card stats-card">
                    <div class="metrics">
                       <div class="metric"><label>Status</label><span :class="['value', serverStatus === 'online' ? 'success' : 'error']">{{ serverStatus }}</span></div>
                       <div class="metric"><label>Uptime</label><span class="value">99.9%</span></div>
                    </div>
                    <div class="node-id">ID: {{ activeServer.id }}</div>
                 </div>
                 
                  <!-- System Services (Promoted to Top) -->
                  <div class="glass-card provision-card" style="grid-column: span 2;">
                     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin: 0;">🛠 System Services</h3>
                        <div class="service-status-tag" style="background: rgba(0,255,189,0.1); color: #00ffbd; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">Running</div>
                     </div>
                     <p style="color: #666; font-size: 0.8rem; margin: 0 0 16px 0;">Manage core services on this node.</p>
                     <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="service-block">
                           <div class="service-header">🌐 Nginx (Reverse Proxy)</div>
                           <div style="display: flex; gap: 8px; margin-top: 8px;">
                              <button class="action-btn small" style="background: #111; color: #00ffbd;" @click="serviceAction('nginx', 'start')">▶</button>
                              <button class="action-btn small" style="background: #111; color: #ff4d4d;" @click="serviceAction('nginx', 'stop')">⏹</button>
                              <button class="action-btn small" style="background: #fff; color: #000; flex: 1;" @click="serviceAction('nginx', 'restart')">🔄 Restart</button>
                           </div>
                        </div>
                        <div class="service-block">
                           <div class="service-header">⚙️ PM2 (Process Manager)</div>
                           <div style="display: flex; gap: 8px; margin-top: 8px;">
                              <button class="action-btn small" style="background: #111; color: #00ffbd;" @click="serviceAction('pm2', 'start')">▶</button>
                              <button class="action-btn small" style="background: #111; color: #ff4d4d;" @click="serviceAction('pm2', 'stop')">⏹</button>
                              <button class="action-btn small" style="background: #fff; color: #000; flex: 1;" @click="serviceAction('pm2', 'restart')">🔄 Restart</button>
                           </div>
                        </div>
                     </div>
                  </div>

                  <!-- Quick Console Widget -->
                  <div class="glass-card console-mini-card">
                     <div class="console-mini-header">
                        <span>🛰️ Live Console</span>
                        <button class="expand-btn" @click="showLargeConsole = true">⤢ Expand</button>
                     </div>
                     <div class="console-mini-body" ref="consoleContainerMini">
                        <div v-if="filteredConsoleLogs.length === 0" class="mini-empty">Waiting for logs...</div>
                        <div v-for="(log, idx) in filteredConsoleLogs.slice(-20)" :key="idx" :class="['mini-line', log.stream, log.type]">
                           <span class="mini-content">{{ log.data }}</span>
                        </div>
                     </div>
                  </div>

                  <!-- Domains & Proxies List -->
                  <div class="glass-card provision-card" style="grid-column: span 2;">
                     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">🌐 Proxies & Domains</h3>
                        <span class="badge-mini" style="background: rgba(255,255,255,0.05);">{{ activeProxies.length }} Active</span>
                     </div>
                     <div v-if="activeProxies.length === 0" class="empty-msg" style="padding: 20px;">No domains configured on this node.</div>
                     <div v-else class="proxies-list">
                        <div v-for="p in activeProxies" :key="p.id" class="proxy-item">
                           <div class="proxy-info">
                              <span class="proxy-domain">{{ p.domain }}</span>
                              <span class="proxy-target">port {{ p.port }} <span v-if="p.appId">→ {{ apps.find(a => a.id === p.appId)?.name || 'App' }}</span></span>
                           </div>
                           <div class="proxy-actions">
                              <button class="icon-btn danger" @click="deleteProxy(p.domain)">🗑️</button>
                           </div>
                        </div>
                     </div>
                  </div>

                  <!-- Provisioning Form (Moved Up to fill the hole) -->
                  <div class="glass-card provision-card">
                     <h3>➕ New Proxy</h3>
                     <div class="form-group">
                        <label>Domain Name</label>
                        <input v-model="provisionDomain" type="text" placeholder="api.example.com" />
                     </div>
                     <div class="form-group">
                        <label>Target Application (Optional)</label>
                        <select v-model="provisionAppId">
                           <option :value="null">Manual Port...</option>
                           <option v-for="app in apps.filter(a => a.nodeId === activeServer.id)" :key="app.id" :value="app.id">{{ app.name }}</option>
                        </select>
                     </div>
                     <div class="form-group" v-if="!provisionAppId">
                        <label>Manual Port</label>
                        <input v-model.number="provisionPort" type="number" placeholder="3000" />
                     </div>
                      <button class="premium-btn" @click="triggerProvision">Provision Nginx + SSL</button>
                  </div>

                  <!-- Node Applications List -->
                  <div class="glass-card provision-card" style="grid-column: span 3;">
                     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">🚀 Node Applications</h3>
                        <span class="badge-mini" style="background: rgba(255,255,255,0.05);">{{ activeApps.length }} Services</span>
                     </div>
                     <div v-if="activeApps.length === 0" class="empty-msg" style="padding: 20px;">No applications running on this node.</div>
                     <div v-else class="proxies-list">
                        <div v-for="app in activeApps" :key="app.id" class="proxy-item">
                           <div class="proxy-info">
                              <span class="proxy-domain">{{ app.name }}</span>
                              <span class="proxy-target">{{ app.repoUrl.split('/').pop() }} (Port: {{ app.port }})</span>
                           </div>
                           <div class="proxy-actions" style="display: flex; gap: 8px;">
                              <button class="badge-mini" style="background: #111; cursor: pointer; color: #444;" @click="lifecycleAction(app.id, 'restart')">Restart</button>
                              <button class="badge-mini" style="background: #111; cursor: pointer; color: #0070f3;" @click="restoreApp(app.id)">Restore v...</button>
                              <button class="icon-btn danger" @click="deleteApp(app.id)">🗑️</button>
                           </div>
                        </div>
                     </div>
                  </div>
                 
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
.dashboard-layout { display: flex; min-height: 100vh; background-color: var(--bg-color); }
.sidebar { width: 280px; border-right: 1px solid var(--surface-border); display: flex; flex-direction: column; padding: 24px; position: fixed; height: 100vh; background: #070707; }
.logo { display: flex; align-items: center; gap: 12px; font-size: 1.2rem; font-weight: 800; margin-bottom: 32px; }
.logo-icon { width: 28px; height: 28px; background: linear-gradient(135deg, #0070f3, #7928ca); border-radius: 6px; }
.nav-label { font-size: 0.65rem; color: #444; font-weight: 800; letter-spacing: 0.1em; margin: 24px 0 12px 12px; }
nav a { text-decoration: none; color: #888; padding: 10px 16px; border-radius: 8px; font-size: 0.85rem; display: block; margin-bottom: 4px; transition: 0.2s; }
nav a:hover, nav a.active { color: #fff; background: rgba(255, 255, 255, 0.05); }
.main-wrapper { flex: 1; margin-left: 280px; }
.top-bar { height: 64px; border-bottom: 1px solid var(--surface-border); display: flex; align-items: center; justify-content: space-between; padding: 0 40px; background: rgba(5,5,5,0.8); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 50; }
.content { padding: 40px; }

/* Terminal Card */
.terminal-card { 
  background: #000; 
  border: 1px solid #111; 
  border-radius: 12px; 
  height: 600px; 
  display: flex; 
  flex-direction: column; 
  grid-column: 1 / -1; /* Make terminal take full width of bottom row */
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.terminal-toolbar { 
  padding: 12px 20px; 
  border-bottom: 1px solid #111; 
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  font-size: 0.8rem; 
  font-weight: 500;
  color: #888; 
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
  background: #444;
}
/* Dynamic Status Colors */
.terminal-card:has(span:contains("ready")) .terminal-toolbar span::before { background: #00ffbd; box-shadow: 0 0 8px rgba(0,255,189,0.5); }
.terminal-card:has(span:contains("Provisioning")) .terminal-toolbar span::before { background: #f5a623; animation: pulse 1.5s infinite; }
.terminal-card:has(span:contains("failure")) .terminal-toolbar span::before { background: #ff4d4d; }

.terminal-toolbar button {
  background: transparent;
  border: 1px solid #333;
  color: #666;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
}
.terminal-toolbar button:hover { background: #111; color: #fff; border-color: #444; }

.terminal-body { 
  flex: 1; 
  padding: 20px; 
  overflow-y: auto; 
  font-family: 'Fira Code', monospace; 
  font-size: 0.8rem; 
  line-height: 1.5;
  color: #ccc;
}
.line { margin-bottom: 2px; }
.line-content { white-space: pre-wrap; word-break: break-all; }

/* Dashboard Grid */
.dashboard-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 24px; }

/* Stats Card */
.stats-card { padding: 24px; display: flex; flex-direction: column; justify-content: space-between; }
.metrics { display: flex; gap: 24px; margin-bottom: 24px; }
.metric { display: flex; flex-direction: column; gap: 4px; }
.metric label { font-size: 0.75rem; text-transform: uppercase; color: #666; font-weight: 600; letter-spacing: 0.05em; }
.metric .value { font-size: 1.5rem; font-weight: 600; color: #fff; }
.metric .value.success { color: #00ffbd; }
.metric .value.error { color: #ff4d4d; }
.node-id { 
  font-family: monospace; 
  font-size: 0.8rem; 
  color: #444; 
  background: #111; 
  padding: 8px 12px; 
  border-radius: 6px; 
  word-break: break-all;
}

/* Provisioning & Services */
.provision-card { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.provision-card h3 { margin: 0 0 8px 0; font-size: 1.1rem; color: #fff; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group label { font-size: 0.8rem; color: #888; font-weight: 500; }
.form-group input, .form-group select { 
  background: #000; 
  border: 1px solid #222; 
  color: #fff; 
  padding: 12px; 
  border-radius: 8px; 
  font-size: 0.9rem; 
  transition: border-color 0.2s;
  width: 100%;
}
.form-group input:focus, .form-group select:focus { border-color: #444; outline: none; }

.proxies-list { display: flex; flex-direction: column; gap: 12px; }
.proxy-item { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 14px 18px; 
  background: rgba(255,255,255,0.03); 
  border-radius: 10px; 
  border: 1px solid rgba(255,255,255,0.05);
  transition: 0.2s;
}
.proxy-item:hover { background: rgba(255,255,255,0.05); transform: translateX(4px); }
.proxy-info { display: flex; flex-direction: column; gap: 4px; }
.proxy-domain { font-weight: 600; color: #fff; font-size: 0.95rem; }
.proxy-target { font-size: 0.75rem; color: #666; font-family: monospace; }
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: 0.2s;
  opacity: 0.5;
}
.icon-btn:hover { opacity: 1; background: rgba(255,255,255,0.05); }
.icon-btn.danger:hover { background: rgba(255,77,77,0.1); }

.service-block {
  background: rgba(255,255,255,0.02);
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #222;
}
.service-header { font-size: 0.85rem; font-weight: 600; color: #ccc; }
.action-btn.small { padding: 8px 12px; font-size: 0.75rem; }

.premium-btn {
  background: linear-gradient(135deg, #0070f3, #7928ca);
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;
}
.premium-btn:hover { opacity: 0.9; }

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
.app-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.app-icon { width: 40px; height: 40px; background: #111; border-radius: 10px; border: 1px solid #222; }
.app-meta h4 { margin: 0; font-size: 1rem; }
.app-meta p { margin: 0; font-size: 0.75rem; color: #666; }
.app-status { margin-left: auto; font-size: 0.7rem; color: #00ffbd; background: rgba(0,255,189,0.1); padding: 4px 10px; border-radius: 20px; }
.app-details { font-size: 0.8rem; color: #555; display: flex; gap: 16px; margin-bottom: 20px; }
.app-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.app-actions .action-btn:first-child { grid-column: 1 / -1; }
.action-btn { padding: 10px; border-radius: 8px; font-size: 0.8rem; background: #111; border: 1px solid #222; color: #fff; cursor: pointer; }
.action-btn:hover { background: #222; }
.action-btn.secondary { color: #888; }
.action-btn.error { color: #ff4d4d; }

/* Modal */
.modal-overlay { 
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8); 
  backdrop-filter: blur(4px); 
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

.modal-card { width: 500px; padding: 32px; }

/* GitHub Integration */
.source-toggle { display: flex; gap: 8px; margin-bottom: 16px; background: #111; padding: 4px; border-radius: 8px; }
.source-toggle button { flex: 1; border: none; background: transparent; color: #666; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
.source-toggle button.active { background: #222; color: #fff; font-weight: 600; }

.github-box { margin-bottom: 16px; background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid #222; }
.gh-search { display: flex; gap: 8px; margin-bottom: 8px; }
.gh-search input { margin: 0 !important; }
.gh-search button { width: auto; padding: 0 16px; background: #222; border: 1px solid #333; color: #fff; border-radius: 8px; cursor: pointer; }
.modal-card input, .modal-card select, .modal-card textarea { width: 100%; background: #000; border: 1px solid #222; color: #fff; padding: 12px; border-radius: 8px; margin: 8px 0 16px; font-size: 0.9rem; }
.modal-card textarea { min-height: 100px; font-family: monospace; resize: vertical; }
.modal-actions { display: flex; gap: 12px; margin-top: 20px; }
.modal-actions button { flex: 1; padding: 12px; border-radius: 8px; cursor: pointer; }

/* Existing components refactored */
.server-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 10px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
.server-item.selected { background: rgba(255, 255, 255, 0.03); border-color: #222; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #444; }
.online .status-dot { background: #00ffbd; box-shadow: 0 0 8px #00ffbd; }
.terminal-card { background: #000; border: 1px solid #111; border-radius: 12px; height: 600px; display: flex; flex-direction: column; }
.terminal-toolbar { padding: 12px 20px; border-bottom: 1px solid #111; display: flex; justify-content: space-between; font-size: 0.8rem; color: #666; }
.terminal-body { flex: 1; padding: 20px; overflow-y: auto; font-family: monospace; font-size: 0.8rem; }
/* Audit Log Styles */
.audit-table {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}
.audit-row { 
  display: grid; 
  grid-template-columns: 80px 140px 100px 1fr; 
  gap: 16px; 
  padding: 12px 24px; 
  border-bottom: 1px solid #111; 
  font-size: 0.85rem; 
  align-items: center; 
  transition: background 0.2s;
}
.audit-row:hover { background: rgba(255,255,255,0.02); }
.log-time { color: #666; font-family: monospace; font-size: 0.75rem; }
.log-server { color: #888; font-family: monospace; }
.log-details { color: #aaa; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.badge-mini { 
  padding: 4px 8px; 
  border-radius: 4px; 
  font-size: 0.7rem; 
  font-weight: 600;
  text-transform: uppercase; 
  background: #111; 
  border: 1px solid #222; 
  text-align: center;
  width: fit-content;
}
.badge-mini.status_update { color: #0070f3; border-color: rgba(0,112,243,0.3); background: rgba(0,112,243,0.1); }
.badge-mini.connection_established { color: #00ffbd; border-color: rgba(0,255,189,0.3); background: rgba(0,255,189,0.1); }
.badge-mini.connection_lost { color: #ff4d4d; border-color: rgba(255,77,77,0.3); background: rgba(255,77,77,0.1); }
.badge-mini.success { color: #00ffbd; border-color: rgba(0,255,189,0.2); }

/* Onboarding Styles */
.onboarding-view { margin-top: 40px; }
.onboarding-box { 
  margin-top: 24px; 
  padding: 32px; 
  display: flex; 
  flex-direction: column; 
  gap: 24px; 
  align-items: center;
}
.sidebar-footer { border-top: 1px solid #111; padding: 20px; }
.user-profile { display: flex; gap: 12px; align-items: center; }
.avatar-mini { width: 32px; height: 32px; background: #222; border-radius: 50%; background-size: cover; border: 1px solid #333; }
.user-info p { font-size: 0.8rem; font-weight: 600; color: #fff; margin: 0; }
.user-info span { font-size: 0.7rem; color: #666; }

.console-mini-card { 
  display: flex; 
  flex-direction: column; 
  background: #000; 
  border: 1px solid #111; 
  height: 280px;
}
.console-mini-header { 
  padding: 12px 16px; 
  border-bottom: 1px solid #111; 
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.expand-btn { 
  background: rgba(255,255,255,0.05); 
  border: 1px solid #222; 
  color: #888; 
  padding: 4px 8px; 
  border-radius: 4px; 
  font-size: 0.65rem; 
  cursor: pointer; 
  transition: 0.2s;
}
.expand-btn:hover { background: #fff; color: #000; }
.console-mini-body { 
  flex: 1; 
  padding: 12px; 
  overflow-y: hidden; 
  font-family: 'Fira Code', monospace; 
  font-size: 0.7rem; 
  display: flex; 
  flex-direction: column; 
  gap: 2px;
}
.mini-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #888; border-left: 2px solid transparent; padding-left: 6px; }
.mini-line.stdout { color: #00ffbd; }
.mini-line.stderr { color: #ff4d4d; }
.mini-line.system { color: #0070f3; font-weight: 700; }
.mini-empty { color: #333; text-align: center; margin-top: 40px; font-style: italic; }

.expanded-console-card { 
  width: 90vw; 
  height: 85vh; 
  display: flex; 
  flex-direction: column; 
  padding: 0; 
  overflow: hidden; 
}
.expanded-console-card .console-toolbar { background: #070707; border-bottom: 1px solid #222; padding: 16px 24px; }
.expanded-console-card .console-body { background: #000; padding: 24px; }

.terminal-mini {
  background: #000;
  border: 1px solid #222;
  border-radius: 8px;
  padding: 16px 24px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9rem;
  color: #ccc;
  cursor: pointer;
  position: relative;
  transition: border-color 0.2s;
  width: 100%;
  max-width: 800px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.terminal-mini:hover { border-color: #444; }
.code-line { display: flex; align-items: center; gap: 12px; overflow-x: auto; flex: 1; margin-right: 16px; white-space: nowrap; }
.prompt { color: #f5a623; font-weight: bold; }
.token { color: #00ffbd; font-weight: bold; }
.copy-hint {
  font-size: 0.7rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #111;
  padding: 4px 8px;
  border-radius: 4px;
}
.status-waiting {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #888;
  font-size: 0.9rem;
}
.loader {
  width: 16px; 
  height: 16px; 
  border: 2px solid #333; 
  border-top-color: #0070f3; 
  border-radius: 50%; 
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

<style scoped>
/* Console View Styles */
.console-view { padding-top: 20px; }
.console-card { background: #000; border: 1px solid #111; border-radius: 12px; height: calc(100vh - 200px); display: flex; flex-direction: column; }

.console-toolbar { 
  padding: 16px 20px; 
  border-bottom: 1px solid #111; 
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.console-info { display: flex; gap: 16px; align-items: center; }
.console-server { 
  font-family: monospace; 
  font-size: 0.85rem; 
  color: #00ffbd; 
  background: rgba(0,255,189,0.1); 
  padding: 4px 12px; 
  border-radius: 6px;
  border: 1px solid rgba(0,255,189,0.2);
}
.console-count { font-size: 0.75rem; color: #666; }

.console-controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.filter-group { display: flex; gap: 6px; }

.filter-btn, .toggle-btn, .clear-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  background: #111;
  border: 1px solid #222;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover, .toggle-btn:hover, .clear-btn:hover { background: #1a1a1a; border-color: #333; }
.filter-btn.active { 
  color: #00ffbd; 
  background: rgba(0,255,189,0.1); 
  border-color: rgba(0,255,189,0.3);
}
.toggle-btn.active { color: #0070f3; background: rgba(0,112,243,0.1); border-color: rgba(0,112,243,0.3); }
.clear-btn { color: #ff4d4d; }
.clear-btn:hover { background: rgba(255,77,77,0.1); border-color: rgba(255,77,77,0.3); }

.console-body { 
  flex: 1; 
  padding: 20px; 
  overflow-y: auto; 
  font-family: 'Fira Code', 'Consolas', monospace; 
  font-size: 0.8rem;
  line-height: 1.6;
}

.console-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #444;
  text-align: center;
}

.empty-icon { font-size: 3rem; margin-bottom: 16px; opacity: 0.5; }
.console-empty p { margin: 8px 0; font-size: 0.9rem; }
.console-empty small { font-size: 0.75rem; color: #333; }

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

.console-timestamp { color: #444; font-size: 0.7rem; }
.console-stream { 
  font-size: 0.7rem; 
  text-transform: uppercase; 
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  width: fit-content;
}

.console-line.stdout .console-stream { color: #00ffbd; background: rgba(0,255,189,0.1); }
.console-line.stderr .console-stream { color: #ff4d4d; background: rgba(255,77,77,0.1); }
.console-line.system .console-stream { color: #0070f3; background: rgba(0,112,243,0.1); }

.console-content { color: #ccc; word-break: break-word; }
.console-line.stderr .console-content { color: #ff9999; }
.console-line.deployment .console-content { color: #aaf; }
/* Login Styles */
.login-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top right, #111, #000);
  z-index: 9999;
}
.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  text-align: center;
}
.login-logo { font-size: 2rem; font-weight: 800; color: #fff; margin-bottom: 8px; }
.login-card p { color: #666; margin-bottom: 32px; font-size: 0.9rem; }
.auth-tabs { display: flex; gap: 20px; justify-content: center; margin-bottom: 24px; }
.auth-tab { color: #444; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: color 0.3s; }
.auth-tab.active { color: #fff; text-decoration: underline; text-underline-offset: 8px; }

.login-form { text-align: left; display: flex; flex-direction: column; gap: 16px; }
.login-form label { font-size: 0.75rem; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }
.login-form input { 
  background: rgba(255,255,255,0.05); 
  border: 1px solid #222; 
  color: #fff; 
  padding: 12px; 
  border-radius: 8px; 
}
.primary-btn { 
  background: #fff; 
  color: #000; 
  border: none; 
  padding: 12px; 
  border-radius: 8px; 
  font-weight: 600; 
  cursor: pointer; 
  margin-top: 8px; 
  transition: opacity 0.2s;
}
.primary-btn:hover { opacity: 0.9; }
.primary-btn:disabled { opacity: 0.5; cursor: wait; }

.oauth-divider { 
  margin: 24px 0; 
  display: flex; 
  align-items: center; 
  color: #333; 
  font-size: 0.7rem; 
  text-transform: uppercase; 
}
.oauth-divider::before, .oauth-divider::after { content: ''; flex: 1; border-bottom: 1px solid #111; }
.oauth-divider::before { margin-right: 16px; }
.oauth-divider::after { margin-left: 16px; }

.auth-error { color: #ff4d4d; font-size: 0.8rem; margin-top: 12px; text-align: center; }
</style>
