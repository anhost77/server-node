<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'

const token = ref<string | null>(null)
const loading = ref(false)
const servers = ref<any[]>([])

// Selected Agent
const selectedServerId = ref<string | null>(null)
const activeServer = computed(() => {
  if (!selectedServerId.value && servers.value.length > 0) return servers.value[0]
  return servers.value.find(s => s.id === selectedServerId.value)
})

const serverStatus = computed(() => activeServer.value?.status || 'pending')

// Deployment & Infra
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

function connectWS() {
  ws = new WebSocket(wsUrl)
  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data)
      console.log('[WS] Received:', msg.type)

      if (msg.type === 'INITIAL_STATE') {
        servers.value = msg.servers
      }
      
      if (msg.type === 'SERVER_STATUS') {
        const idx = servers.value.findIndex(s => s.id === msg.serverId)
        if (idx !== -1) servers.value[idx].status = msg.status
        else servers.value.push({ id: msg.serverId, status: msg.status })
      }

      if (msg.type === 'REGISTERED') {
        servers.value.push({ id: msg.serverId, status: 'online' })
      }

      if (msg.type === 'DEPLOY_STATUS') {
        deployStatus.value = msg.status
        if (msg.status === 'cloning') logs.value = []
      }

      if (msg.type === 'DEPLOY_LOG') {
        logs.value.push({ data: msg.data, stream: msg.stream })
        await nextTick()
        if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    } catch (err) { }
  }
  ws.onclose = () => setTimeout(connectWS, 3000)
}

onMounted(() => connectWS())
onUnmounted(() => { if (ws) ws.close() })

async function generateToken() {
  loading.value = true
  try {
    const res = await fetch(`${baseUrl}/api/servers/token`, { method: 'POST' })
    const data = await res.json()
    token.value = data.token
  } catch (err) { } finally { loading.value = false }
}

function copyCommand() {
  const cmd = `curl -sSL ${baseUrl}/install.sh | bash -s -- --token ${token.value} --url ${baseUrl}`
  navigator.clipboard.writeText(cmd)
}

function provisionDomain() {
  if (!ws || ws.readyState !== 1) return
  if (!domainName.value) return 

  ws.send(JSON.stringify({
    type: 'PROVISION_DOMAIN',
    domain: domainName.value,
    port: appPort.value,
    repoUrl: 'https://github.com/example/my-app.git' 
  }))
  deployStatus.value = 'provisioning_nginx'
  logs.value = []
}
</script>

<template>
  <div class="dashboard-layout">
    <!-- Side Nav -->
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-icon"></div>
        <span>ServerFlow</span>
      </div>
      <nav>
        <a href="#" class="active">Infrastructure</a>
        <a href="#">Applications</a>
        <a href="#">Activity</a>
        <a href="#">Settings</a>
      </nav>
      <div class="user-block">
        <div class="avatar"></div>
        <div class="info">
          <p>Admin</p>
          <span>Free Plan</span>
        </div>
      </div>
    </aside>

    <div class="main-wrapper">
      <header class="top-bar">
        <div class="search-box">
          <input type="text" placeholder="Search servers..." />
        </div>
        <div class="actions">
          <span :class="['status-badge', serverStatus]">
             {{ serverStatus === 'online' ? 'Engine Online' : 'System ' + serverStatus }}
          </span>
        </div>
      </header>

      <main class="content">
        <div class="header-section">
          <div>
            <h1 class="gradient-text">Cloud Infrastructure</h1>
            <p class="subtitle">Secure bridge to your private servers.</p>
          </div>
          <button class="premium-btn" @click="generateToken" :disabled="loading" v-if="servers.length === 0 && !token">
            + Connect Server
          </button>
        </div>

        <!-- ONBOARDING FLOW -->
        <div v-if="token && servers.length === 0" class="onboarding-grid">
           <div class="glass-card big-info">
             <div class="step-header">
               <span class="step-num">01</span>
               <h2>Provision your VPS</h2>
             </div>
             <p>Copy this command and run it on your remote server.</p>
             <div class="terminal-mini" @click="copyCommand">
                <code class="code-line">
                  <span class="prompt">$</span> curl -sSL {{ baseUrl }}/install.sh | bash -s -- --token <span class="token">{{ token }}</span> --url {{ baseUrl }}
                </code>
                <span class="copy-hint">Click to copy</span>
             </div>
             <div class="status-waiting">
               <div class="loader"></div>
               <span>Waiting for remote link...</span>
             </div>
           </div>
        </div>

        <!-- MAIN DASHBOARD VIEW -->
        <div v-else-if="servers.length > 0" class="grid-layout">
           <!-- Server Details -->
           <div class="glass-card server-status-card">
              <div class="card-header">
                 <h3>{{ activeServer?.id?.slice(0, 12) || 'Unnamed Server' }}</h3>
                 <span class="id-tag">Active</span>
              </div>
              
              <div class="metrics">
                 <div class="metric">
                    <label>Connection</label>
                    <span :class="['value', serverStatus === 'online' ? 'success' : 'error']">{{ serverStatus }}</span>
                 </div>
                 <div class="metric">
                    <label>Identity</label>
                    <span class="value">Verified</span>
                 </div>
              </div>

              <div class="settings-form" v-if="serverStatus === 'online'">
                 <h4>Network & Domains</h4>
                 <div class="input-group">
                   <label>Public Domain</label>
                   <input v-model="domainName" placeholder="e.g. app.myproject.com" />
                 </div>
                 <div class="input-group">
                   <label>Internal Port</label>
                   <input type="number" v-model="appPort" />
                 </div>
                 <button class="premium-btn full" @click="provisionDomain" :disabled="deployStatus === 'provisioning_nginx'">
                    {{ deployStatus === 'provisioning_nginx' ? 'Provisioning...' : 'Apply Infrastructure' }}
                 </button>
              </div>
              <div v-else class="offline-warning">
                 ⚠️ Server is unreachable. Check your service status.
              </div>
           </div>

           <!-- Deployment Terminal -->
           <div class="glass-card terminal-card" v-if="deployStatus || logs.length > 0">
              <div class="terminal-toolbar">
                 <div class="lights"><span></span><span></span><span></span></div>
                 <div class="title">Deployment Stream</div>
                 <div class="status-pill">{{ deployStatus || 'Monitoring' }}</div>
              </div>
              <div class="terminal-body" ref="logContainer">
                 <div v-for="(log, idx) in logs" :key="idx" :class="['line', log.stream]">
                    <span class="line-time">{{ new Date().toLocaleTimeString() }}</span>
                    <span class="line-content">{{ log.data }}</span>
                 </div>
              </div>
              <div class="terminal-footer" v-if="['success', 'build_skipped', 'nginx_ready', 'rollback'].includes(deployStatus || '')">
                 <button class="premium-btn small" @click="deployStatus = null">Clear</button>
              </div>
           </div>
        </div>

        <!-- EMPTY STATE -->
        <div v-else-if="!token" class="empty-state">
           <h2>No servers connected</h2>
           <p>Start by adding your first server to the orchestration platform.</p>
           <button class="premium-btn" @click="generateToken">Connect Now</button>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.dashboard-layout { display: flex; min-height: 100vh; background-color: var(--bg-color); }
