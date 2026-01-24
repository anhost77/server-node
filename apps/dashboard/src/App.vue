<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'

const token = ref<string | null>(null)
const loading = ref(false)
const servers = ref<any[]>([])
const auditLogs = ref<any[]>([])
const activeMenu = ref('infrastructure')

// Selected Agent
const selectedServerId = ref<string | null>(null)
const activeServer = computed(() => {
  if (!selectedServerId.value && servers.value.length > 0) return servers.value[0]
  return servers.value.find(s => s.id === selectedServerId.value)
})

const serverStatus = computed(() => activeServer.value?.status || 'offline')

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

async function fetchAuditLogs() {
  try {
    const res = await fetch(`${baseUrl}/api/audit/logs`)
    auditLogs.value = await res.json()
  } catch (err) {}
}

function connectWS() {
  ws = new WebSocket(wsUrl)
  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data)

      if (msg.type === 'INITIAL_STATE') {
        servers.value = msg.servers
      }
      
      if (msg.type === 'SERVER_STATUS') {
        const idx = servers.value.findIndex(s => s.id === msg.serverId)
        if (idx !== -1) servers.value[idx].status = msg.status
        else servers.value.push({ id: msg.serverId, status: msg.status })
      }

      if (msg.type === 'AUDIT_UPDATE') {
        auditLogs.value.unshift(msg.log)
        if (auditLogs.value.length > 500) auditLogs.value.pop()
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

onMounted(() => {
  connectWS()
  fetchAuditLogs()
})
onUnmounted(() => { if (ws) ws.close() })

async function generateToken() {
  loading.value = true
  try {
    const res = await fetch(`${baseUrl}/api/servers/token`, { method: 'POST' })
    const data = await res.json()
    token.value = data.token
    selectedServerId.value = 'pending'
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
      
      <div class="nav-label">ORCHESTRATION</div>
      <nav>
        <a href="#" :class="{ active: activeMenu === 'infrastructure' }" @click="activeMenu = 'infrastructure'">Infrastructure</a>
        <a href="#" :class="{ active: activeMenu === 'applications' }" @click="activeMenu = 'applications'">Applications</a>
        <a href="#" :class="{ active: activeMenu === 'activity' }" @click="activeMenu = 'activity'; fetchAuditLogs()">Activity</a>
        <a href="#" :class="{ active: activeMenu === 'settings' }" @click="activeMenu = 'settings'">Settings</a>
      </nav>

      <div class="nav-label">MANAGEMENT</div>
      <nav>
        <a href="#" @click="generateToken" :style="{ color: selectedServerId === 'pending' ? '#fff' : '' }">
           + Connect Node
        </a>
      </nav>

      <div class="nav-label">ACTIVE SERVERS</div>
      <div class="server-list">
        <div v-for="s in servers" :key="s.id" 
             class="server-item" 
             :class="{ selected: selectedServerId === s.id, online: s.status === 'online' }"
             @click="selectedServerId = s.id; activeMenu = 'infrastructure'">
           <div class="status-dot"></div>
           <div class="node-info">
             <p>{{ s.id.slice(0, 12) }}</p>
             <span>{{ s.status }}</span>
           </div>
        </div>
      </div>
    </aside>

    <div class="main-wrapper">
      <header class="top-bar">
        <div class="search-box"><input type="text" placeholder="Search..." /></div>
        <div class="actions">
          <span :class="['status-badge', serverStatus]" v-if="selectedServerId !== 'pending'">
             {{ serverStatus === 'online' ? 'Engine Online' : 'Node Offline' }}
          </span>
        </div>
      </header>

      <main class="content">
        <!-- ACTIVITY VIEW -->
        <div v-if="activeMenu === 'activity'" class="activity-view">
           <h1 class="gradient-text">Global activity</h1>
           <p class="subtitle">Structured audit trail of all infrastructure events.</p>
           
           <div class="glass-card audit-table">
              <div v-for="log in auditLogs" :key="log.id" class="audit-row">
                 <div class="log-time">{{ new Date(log.timestamp).toLocaleString() }}</div>
                 <div class="log-type">
                    <span :class="['badge-mini', log.status]">{{ log.type.replace('_', ' ') }}</span>
                 </div>
                 <div class="log-server">Node: {{ log.serverId.slice(0,8) }}</div>
                 <div class="log-details">{{ JSON.stringify(log.details) }}</div>
              </div>
              <div v-if="auditLogs.length === 0" class="empty-msg">No logs found.</div>
           </div>
        </div>

        <!-- INFRASTRUCTURE VIEW -->
        <div v-else-if="activeMenu === 'infrastructure'">
           <div v-if="selectedServerId === 'pending' && token" class="onboarding-view">
              <h1 class="gradient-text">Add New Instance</h1>
              <div class="glass-card big-info">
                 <div class="terminal-mini" @click="copyCommand">
                   <code class="code-line"><span class="prompt">$</span> curl ... --token {{ token }}</code>
                   <span class="copy-hint">Copy</span>
                 </div>
                 <div class="status-waiting">Establishing link...</div>
              </div>
           </div>

           <div v-else-if="activeServer" class="grid-layout">
              <div class="header-section">
                <h1 class="gradient-text">Node Details</h1>
                <p class="subtitle">Instance ID: {{ activeServer.id }}</p>
              </div>

              <div class="dashboard-grid">
                 <div class="glass-card stats-card">
                    <div class="metrics">
                       <div class="metric"><label>Handshake</label><span :class="['value', serverStatus === 'online' ? 'success' : 'error']">Ed25519 OK</span></div>
                       <div class="metric"><label>Uptime</label><span class="value">99.9%</span></div>
                    </div>
                    <div class="settings-form" v-if="serverStatus === 'online'">
                       <h4>Configuration</h4>
                       <input v-model="domainName" placeholder="Domain" />
                       <input v-model="appPort" type="number" />
                       <button class="premium-btn full" @click="provisionDomain" :disabled="deployStatus === 'provisioning_nginx'">Apply</button>
                    </div>
                 </div>

                 <div class="glass-card terminal-card" v-if="deployStatus || logs.length > 0">
                    <div class="terminal-toolbar">
                       <div class="title">System Stream</div>
                       <div class="status-pill">{{ deployStatus || 'Ready' }}</div>
                    </div>
                    <div class="terminal-body" ref="logContainer">
                       <div v-for="(log, idx) in logs" :key="idx" class="line">
                          <span class="line-content">{{ log.data }}</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <!-- OTHERS -->
        <div v-else class="empty-state">
           <h1>{{ activeMenu }}</h1>
           <p>This module is coming soon.</p>
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
nav a { text-decoration: none; color: #888; padding: 10px 16px; border-radius: 8px; font-size: 0.85rem; display: block; margin-bottom: 4px; }
nav a:hover, nav a.active { color: #fff; background: rgba(255, 255, 255, 0.05); }
.server-list { flex: 1; overflow-y: auto; }
.server-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 10px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
.server-item.selected { background: rgba(0, 112, 243, 0.08); border-color: rgba(0, 112, 243, 0.2); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #444; }
.server-item.online .status-dot { background: #00ffbd; box-shadow: 0 0 8px #00ffbd; }
.node-info p { font-size: 0.85rem; font-weight: 600; margin: 0; }
.node-info span { font-size: 0.7rem; color: #555; }
.main-wrapper { flex: 1; margin-left: 280px; }
.top-bar { height: 64px; border-bottom: 1px solid var(--surface-border); display: flex; align-items: center; justify-content: space-between; padding: 0 40px; background: rgba(5,5,5,0.8); backdrop-filter: blur(12px); position: sticky; top: 0; }
.content { padding: 40px; max-width: 1400px; margin: 0 auto; }
.audit-table { padding: 0; overflow: hidden; }
.audit-row { display: grid; grid-template-columns: 200px 180px 150px 1fr; gap: 20px; padding: 16px 24px; border-bottom: 1px solid #111; font-size: 0.85rem; align-items: center; }
.audit-row:hover { background: rgba(255,255,255,0.02); }
.badge-mini { padding: 2px 8px; border-radius: 4px; background: #222; color: #888; font-size: 0.7rem; text-transform: uppercase; }
.badge-mini.success { color: #00ffbd; background: rgba(0,255,189,0.1); }
.badge-mini.failure { color: #ff4d4d; background: rgba(255,77,77,0.1); }
.log-details { color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.terminal-mini { background: #000; padding: 24px; border-radius: 12px; border: 1px solid #222; }
.grid-layout { display: grid; grid-template-columns: 400px 1fr; gap: 24px; }
.terminal-card { background: #000; min-height: 500px; border-radius: 12px; border: 1px solid #222; display: flex; flex-direction: column; }
.terminal-body { flex: 1; padding: 20px; font-family: monospace; font-size: 0.8rem; overflow-y: auto; }
.line-content { white-space: pre-wrap; color: #aaa; }
</style>
