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

const baseUrl = window.location.origin.replace(':5173', ':3000')
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
  alert('Command copied to clipboard!')
}

function provisionDomain() {
  if (!ws || ws.readyState !== 1) return
  if (!domainName.value) return alert('Please enter a domain name')

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
  <div class="container">
    <header>
      <h1>ServerFlow Dashboard</h1>
      <div class="global-status">
        Status: <span :class="['badge', serverStatus]">{{ serverStatus }}</span>
      </div>
    </header>

    <main>
      <!-- Onboarding -->
      <section v-if="!token && serverStatus !== 'online' && !deployStatus">
        <h2>Connect a new server</h2>
        <button @click="generateToken" :disabled="loading">Add Server</button>
      </section>

      <!-- Command to Run -->
      <section v-else-if="token && serverStatus !== 'online' && !deployStatus" class="command-box">
        <h2>Step 2: Run Command</h2>
        <div class="code-block" @click="copyCommand">
          <code>curl -sSL {{ baseUrl }}/install.sh | bash -s -- --token {{ token }} --url {{ baseUrl }}</code>
        </div>
      </section>

      <!-- Dashboard Main -->
      <section v-else class="monitor-box">
        <div class="tabs">
          <button @click="deployStatus = null" :class="{ active: !deployStatus }">Overview</button>
          <button @click="deployStatus = 'idle'" :class="{ active: deployStatus }">Infrastructure</button>
        </div>

        <div v-if="!deployStatus" class="overview">
           <div class="status-card">
              <h3>Server {{ lastServerId }}</h3>
              <p>State: <strong>{{ serverStatus }}</strong></p>
              <div v-if="serverStatus === 'online'">
                 <h4>Setup Domain & SSL</h4>
                 <input v-model="domainName" placeholder="app.example.com" />
                 <input type="number" v-model="appPort" placeholder="3000" />
                 <button @click="provisionDomain">Provision Domain</button>
              </div>
           </div>
        </div>

        <div v-else class="terminal-view">
           <div class="terminal-header" :class="deployStatus">
              <strong>Logs: {{ deployStatus }}</strong>
              <span v-if="deployStatus === 'build_skipped'" class="hint">⚡ Hot-Path: Build skipped</span>
              <span v-if="deployStatus === 'rollback'" class="hint error">🛡️ Auto-Rollback: Health check failed</span>
           </div>
           <div class="terminal" ref="logContainer">
             <div v-for="(log, idx) in logs" :key="idx" :class="['log-line', log.stream]">
               {{ log.data }}
             </div>
           </div>
           <div v-if="deployStatus === 'nginx_ready' || deployStatus === 'success' || deployStatus === 'rollback'" class="footer">
              <span v-if="deployStatus === 'rollback'">System stabilized to last known healthy commit.</span>
              <button @click="deployStatus = null">Back</button>
           </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.container { max-width: 1000px; margin: 0 auto; padding: 2rem; font-family: Inter, sans-serif; color: #eee; }
header { display: flex; justify-content: space-between; border-bottom: 1px solid #333; margin-bottom: 2rem; padding-bottom: 1rem; }
.badge.online { color: #00ff00; }
.monitor-box { background: #0a0a0a; border: 1px solid #222; border-radius: 8px; min-height: 500px; }
.tabs { display: flex; border-bottom: 1px solid #222; }
.tabs button { background: transparent; color: #888; border: none; padding: 1rem 2rem; cursor: pointer; }
.tabs button.active { color: #fff; border-bottom: 2px solid #0070f3; }
.overview { padding: 2rem; }
.status-card { background: #111; padding: 1.5rem; border-radius: 8px; border: 1px solid #222; }
input { background: #000; border: 1px solid #333; color: #fff; padding: 0.8rem; margin: 0.5rem 0; width: 100%; border-radius: 4px; }
.terminal { height: 400px; background: #000; padding: 1.5rem; font-family: monospace; overflow-y: auto; }
.terminal-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; border-bottom: 1px solid #222; }
.terminal-header.rollback { background: rgba(255, 0, 0, 0.1); border-color: #ff4444; }
.hint { font-size: 0.8rem; color: #0070f3; font-weight: bold; }
.hint.error { color: #ff4444; }
.log-line.stderr { color: #ff4444; }
.code-block { background: #000; color: #00ff00; padding: 1rem; border-radius: 4px; }
button { background: #0070f3; color: #fff; border: none; padding: 0.8rem 1.5rem; border-radius: 4px; cursor: pointer; }
.footer { padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: #111; }
</style>
