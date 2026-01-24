<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const token = ref<string | null>(null)
const loading = ref(false)
const serverStatus = ref<'online' | 'offline' | 'pending'>('pending')
const lastServerId = ref<string | null>(null)

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
      if (msg.type === 'SERVER_STATUS') {
        serverStatus.value = msg.status
        lastServerId.value = msg.serverId
      }
      if (msg.type === 'DEPLOY_STATUS') {
        deployStatus.value = msg.status
        if (msg.status === 'cloning') logs.value = []
      }
      if (msg.type === 'DEPLOY_LOG') {
        logs.value.push({ data: msg.data, stream: msg.stream })
        await nextTick()
        if (logContainer.value) {
          logContainer.value.scrollTop = logContainer.value.scrollHeight
        }
      }
    } catch (err) { }
  }
  ws.onclose = () => {
    console.log('Dashboard WS closed, retrying in 3s...')
    setTimeout(connectWS, 3000)
  }
}

onMounted(() => connectWS())
onUnmounted(() => { if (ws) ws.close() })

async function generateToken() {
  loading.value = true
  try {
    const res = await fetch(`${baseUrl}/api/servers/token`, { method: 'POST' })
    const data = await res.json()
    token.value = data.token
    deployStatus.value = null // Reset view
  } catch (err) {
    console.error('API Error:', err)
  } finally {
    loading.value = false
  }
}

function copyCommand() {
  const cmd = `curl -sSL ${baseUrl}/install.sh | bash -s -- --token ${token.value} --url ${baseUrl}`
  navigator.clipboard.writeText(cmd)
  // Subtle visual feedback
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
        <a href="#" class="active"><i class="icon"></i> Infrastructure</a>
        <a href="#"><i class="icon"></i> Applications</a>
        <a href="#"><i class="icon"></i> Activity</a>
        <a href="#"><i class="icon"></i> Settings</a>
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
      <!-- Top Bar -->
      <header class="top-bar">
        <div class="search-box">
          <input type="text" placeholder="Search servers or apps..." />
        </div>
        <div class="actions">
          <span :class="['status-badge', serverStatus]">
            {{ serverStatus === 'online' ? 'Engine Online' : 'System ' + serverStatus }}
          </span>
          <button class="icon-btn notification"></button>
        </div>
      </header>

      <!-- Content -->
      <main class="content">
        <div class="header-section">
          <div>
            <h1 class="gradient-text">Cloud Infrastructure</h1>
            <p class="subtitle">Secure, Zero-Trust bridge to your private servers.</p>
          </div>
          <button class="premium-btn" @click="generateToken" :disabled="loading" v-if="!token && serverStatus !== 'online'">
            {{ loading ? '...' : '+ Connect Server' }}
          </button>
        </div>

        <!-- ONBOARDING FLOW -->
        <div v-if="token && serverStatus !== 'online' && !deployStatus" class="onboarding-grid">
           <div class="glass-card big-info">
             <div class="step-header">
               <span class="step-num">01</span>
               <h2>Provision your VPS</h2>
             </div>
             <p>Copy this unique command and run it on any Ubuntu/Debian server. It will install the agent and pair it securely.</p>
             
             <div class="terminal-mini" @click="copyCommand">
                <code class="code-line">
                  <span class="prompt">$</span> curl -sSL {{ baseUrl }}/install.sh | bash -s -- --token <span class="token">{{ token }}</span>
                </code>
                <span class="copy-hint">Click to copy</span>
             </div>

             <div class="status-waiting">
               <div class="loader"></div>
               <span>Waiting for server response...</span>
             </div>
           </div>

           <aside class="onboarding-tips">
              <div class="glass-card tip">
                 <h3>💡 Requirements</h3>
                 <ul>
                   <li>Ubuntu 20.04+ (Recommended)</li>
                   <li>Node.js (Installed automatically)</li>
                   <li>Sudo & Internet access</li>
                 </ul>
              </div>
           </aside>
        </div>

        <!-- MAIN DASHBOARD VIEW -->
        <div v-else-if="serverStatus === 'online' || deployStatus" class="grid-layout">
           <!-- Server Details -->
           <div class="glass-card server-status-card">
              <div class="card-header">
                 <h3>Primary Instance</h3>
                 <span class="id-tag">#{{ lastServerId?.slice(0,8) }}</span>
              </div>
              
              <div class="metrics">
                 <div class="metric">
                    <label>Connection</label>
                    <span class="value success">Stable</span>
                 </div>
                 <div class="metric">
                    <label>Identity</label>
                    <span class="value">Ed25519 Verified</span>
                 </div>
              </div>

              <div class="settings-form">
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
           </div>

           <!-- Deployment Terminal -->
           <div class="glass-card terminal-card" v-if="deployStatus || logs.length > 0">
              <div class="terminal-toolbar">
                 <div class="lights"><span></span><span></span><span></span></div>
                 <div class="title">
                   <span v-if="deployStatus === 'build_skipped'">⚡ Optimized Build</span>
                   <span v-else-if="deployStatus === 'rollback'" class="error">🛡️ Recovery Mode</span>
                   <span v-else>Active Deployment Stream</span>
                 </div>
                 <div class="status-pill">{{ deployStatus || 'Monitoring' }}</div>
              </div>
              
              <div class="terminal-body" ref="logContainer">
                 <div v-for="(log, idx) in logs" :key="idx" :class="['line', log.stream]">
                    <span class="line-time">{{ new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}) }}</span>
                    <span class="line-content">{{ log.data }}</span>
                 </div>
                 <div v-if="logs.length === 0" class="terminal-empty">
                    📡 Listening for event stream...
                 </div>
              </div>

              <div class="terminal-footer" v-if="deployStatus === 'success' || deployStatus === 'build_skipped' || deployStatus === 'nginx_ready'">
                 <div class="msg success">Task completed successfully.</div>
                 <button class="premium-btn small" @click="deployStatus = null">Clear</button>
              </div>
              <div class="terminal-footer" v-if="deployStatus === 'rollback'">
                 <div class="msg error">Health check failed. System rolled back to last stable version.</div>
                 <button class="premium-btn small" @click="deployStatus = null">Acknowledge</button>
              </div>
           </div>
        </div>

        <!-- EMPTY STATE -->
        <div v-else class="empty-state">
           <div class="empty-icon"></div>
           <h2>No servers connected</h2>
           <p>Start your journey by adding your first server to the orchestration platform.</p>
           <button class="premium-btn" @click="generateToken">Connect Now</button>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.dashboard-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--bg-color);
}

