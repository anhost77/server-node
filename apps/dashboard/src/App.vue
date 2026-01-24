<script setup lang="ts">
import { ref } from 'vue'

const token = ref<string | null>(null)
const loading = ref(false)
const baseUrl = window.location.origin.replace(':5173', ':3000') // Assume CP is on 3000

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
    </header>

    <main>
      <section v-if="!token">
        <h2>Connect a new server</h2>
        <p>Run a single command on your VPS to install the agent and link it to this dashboard.</p>
        <button @click="generateToken" :disabled="loading">
          {{ loading ? 'Generating...' : 'Add Server' }}
        </button>
      </section>

      <section v-else class="command-box">
        <h2>Step 2: Run this command</h2>
        <p>Copy and paste this into your VPS terminal:</p>
        <div class="code-block" @click="copyCommand">
          <code>curl -sSL {{ baseUrl }}/install.sh | bash -s -- --token {{ token }} --url {{ baseUrl }}</code>
        </div>
        <button @click="copyCommand">Copy Command</button>
        <button @click="token = null" class="secondary">Back</button>
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
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
}

button {
  background: #0070f3;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

button:hover {
  background: #0060df;
}

button.secondary {
  background: transparent;
  color: #888;
  margin-left: 1rem;
}

.code-block {
  background: #111;
  color: #00ff00;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1rem 0;
  cursor: pointer;
  overflow-x: auto;
  font-family: monospace;
}

.command-box {
  background: #1a1a1a;
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #333;
}
</style>
