<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const token = ref<string | null>(null)
const loading = ref(false)
const serverStatus = ref<'online' | 'offline' | 'pending'>('pending')
const lastServerId = ref<string | null>(null)

const baseUrl = window.location.origin.replace(':5173', ':3000')
const wsUrl = baseUrl.replace('http', 'ws') + '/api/dashboard/ws'

let ws: WebSocket | null = null

function connectWS() {
  ws = new WebSocket(wsUrl)
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'SERVER_STATUS') {
        console.log('Server status update:', msg)
        serverStatus.value = msg.status
        lastServerId.value = msg.serverId
      }
    } catch (err) {
      console.error('WS Message parsing error', err)
    }
  }
  ws.onclose = () => {
    console.log('Dashboard WS closed, retrying in 3s...')
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
      <section v-if="!token && serverStatus !== 'online'">
        <h2>Connect a new server</h2>
        <p>Run a single command on your VPS to install the agent and link it to this dashboard.</p>
        <button @click="generateToken" :disabled="loading">
          {{ loading ? 'Generating...' : 'Add Server' }}
        </button>
      </section>

      <section v-else-if="token && serverStatus !== 'online'" class="command-box">
        <h2>Step 2: Run this command</h2>
        <p>Copy and paste this into your VPS terminal:</p>
        <div class="code-block" @click="copyCommand">
          <code>curl -sSL {{ baseUrl }}/install.sh | bash -s -- --token {{ token }} --url {{ baseUrl }}</code>
        </div>
        <button @click="copyCommand">Copy Command</button>
        <button @click="token = null" class="secondary">Back</button>
      </section>

      <section v-else-if="serverStatus === 'online'" class="success-box">
        <div class="success-icon">🚀</div>
        <h2>Server is Online!</h2>
        <p>Your server (ID: {{ lastServerId }}) is now connected and ready for deployments.</p>
        <button @click="serverStatus = 'pending'; token = null" class="secondary">Manage Infrastructure</button>
      </section>
    </main>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
}

header {
  border-bottom: 1px solid #333;
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.global-status {
  font-size: 0.9rem;
  color: #888;
}

.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 99px;
  font-weight: 600;
  margin-left: 0.5rem;
}

.badge.online {
  background: rgba(0, 255, 0, 0.1);
  color: #00ff00;
}

.badge.offline {
  background: rgba(255, 0, 0, 0.1);
  color: #ff4444;
}

.badge.pending {
  background: #222;
  color: #666;
}

button {
  background: #111;
  color: white;
  border: 1px solid #333;
  padding: 0.8rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

button:hover {
  background: #222;
  border-color: #555;
}

button.secondary {
  background: transparent;
  color: #888;
  border: none;
}

.code-block {
  background: #000;
  color: #00ff00;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1rem 0;
  cursor: pointer;
  overflow-x: auto;
  font-family: monospace;
  font-size: 0.9rem;
}

.command-box, .success-box {
  background: #0a0a0a;
  padding: 2.5rem;
  border-radius: 12px;
  border: 1px solid #222;
  text-align: center;
}

.success-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

h2 {
  margin-top: 0;
}

p {
  color: #999;
  line-height: 1.6;
}
</style>