/* Sidebar */
.sidebar {
  width: 260px;
  border-right: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  padding: 24px;
  position: fixed;
  height: 100vh;
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.25rem;
  font-weight: 800;
  margin-bottom: 48px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  border-radius: 8px;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

nav a {
  text-decoration: none;
  color: var(--text-muted);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

nav a:hover, nav a.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.user-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--surface-border);
}

.avatar {
  width: 40px;
  height: 40px;
  background: #222;
  border-radius: 50%;
}

.info p { font-size: 0.85rem; font-weight: 600; margin: 0; }
.info span { font-size: 0.75rem; color: var(--text-muted); }

/* Main Wrapper */
.main-wrapper {
  flex: 1;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
}

.top-bar {
  height: 72px;
  border-bottom: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  background: rgba(5, 5, 5, 0.8);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 90;
}

.search-box input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--surface-border);
  padding: 8px 16px;
  border-radius: 20px;
  color: #fff;
  width: 300px;
}

.content {
  padding: 40px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 40px;
}

h1 { font-size: 2.5rem; margin-bottom: 8px; }
.subtitle { color: var(--text-muted); font-size: 1.1rem; }

/* Onboarding */
.onboarding-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
}

.big-info {
  padding: 40px;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.step-num {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  padding: 4px 8px;
  border-radius: 4px;
}

.terminal-mini {
  background: #000;
  border: 1px solid #333;
  padding: 24px;
  border-radius: 12px;
  margin: 24px 0;
  position: relative;
  cursor: pointer;
  transition: border-color 0.2s;
}

.terminal-mini:hover { border-color: var(--primary-color); }

.code-line { font-family: var(--font-mono); color: #ccc; }
.prompt { color: var(--primary-color); margin-right: 8px; }
.token { color: var(--success-color); }
.copy-hint { position: absolute; right: 16px; top: 16px; font-size: 0.7rem; color: #555; text-transform: uppercase; }

.status-waiting {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* Grid Layout */
.grid-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 24px;
  align-items: start;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 32px;
}

.metric {
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}

.metric label { display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
.metric .value { font-size: 0.9rem; font-weight: 600; }
.metric .value.success { color: var(--success-color); }

.input-group { margin-bottom: 16px; }
.input-group label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px; }
.input-group input {
  width: 100%;
  background: rgba(0,0,0,0.5);
  border: 1px solid var(--surface-border);
  padding: 12px;
  border-radius: 8px;
  color: #fff;
}

.premium-btn.full { width: 100%; margin-top: 12px; }

/* Terminal Card */
.terminal-card {
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.terminal-toolbar {
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  gap: 16px;
}

.lights { display: flex; gap: 6px; }
.lights span { width: 10px; height: 10px; border-radius: 50%; background: #333; }
.lights span:nth-child(1) { background: #ff5f56; }
.lights span:nth-child(2) { background: #ffbd2e; }
.lights span:nth-child(3) { background: #27c93f; }

.terminal-toolbar .title { flex: 1; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); }
.status-pill { font-size: 0.65rem; padding: 2px 8px; background: rgba(255,255,255,0.1); border-radius: 4px; text-transform: uppercase; font-weight: 700; }

.terminal-body {
  flex: 1;
  padding: 20px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.6;
  overflow-y: auto;
  background: #000;
}

.line { display: flex; gap: 16px; }
.line-time { color: #444; flex-shrink: 0; }
.line.stderr .line-content { color: var(--error-color); }
.line-content { white-space: pre-wrap; word-break: break-all; }

.terminal-footer {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-top: 1px solid var(--surface-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.msg.success { color: var(--success-color); font-weight: 600; font-size: 0.9rem; }
.msg.error { color: var(--error-color); font-weight: 600; font-size: 0.9rem; }

.loader {
  width: 16px;
  height: 16px;
  border: 2px solid var(--primary-color);
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: rotation 1s linear infinite;
}

@keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.empty-state {
  text-align: center;
  padding: 100px 0;
}

.server-status-card {
    padding: 24px;
}
</style>