.sidebar { width: 260px; border-right: 1px solid var(--surface-border); display: flex; flex-direction: column; padding: 24px; position: fixed; height: 100vh; }
.logo { display: flex; align-items: center; gap: 12px; font-size: 1.25rem; font-weight: 800; margin-bottom: 48px; }
.logo-icon { width: 32px; height: 32px; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); border-radius: 8px; }
nav { display: flex; flex-direction: column; gap: 8px; flex: 1; }
nav a { text-decoration: none; color: var(--text-muted); padding: 12px 16px; border-radius: 8px; font-size: 0.9rem; transition: all 0.2s; }
nav a.active { color: #fff; background: rgba(255, 255, 255, 0.05); }
.main-wrapper { flex: 1; margin-left: 260px; display: flex; flex-direction: column; }
.top-bar { height: 72px; border-bottom: 1px solid var(--surface-border); display: flex; align-items: center; justify-content: space-between; padding: 0 40px; background: rgba(5, 5, 5, 0.8); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 50; }
.content { padding: 40px; max-width: 1200px; margin: 0 auto; width: 100%; }
.header-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
.terminal-mini { background: #000; border: 1px solid #333; padding: 24px; border-radius: 12px; margin: 24px 0; cursor: pointer; }
.grid-layout { display: grid; grid-template-columns: 350px 1fr; gap: 24px; align-items: start; }
.metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 32px; }
.metric { background: rgba(255, 255, 255, 0.03); padding: 12px; border-radius: 8px; border: 1px solid var(--surface-border); }
.metric .value.success { color: var(--success-color); }
.metric .value.error { color: var(--error-color); }
.terminal-card { display: flex; flex-direction: column; min-height: 500px; background: #000; border-radius: 12px; border: 1px solid var(--surface-border); overflow: hidden; }
.terminal-body { flex: 1; padding: 20px; font-family: var(--font-mono); font-size: 0.85rem; overflow-y: auto; }
.line { display: flex; gap: 16px; margin-bottom: 4px; }
.line-time { color: #444; flex-shrink: 0; }
.line-content { white-space: pre-wrap; color: #eee; }
.loader { width: 16px; height: 16px; border: 2px solid var(--primary-color); border-bottom-color: transparent; border-radius: 50%; animation: rotation 1s linear infinite; }
@keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
input { width: 100%; background: #000; border: 1px solid var(--surface-border); padding: 12px; border-radius: 8px; color: #fff; margin-bottom: 12px; }
.offline-warning { color: var(--error-color); background: rgba(255, 77, 77, 0.1); padding: 12px; border-radius: 8px; font-size: 0.85rem; text-align: center; }
</style>
