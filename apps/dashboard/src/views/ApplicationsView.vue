<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { App } from '@/types'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'

const { t } = useI18n()

interface Props {
  apps: App[]
  servers: any[]
  ghToken?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deploy: [appId: string]
  restore: [appId: string]
  lifecycle: [appId: string, action: string]
  delete: [appId: string]
  createApp: [app: any]
  connectGithub: []
}>()

// New App Modal State
const showAddAppModal = ref(false)
const repoSource = ref<'manual' | 'github'>('manual')
const githubRepos = ref<any[]>([])
const loadingRepos = ref(false)
const newApp = ref({
  name: '',
  repoUrl: '',
  serverId: '',
  port: 3000,
  ports: [{ port: 3000, name: 'main', isMain: true }] as Array<{ port: number; name: string; isMain: boolean }>,
  env: ''
})

// Delete confirmation
const showDeleteModal = ref(false)
const appToDelete = ref<App | null>(null)

function openAddModal() {
  newApp.value = {
    name: '',
    repoUrl: '',
    serverId: props.servers[0]?.id || '',
    port: 3000,
    ports: [{ port: 3000, name: 'main', isMain: true }],
    env: ''
  }
  showAddAppModal.value = true
}

function addPort() {
  newApp.value.ports.push({ port: 3000, name: '', isMain: false })
}

function removePort(idx: number) {
  if (newApp.value.ports.length > 1) {
    newApp.value.ports.splice(idx, 1)
  }
}

function setMainPort(idx: number) {
  newApp.value.ports.forEach((p, i) => p.isMain = i === idx)
}

function selectRepo(repo: any) {
  newApp.value.name = repo.name
  newApp.value.repoUrl = repo.clone_url
}

function handleCreate() {
  emit('createApp', { ...newApp.value })
  showAddAppModal.value = false
}

function confirmDelete(app: App) {
  appToDelete.value = app
  showDeleteModal.value = true
}

function handleDelete() {
  if (appToDelete.value) {
    emit('delete', appToDelete.value.id)
    showDeleteModal.value = false
    appToDelete.value = null
  }
}

function parseAppPorts(app: App): string {
  try {
    const ports = JSON.parse(app.ports || '[]')
    if (ports.length > 0) {
      return ports.map((p: any) => `${p.port}${p.isMain ? '*' : ''}`).join(', ')
    }
  } catch (e) {}
  return String(app.port)
}

