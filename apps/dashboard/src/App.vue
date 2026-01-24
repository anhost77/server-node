<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const token = ref<string | null>(null)
const loading = ref(false)
const serverStatus = ref<'online' | 'offline' | 'pending'>('pending')
const lastServerId = ref<string | null>(null)

// Deployment Monitoring
const deployStatus = ref<string | null>(null)
const logs = ref<{ data: string, stream: string }[]>([])
const logContainer = ref<HTMLElement | null>(null)

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
        if (msg.status === 'cloning') logs.value = [] // Reset logs on new deploy
      }

      if (msg.type === 'DEPLOY_LOG') {
        logs.value.push({ data: msg.data, stream: msg.stream })
        await nextTick()
        if (logContainer.value) {
          logContainer.value.scrollTop = logContainer.value.scrollHeight
        }
      }

    } catch (err) {
      console.error('WS Message parsing error', err)
    }
  }
  ws.onclose = () => {
    setTimeout(connectWS, 3000)
  }
}

onMounted(() => {
  connectWS()
})

onUnmounted(() => {
  if (ws) ws.close()
})

async function generateToken() {
  loading.value = true
  try {
    const res = await fetch(`${baseUrl}/api/servers/token`, { method: 'POST' })
    const data = await res.json()
    token.value = data.token
  } catch (err) {
    console.error('Failed to generate token', err)
  } finally {
    loading.value = false
  }
}

function copyCommand() {
  const cmd = `curl -sSL ${baseUrl}/install.sh | bash -s -- --token ${token.value} --url ${baseUrl}`
  navigator.clipboard.writeText(cmd)
  alert('Command copied to clipboard!')
}
</script>

<template>
  <div class="container">
    <header>
      <h1>ServerFlow Dashboard</h1>
      <div class="global-status">
        Status: 
        <span :class="['badge', serverStatus]">
          {{ serverStatus === 'online' ? '● Connected' : serverStatus === 'offline' ? '○ Disconnected' : '○ Waiting' }}
        </span>
      </div>
    </header>

    <main>
      <!-- Registration Step -->
      <section v-if="!token && serverStatus !== 'online' && !deployStatus">
        <h2>Connect a new server</h2>
        <p>Run a single command on your VPS to install the agent and link it to this dashboard.</p>
        <button @click="generateToken" :disabled="loading">
          {{ loading ? 'Generating...' : 'Add Server' }}
        </button>
      </section>

      <!-- Command to Run -->
      <section v-else-if="token && serverStatus !== 'online' && !deployStatus" class="command-box">
        <h2>Step 2: Run this command</h2>
        <p>Copy and paste this into your VPS terminal:</p>
        <div class="code-block" @click="copyCommand">
          <code>curl -sSL {{ baseUrl }}/install.sh | bash -s -- --token {{ token }} --url {{ baseUrl }}</code>
        </div>
        <button @click="copyCommand">Copy Command</button>
        <button @click="token = null" class="secondary">Back</button>
      </section>

      <!-- Connection/Deployment Monitoring -->
      <section v-else-if="serverStatus === 'online' || deployStatus" class="monitor-box">
        <div class="monitor-header">
          <div class="app-info">
            <span class="pulse"></span>
            <strong>Deploying Application...</strong>
            <span class="status-text">{{ deployStatus || 'connected' }}</span>
          </div>
        </div>

        <div class="terminal" ref="logContainer">
          <div v-for="(log, idx) in logs" :key="idx" :class="['log-line', log.stream]">
            {{ log.data }}
          </div>
          <div v-if="logs.length === 0" class="empty-logs">
            Waiting for build logs...
          </div>
        </div>

        <div class="monitor-footer" v-if="deployStatus === 'success'">
          <span class="success-msg">✅ Deployment Complete! App is live.</span>
          <button @click="deployStatus = null" class="secondary">Close</button>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  color: #eee;
}

header {
  border-bottom: 1px solid #222;
  margin-bottom: 3rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1 { font-size: 1.4rem; font-weight: 800; margin: 0; color: #fff; }

.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 99px;
  font-weight: 700;
  font-size: 0.8rem;
  margin-left: 0.5rem;
}

.badge.online { background: rgba(0, 255, 0, 0.1); color: #00ff00; }
.badge.offline { background: rgba(255, 0, 0, 0.1); color: #ff4444; }
.badge.pending { background: #111; color: #444; }

.monitor-box {
  background: #0d0d0d;
  border: 1px solid #222;
  border-radius: 12px;
  overflow: hidden;
}

.monitor-header {
  background: #151515;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #222;
}

.pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #0070f3;
  border-radius: 50%;
  margin-right: 10px;
  box-shadow: 0 0 0 rgba(0, 112, 243, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 112, 243, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 112, 243, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 112, 243, 0); }
}

.status-text {
  margin-left: auto;
  text-transform: uppercase;
  font-size: 0.75rem;
  font-weight: 800;
  color: #888;
  letter-spacing: 0.05em;
}

.app-info { display: flex; align-items: center; }

.terminal {
  height: 400px;
  background: #000;
  padding: 1.5rem;
  font-family: 'Fira Code', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  overflow-y: auto;
  color: #ccc;
  scrollbar-width: thin;
}

.log-line.stderr { color: #ff5555; }
.empty-logs { color: #333; height: 100%; display: flex; align-items: center; justify-content: center; }

.monitor-footer {
  padding: 1rem 1.5rem;
  background: #111;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.success-msg { color: #00ff00; font-weight: 600; font-size: 0.9rem; }

button {
  background: #fff;
  color: #000;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
}

button.secondary { background: transparent; color: #666; border: 1px solid #222; }

.code-block {
  background: #000;
  color: #00ff00;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1rem 0;
  cursor: pointer;
  overflow-x: auto;
  font-family: monospace;
}
</style>