defineExpose({ openAddModal })
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
          {{ t('nav.applications') }}
        </h1>
        <p class="text-white/50 mt-1">{{ apps.length }} {{ t('applications.deployed') || 'applications deployed' }}</p>
      </div>
      <button
        class="px-4 py-2.5 rounded-xl font-medium text-white
               bg-gradient-to-r from-violet-500 to-indigo-600
               hover:from-violet-600 hover:to-indigo-700
               shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40
               transition-all duration-200"
        @click="openAddModal"
      >
        + {{ t('applications.newApp') }}
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="apps.length === 0" class="flex flex-col items-center justify-center py-20">
      <div class="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-4xl mb-4">
        📦
      </div>
      <h3 class="text-xl font-semibold text-white mb-2">{{ t('applications.noApps') }}</h3>
      <p class="text-white/50 mb-6">Deploy your first application to get started</p>
      <button
        class="px-6 py-3 rounded-xl font-medium text-white
               bg-gradient-to-r from-violet-500 to-indigo-600
               hover:from-violet-600 hover:to-indigo-700
               transition-all duration-200"
        @click="openAddModal"
      >
        + {{ t('applications.newApp') }}
      </button>
    </div>

    <!-- Apps Grid -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="app in apps"
        :key="app.id"
        class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5
               hover:bg-white/[0.07] hover:border-white/20 transition-all duration-200"
      >
        <!-- App Header -->
        <div class="flex items-start gap-4 mb-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20
                      border border-violet-500/30 flex items-center justify-center">
            <span class="text-xl">📦</span>
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold text-white truncate">{{ app.name }}</h4>
            <p class="text-sm text-white/40 truncate">{{ app.repoUrl?.split('/').pop() }}</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-medium
                       bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {{ t('applications.running') }}
          </span>
        </div>

        <!-- App Details -->
        <div class="flex flex-wrap gap-2 mb-4 text-xs text-white/50">
          <span class="px-2 py-1 rounded bg-white/5">Node: {{ app.nodeId?.slice(0, 8) }}</span>
          <span class="px-2 py-1 rounded bg-white/5">{{ t('applications.ports') || 'Ports' }}: {{ parseAppPorts(app) }}</span>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-1.5 rounded-lg text-sm font-medium
                   bg-violet-500/20 text-violet-300 hover:bg-violet-500/30
                   transition-colors"
            @click="emit('deploy', app.id)"
          >
            {{ t('applications.deploy') }}
          </button>
          <button
            class="px-3 py-1.5 rounded-lg text-sm font-medium
                   bg-amber-500/20 text-amber-300 hover:bg-amber-500/30
                   transition-colors"
            @click="emit('restore', app.id)"
          >
            {{ t('applications.restore') }}
          </button>
          <button
            class="px-3 py-1.5 rounded-lg text-sm font-medium
                   bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30
                   transition-colors"
            @click="emit('lifecycle', app.id, 'start')"
          >
            {{ t('applications.start') }}
          </button>
          <button
            class="px-3 py-1.5 rounded-lg text-sm font-medium
                   bg-blue-500/20 text-blue-300 hover:bg-blue-500/30
                   transition-colors"
            @click="emit('lifecycle', app.id, 'restart')"
          >
            {{ t('applications.restart') }}
          </button>
          <button
            class="px-3 py-1.5 rounded-lg text-sm font-medium
                   bg-white/10 text-white/60 hover:bg-white/20
                   transition-colors"
            @click="emit('lifecycle', app.id, 'stop')"
          >
            {{ t('applications.stop') }}
          </button>
          <button
            class="px-3 py-1.5 rounded-lg text-sm font-medium
                   bg-red-500/20 text-red-300 hover:bg-red-500/30
                   transition-colors"
            @click="confirmDelete(app)"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create App Modal -->
    <BaseModal
      :show="showAddAppModal"
      title="Deploy New Application"
      size="lg"
      @close="showAddAppModal = false"
    >
      <div class="space-y-5">
        <!-- App Name -->
        <div>
          <label class="block text-sm font-medium text-white/70 mb-2">App Name</label>
          <input
            v-model="newApp.name"
            type="text"
            placeholder="My Awesome API"
            class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                   text-white placeholder:text-white/30
                   focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50
                   transition-all"
          />
        </div>

        <!-- Source Toggle -->
        <div>
          <label class="block text-sm font-medium text-white/70 mb-2">Repository Source</label>
          <div class="flex gap-2">
            <button
              :class="[
                'flex-1 px-4 py-2.5 rounded-xl font-medium transition-all',
                repoSource === 'manual'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              ]"
              @click="repoSource = 'manual'"
            >
              Manual URL
            </button>
            <button
              :class="[
                'flex-1 px-4 py-2.5 rounded-xl font-medium transition-all',
                repoSource === 'github'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              ]"
              @click="repoSource = 'github'"
            >
              GitHub
            </button>
          </div>
        </div>

        <!-- GitHub Connect (if github source) -->
        <div v-if="repoSource === 'github' && !ghToken" class="p-4 rounded-xl bg-white/5 border border-white/10">
          <p class="text-white/60 mb-3">Connect your GitHub account to access repositories.</p>
          <button
            class="px-4 py-2.5 rounded-xl font-medium text-white
                   bg-gray-800 hover:bg-gray-700 border border-white/10
                   transition-all flex items-center gap-2"
            @click="emit('connectGithub')"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Connect GitHub
          </button>
        </div>

        <!-- GitHub Repos Select -->
        <div v-if="repoSource === 'github' && ghToken && githubRepos.length > 0">
          <label class="block text-sm font-medium text-white/70 mb-2">Select Repository</label>
          <select
            class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                   text-white focus:outline-none focus:border-violet-500/50
                   transition-all"
            @change="selectRepo(githubRepos[($event.target as HTMLSelectElement).selectedIndex - 1])"
          >
            <option disabled selected>Select a repository...</option>
            <option v-for="r in githubRepos" :key="r.id" :value="r">
              {{ r.private ? '🔒' : '🌍' }} {{ r.name }}
            </option>
          </select>
        </div>

        <!-- Git URL -->
        <div>
          <label class="block text-sm font-medium text-white/70 mb-2">Git Repository URL</label>
          <input
            v-model="newApp.repoUrl"
            type="text"
            placeholder="https://github.com/user/repo"
            class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                   text-white placeholder:text-white/30
                   focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50
                   transition-all"
          />
        </div>

        <!-- Target Server -->
        <div>
          <label class="block text-sm font-medium text-white/70 mb-2">Target Server</label>
          <select
            v-model="newApp.serverId"
            class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                   text-white focus:outline-none focus:border-violet-500/50
                   transition-all"
          >
            <option v-for="s in servers" :key="s.id" :value="s.id">
              {{ s.alias || s.id.slice(0, 12) }} ({{ s.status }})
            </option>
          </select>
        </div>

        <!-- Ports Configuration -->
        <div>
          <label class="block text-sm font-medium text-white/70 mb-2">Application Ports</label>
          <div class="space-y-2">
            <div v-for="(p, idx) in newApp.ports" :key="idx" class="flex items-center gap-2">
              <input
                v-model.number="p.port"
                type="number"
                placeholder="3000"
                class="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                       text-white text-sm focus:outline-none focus:border-violet-500/50"
              />
              <input
                v-model="p.name"
                type="text"
                placeholder="name"
                class="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                       text-white text-sm focus:outline-none focus:border-violet-500/50"
              />
              <label class="flex items-center gap-1 text-sm text-white/50">
                <input
                  type="radio"
                  name="mainPort"
                  :checked="p.isMain"
                  class="accent-violet-500"
                  @change="setMainPort(idx)"
                />
                Main
              </label>
              <button
                v-if="newApp.ports.length > 1"
                class="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                @click="removePort(idx)"
              >
                &times;
              </button>
            </div>
          </div>
          <button
            class="mt-2 text-sm text-violet-400 hover:text-violet-300"
            @click="addPort"
          >
            + Add Port
          </button>
        </div>

        <!-- Environment Variables -->
        <div>
          <label class="block text-sm font-medium text-white/70 mb-2">Environment Variables</label>
          <textarea
            v-model="newApp.env"
            rows="3"
            placeholder="KEY=value&#10;DATABASE_URL=..."
            class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                   text-white placeholder:text-white/30 font-mono text-sm
                   focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50
                   transition-all resize-none"
          />
        </div>
      </div>

      <template #footer>
        <button
          class="px-4 py-2.5 rounded-xl font-medium text-white/70
                 bg-white/5 hover:bg-white/10 border border-white/10
                 transition-all"
          @click="showAddAppModal = false"
        >
          Cancel
        </button>
        <button
          class="px-6 py-2.5 rounded-xl font-medium text-white
                 bg-gradient-to-r from-violet-500 to-indigo-600
                 hover:from-violet-600 hover:to-indigo-700
                 transition-all"
          :disabled="!newApp.name || !newApp.repoUrl || !newApp.serverId"
          @click="handleCreate"
        >
          Deploy Application
        </button>
      </template>
    </BaseModal>

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :show="showDeleteModal"
      :title="t('common.delete') + ' ' + (appToDelete?.name || '')"
      message="Are you sure you want to delete this application? This action cannot be undone."
      :confirm-text="t('common.delete')"
      variant="danger"
      @close="showDeleteModal = false"
      @confirm="handleDelete"
    />
  </div>
</template>
