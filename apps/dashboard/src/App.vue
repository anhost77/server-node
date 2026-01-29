<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { availableLocales, setLocale } from './i18n'

// Import new components
import {
  // UI Components
  BaseModal,
  ConfirmModal,
  BaseButton,
  BaseCard,
  BaseBadge,
  LoadingSpinner,
  // Layout Components
  AppSidebar,
  // Auth Components
  LoginForm,
  // Infrastructure Components
  ServerCard,
  InfrastructureStats,
  ConnectServerPanel,
  // Runtime & Database Components
  RuntimeCard,
  DatabaseCard,
  // Application Components
  AppCard,
  // Console & Billing Components
  ConsoleView,
  UsageCard
} from '@/components'

// Import views
import {
  ApplicationsView,
  BillingView,
  McpView,
  SupportView,
  SettingsView,
  ServerSettingsView,
  SecurityView,
  AdminUsersView,
  AdminPlansView,
  AdminMetricsView,
  AdminSecurityView
} from '@/views'

// Import types
import type {
  Server,
  App,
  Proxy,
  User,
  Runtime,
  Database,
  ConsoleLog,
  SSHSession,
  SSHForm
} from '@/types'

// Import composables
import {
  useApi,
  useModal,
  useAdmin,
  useBilling,
  useSupport,
  useMcp
} from '@/composables'

// Use composables
const { request, baseUrl, wsUrl } = useApi()
const { showAlert, showConfirm, showInput, modal, modalState, closeModal, handleConfirm, setInputValue } = useModal()
const {
  adminUsers, adminPlans, adminSubscriptions, adminMetrics, adminSecurity, adminAgentKeys,
  rotatingCPKey, rotatingAgentKey, showPlanModal, editingPlan, selectedUserDetails,
  showAssignPlanModal, assignPlanUserId, assignPlanUserEmail, selectedPlanId, planForm,
  loadAdminUsers, loadAdminPlans, loadAdminSubscriptions, loadAdminMetrics, loadAdminSecurity,
  rotateCPKey, rotateAgentKey, openPlanModal, savePlan, deletePlan,
  updateUserRole, impersonateUser, assignUserPlan, confirmAssignPlan, viewUserDetails,
  getFreeUsersArc, getPaidUsersArc, getFreeUsersOffset, getBarWidth
} = useAdmin()
const {
  billingPlans, currentSubscription, usageReport,
  managedServers, vpsProviders, vpsPlans, vpsRegions, showProvisionModal, provisionForm, provisionLoading,
  filteredVPSPlans, filteredVPSRegions,
  loadBillingPlans, loadSubscription, loadUsageReport, upgradePlan, openBillingPortal, formatCurrency,
  loadManagedServers, openProvisionModal, provisionManagedServer, deleteManagedServer, getProviderIcon, getManagedServerStatus
} = useBilling()
const {
  supportTickets, selectedTicket, ticketMessages, ticketAttachments,
  showNewTicketModal, newTicketForm, newMessage, sendingMessage, uploadingFile, supportMetrics,
  adminTickets, adminTicketFilters, cannedResponses,
  loadSupportTickets, loadTicketDetails, createSupportTicket, sendTicketMessage,
  autoResizeTextarea, uploadTicketFile, downloadAttachment, getTicketStatusClass, getPriorityClass,
  getCategoryLabel, formatFileSize, loadAdminTickets, loadSupportMetrics, loadCannedResponses,
  updateTicketStatus, assignTicket
} = useSupport()
const {
  mcpTokens, showNewTokenModal, newlyGeneratedToken, newTokenName,
  loadMcpTokens, generateMcpToken, revokeMcpToken, copyToken, closeTokenModal, copyMcpConfig
} = useMcp()

const { t, locale } = useI18n()
const showLanguageMenu = ref(false)

const token = ref<string | null>(null)
const tokenError = ref<{ message: string; upgradeUrl?: string } | null>(null)
const loading = ref(false)
const servers = ref<any[]>([])
const apps = ref<any[]>([])
const proxies = ref<any[]>([])
const auditLogs = ref<any[]>([])
const activeMenu = ref('infrastructure')
const selectedServerId = ref<string | null>(null)
const serverSettingsMode = ref(false)

// Server Settings State (Story 7.7)
const infraStatus = ref<{
  runtimes: Array<{ type: string; installed: boolean; version?: string; latestVersion?: string; updateAvailable?: boolean; estimatedSize: string }>;
  databases: Array<{ type: string; installed: boolean; running: boolean; version?: string }>;
  system: { os: string; osVersion: string; cpu: number; ram: string; disk: string; uptime: string };
} | null>(null)
const infraStatusLoading = ref(false)
const installingRuntime = ref<string | null>(null)
const updatingRuntime = ref<string | null>(null)
const configuringDatabase = ref<string | null>(null)
const infrastructureLogs = ref<{ message: string; stream: 'stdout' | 'stderr' }[]>([])
const showDbConfigModal = ref(false)
const dbConfigType = ref<'postgresql' | 'mysql' | 'redis'>('postgresql')
const dbConfigName = ref('')
const lastConnectionString = ref<string | null>(null)
const showConnectionStringModal = ref(false)

// Database Security Options (shown in config modal)
const dbSecurityOptions = ref({
  // MySQL/MariaDB
  setRootPassword: true,
  removeAnonymousUsers: true,
  disableRemoteRoot: true,
  removeTestDb: true,
  // PostgreSQL
  configureHba: true,
  // Redis
  enableProtectedMode: true,
  // Common
  bindLocalhost: true
})

// Runtime/Database Removal State (Story 7.7 Extension)
const removingRuntime = ref<string | null>(null)
const removingDatabase = ref<string | null>(null)
const reconfiguringDatabase = ref<string | null>(null)

// Service Installation State
const installingService = ref<string | null>(null)
const removingService = ref<string | null>(null)
const startingService = ref<string | null>(null)
const stoppingService = ref<string | null>(null)
const startingDatabase = ref<string | null>(null)
const stoppingDatabase = ref<string | null>(null)
const showRemoveRuntimeModal = ref(false)
const showRemoveDatabaseModal = ref(false)
const showReconfigureDatabaseModal = ref(false)
const runtimeToRemove = ref<string | null>(null)
const databaseToRemove = ref<string | null>(null)
const databaseToReconfigure = ref<string | null>(null)
const removeRuntimePurge = ref(false)
const removeDatabasePurge = ref(false)
const removeDatabaseData = ref(false)
const removeDatabaseConfirmText = ref('')
const reconfigureDbName = ref('')
const reconfigureResetPassword = ref(true)

// Server Alias Editing
const editingAlias = ref(false)
const newAlias = ref('')

// Agent Update State
const bundleVersion = ref<string | null>(null)
const updatingAgent = ref<string | null>(null)
const updateStatus = ref<{ status: string; message?: string; newVersion?: string } | null>(null)
const showSshUpdateModal = ref(false)
const sshUpdateTargetServer = ref<any>(null)
const showUpdateErrorModal = ref(false)
const updateErrorMessage = ref<string>('')
const showAgentUpdateModal = ref(false)
const agentUpdateLogs = ref<{ data: string; stream: 'stdout' | 'stderr' }[]>([])
const agentUpdateConsoleRef = ref<HTMLElement | null>(null)

// Server Deletion State
const showDeleteServerModal = ref(false)
const deleteTargetServer = ref<any>(null)
const deleteAction = ref<'stop' | 'uninstall'>('stop')
const deletingServer = ref(false)

// Mobile Menu State
const mobileMenuOpen = ref(false)
function closeMobileMenu() {
  mobileMenuOpen.value = false
}

// Sidebar Collapsed Sections State
const collapsedSections = ref<Record<string, boolean>>({
  orchestration: false,
  integrations: true,
  admin: true
})

// User Menu Dropdown State
const userMenuOpen = ref(false)

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
const newApp = ref({
  name: '',
  repoUrl: '',
  serverId: '',
  port: 3000,
  ports: [{ port: 3000, name: 'main', isMain: true }] as Array<{ port: number; name: string; isMain: boolean }>,
  env: ''
})

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

// Canned response form (admin support - not yet in composable)
const showCannedResponseModal = ref(false)
const editingCannedResponse = ref<any>(null)
const showCannedForm = ref(false)
const expandedAdminChat = ref(false)
const cannedResponseForm = ref({
    title: '',
    content: '',
    category: '',
    keywords: '',
    isAutoResponse: false,
    sortOrder: 0
})

// Auth Logic
const user = ref<any>(null)
const authMode = ref<'login' | 'register' | 'forgot'>('login')
const authForm = ref({ email: '', password: '', name: '' })
const authError = ref('')

// Onboarding Form State
const onboardingForm = ref({
  billingName: '',
  billingEmail: '',
  billingCompany: '',
  billingAddress: '',
  billingCity: '',
  billingPostalCode: '',
  billingCountry: '',
  billingPhone: '',
  billingVatNumber: '',
  acceptTerms: false,
  acceptPrivacy: false,
  waiveWithdrawal: false
})
const onboardingError = ref('')
const onboardingLoading = ref(false)

async function submitOnboarding() {
  onboardingError.value = ''

  // Validate legal checkboxes
  if (!onboardingForm.value.acceptTerms) {
    onboardingError.value = 'You must accept the Terms of Service'
    return
  }
  if (!onboardingForm.value.acceptPrivacy) {
    onboardingError.value = 'You must accept the Privacy Policy'
    return
  }
  if (!onboardingForm.value.waiveWithdrawal) {
    onboardingError.value = 'You must acknowledge the withdrawal waiver to access the service immediately'
    return
  }

  onboardingLoading.value = true

  try {
    const res = await request('/api/billing/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(onboardingForm.value)
    })

    if (res.error) {
      onboardingError.value = res.error
    } else {
      // Update user and redirect to billing page
      user.value.onboardingCompleted = 1
      activeMenu.value = 'billing'
      loadBillingPlans()
      loadSubscription()
    }
  } catch (e: any) {
    onboardingError.value = 'Failed to save billing information'
  } finally {
    onboardingLoading.value = false
  }
}

// Initialize onboarding form with user data
function initOnboardingForm() {
  if (user.value) {
    onboardingForm.value.billingName = user.value.name || ''
    onboardingForm.value.billingEmail = user.value.email || ''
  }
}

async function checkAuth() {
  try {
    const res = await request('/api/auth/me');
    if (res && res.id) {
      user.value = res;
      initOnboardingForm();
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

// Handler for LoginForm component
async function handleLoginSubmit(form: { email: string; password: string; name: string }) {
  authError.value = ''
  loading.value = true
  try {
    // Determine endpoint based on whether name is provided (register vs login)
    const isRegister = form.name && form.name.trim().length > 0
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
    const res = await request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    if (res.error) {
      authError.value = res.error
    } else {
      const ok = await checkAuth()
      if (ok) {
        refreshData()
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

// Handler for AppSidebar menu changes
function handleMenuChange(menu: string) {
  activeMenu.value = menu
  // Load data for specific menus
  if (menu === 'mcp') {
    loadMcpTokens()
  } else if (menu === 'admin-users') {
    loadAdminUsers()
    loadAdminPlans()
  } else if (menu === 'admin-plans') {
    loadAdminPlans()
  } else if (menu === 'admin-metrics') {
    loadAdminMetrics()
  } else if (menu === 'admin-security') {
    loadAdminSecurity()
  }
}

// Handler for AppSidebar navigate (user menu items)
function handleSidebarNavigate(menu: string) {
  activeMenu.value = menu
  if (menu === 'billing') {
    loadBillingPlans()
    loadSubscription()
    loadUsageReport()
  } else if (menu === 'support') {
    loadSupportTickets()
  }
}

async function logout() {
  await request('/api/auth/logout', { method: 'POST' })
  user.value = null
  ghToken.value = null
  localStorage.removeItem('gh_token')
}

// GDPR Functions
const downloadingData = ref(false)

async function downloadMyData() {
  downloadingData.value = true
  try {
    const res = await fetch(`${baseUrl}/api/user/export-data`, {
      credentials: 'include'
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `serverflow-data-${user.value.id}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    } else {
      alert('Failed to download data')
    }
  } catch (e) {
    alert('Failed to download data')
  } finally {
    downloadingData.value = false
  }
}

async function requestAccountDeletion() {
  const confirmed = confirm(
    'Are you sure you want to delete your account?\n\n' +
    'This action is IRREVERSIBLE. All your data, applications, servers, and configurations will be permanently deleted.\n\n' +
    'Type "DELETE" in the next prompt to confirm.'
  )
  if (!confirmed) return

  const confirmation = prompt('Type DELETE to confirm account deletion:')
  if (confirmation !== 'DELETE') {
    alert('Account deletion cancelled.')
    return
  }

  try {
    const res = await request('/api/user/delete-account', { method: 'DELETE' })
    if (res.success) {
      alert('Your account has been deleted. You will be logged out.')
      logout()
    } else {
      alert(res.error || 'Failed to delete account')
    }
  } catch (e) {
    alert('Failed to delete account')
  }
}

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function scrollToPlans() {
  document.querySelector('.plan-card-enhanced.recommended')?.scrollIntoView({ behavior: 'smooth' })
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

// WebSocket connection (uses wsUrl from useApi)
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

// request function is now from useApi composable

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
         bundleVersion.value = msg.bundleVersion || null
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
        // Extraire l'IP des métriques et la stocker dans le serveur
        if (msg.stream === 'metrics' && msg.ip && msg.serverId) {
          const srv = servers.value.find(s => s.id === msg.serverId)
          if (srv) srv.ip = msg.ip
        }
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
      // Infrastructure messages (Story 7.7)
      else if (msg.type === 'SERVER_STATUS_RESPONSE') {
        if (msg.serverId === selectedServerId.value) {
          infraStatus.value = msg.status
          infraStatusLoading.value = false
        }
      }
      else if (msg.type === 'INFRASTRUCTURE_LOG') {
        if (msg.serverId === selectedServerId.value) {
          infrastructureLogs.value.push({ message: msg.message, stream: msg.stream })
          nextTick(() => {
            const container = document.querySelector('.infra-console-body')
            if (container) container.scrollTop = container.scrollHeight
          })
        }
      }
      else if (msg.type === 'RUNTIME_INSTALLED') {
        if (msg.serverId === selectedServerId.value) {
          installingRuntime.value = null
          if (msg.success) {
            // Refresh server status to show new version
            requestServerStatus()
          }
        }
      }
      else if (msg.type === 'RUNTIME_UPDATED') {
        if (msg.serverId === selectedServerId.value) {
          updatingRuntime.value = null
          if (msg.success) {
            // Refresh server status to show new version
            requestServerStatus()
          }
        }
      }
      else if (msg.type === 'DATABASE_CONFIGURED') {
        if (msg.serverId === selectedServerId.value) {
          configuringDatabase.value = null
          if (msg.success && msg.connectionString) {
            lastConnectionString.value = msg.connectionString
            showConnectionStringModal.value = true
            // Refresh server status
            requestServerStatus()
          }
        }
      }
      // Runtime/Database Removal Response (Story 7.7 Extension)
      else if (msg.type === 'RUNTIME_REMOVED') {
        if (msg.serverId === selectedServerId.value) {
          removingRuntime.value = null
          showRemoveRuntimeModal.value = false
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      else if (msg.type === 'DATABASE_REMOVED') {
        if (msg.serverId === selectedServerId.value) {
          removingDatabase.value = null
          showRemoveDatabaseModal.value = false
          removeDatabaseConfirmText.value = ''
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      else if (msg.type === 'DATABASE_RECONFIGURED') {
        if (msg.serverId === selectedServerId.value) {
          reconfiguringDatabase.value = null
          showReconfigureDatabaseModal.value = false
          if (msg.success && msg.connectionString) {
            lastConnectionString.value = msg.connectionString
            showConnectionStringModal.value = true
            requestServerStatus()
          }
        }
      }
      // Service Installation/Removal Response
      else if (msg.type === 'SERVICE_INSTALLED') {
        if (msg.serverId === selectedServerId.value) {
          installingService.value = null
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      else if (msg.type === 'SERVICE_REMOVED') {
        if (msg.serverId === selectedServerId.value) {
          removingService.value = null
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      else if (msg.type === 'SERVICE_STARTED') {
        if (msg.serverId === selectedServerId.value) {
          startingService.value = null
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      else if (msg.type === 'SERVICE_STOPPED') {
        if (msg.serverId === selectedServerId.value) {
          stoppingService.value = null
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      // Mail Stack Configuration Response
      else if (msg.type === 'MAIL_STACK_CONFIGURED') {
        if (msg.serverId === selectedServerId.value) {
          configuringMailStack.value = false
          mailStackResult.value = {
            success: msg.success,
            dkimPublicKey: msg.dkimPublicKey,
            error: msg.error
          }
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      // DNS Stack Configuration Response
      else if (msg.type === 'DNS_STACK_CONFIGURED') {
        if (msg.serverId === selectedServerId.value) {
          configuringDnsStack.value = false
          dnsStackResult.value = {
            success: msg.success,
            error: msg.error
          }
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      // Database Stack Configuration Response (Wizard)
      else if (msg.type === 'DATABASE_STACK_CONFIGURED') {
        // Utiliser le serverId stocké lors de l'appel à configureDatabaseStack
        // car activeServer.value?.id peut être null ou différent
        if (msg.serverId === databaseStackTargetServerId.value) {
          configuringDatabaseStack.value = false
          databaseStackTargetServerId.value = null // Réinitialiser
          databaseStackResult.value = {
            success: msg.success,
            connectionString: msg.connectionString,
            error: msg.error
          }
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      else if (msg.type === 'DATABASE_STARTED') {
        if (msg.serverId === selectedServerId.value) {
          startingDatabase.value = null
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      else if (msg.type === 'DATABASE_STOPPED') {
        if (msg.serverId === selectedServerId.value) {
          stoppingDatabase.value = null
          if (msg.success) {
            requestServerStatus()
          }
        }
      }
      // Database Info Response (Management Wizard)
      else if (msg.type === 'DATABASE_INFO_RESPONSE') {
        if (msg.serverId === selectedServerId.value) {
          databaseInfo.value = msg.databases || []
        }
      }
      // Database Password Reset Response
      else if (msg.type === 'DATABASE_PASSWORD_RESET') {
        if (msg.serverId === selectedServerId.value) {
          databaseOperationResult.value = {
            success: msg.success,
            operation: 'reset_password',
            connectionString: msg.connectionString,
            password: msg.password,
            error: msg.error
          }
        }
      }
      // Database Instance Created Response
      else if (msg.type === 'DATABASE_INSTANCE_CREATED') {
        if (msg.serverId === selectedServerId.value) {
          databaseOperationResult.value = {
            success: msg.success,
            operation: 'create_database',
            connectionString: msg.connectionString,
            password: msg.password,
            error: msg.error
          }
          // Refresh database info after creating a new instance
          if (msg.success && selectedServerId.value) {
            getDatabaseInfo(selectedServerId.value)
          }
        }
      }
      // Infrastructure Logs Response
      else if (msg.type === 'INFRASTRUCTURE_LOGS_RESPONSE') {
        if (msg.serverId === selectedServerId.value) {
          fetchingRemoteLogs.value = false
          remoteLogFilePath.value = msg.logFilePath
          // Parse the logs and add them to the console
          if (msg.logs) {
            infrastructureLogs.value = []
            const lines = msg.logs.split('\n').filter((l: string) => l.trim())
            for (const line of lines) {
              // Parse log line: [timestamp] [stream] message
              const match = line.match(/^\[([^\]]+)\] \[(stdout|stderr)\] (.*)$/)
              if (match) {
                infrastructureLogs.value.push({
                  message: `[${match[1]}] ${match[3]}`,
                  stream: match[2] as 'stdout' | 'stderr'
                })
              } else {
                infrastructureLogs.value.push({ message: line, stream: 'stdout' })
              }
            }
          }
        }
      }
      else if (msg.type === 'INFRASTRUCTURE_LOGS_CLEARED') {
        if (msg.serverId === selectedServerId.value) {
          // Optionally show a notification
          infrastructureLogs.value = []
        }
      }
      // Service-specific logs response
      else if (msg.type === 'SERVICE_LOGS_RESPONSE') {
        if (msg.serverId === selectedServerId.value && msg.service === serviceLogsService.value) {
          fetchingServiceLogs.value = false
          serviceLogsFilePath.value = msg.logFilePath
          serviceLogsContent.value = msg.logs || ''
        }
      }
      // Agent Update Status
      else if (msg.type === 'AGENT_UPDATE_STATUS') {
        updateStatus.value = { status: msg.status, message: msg.message, newVersion: msg.newVersion }
        if (msg.status === 'success' || msg.status === 'failed') {
          // Update finished
          if (msg.status === 'failed') {
            // Show error modal with details
            updateErrorMessage.value = msg.message || 'Unknown error during update'
            showUpdateErrorModal.value = true
          }
          setTimeout(() => {
            updatingAgent.value = null
            updateStatus.value = null
            if (msg.status === 'success') {
              // Agent will reconnect with new version, refresh data
              setTimeout(refreshData, 3000)
            }
          }, 2000)
        }
      }
      // Agent Update Log (streaming output)
      else if (msg.type === 'AGENT_UPDATE_LOG') {
        agentUpdateLogs.value.push({ data: msg.data, stream: msg.stream })
        // Auto-scroll console
        nextTick(() => {
          if (agentUpdateConsoleRef.value) {
            agentUpdateConsoleRef.value.scrollTop = agentUpdateConsoleRef.value.scrollHeight
          }
        })
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
  // Always navigate to the Connect Node view first
  selectedServerId.value = 'pending'
  activeMenu.value = 'infrastructure'

  loading.value = true
  tokenError.value = null
  token.value = null

  try {
    const data = await request('/api/servers/token', { method: 'POST' })

    // Handle limit exceeded error
    if (data.error === 'LIMIT_EXCEEDED') {
      tokenError.value = {
        message: data.message || `Server limit reached (${data.current}/${data.limit})`,
        upgradeUrl: data.upgradeUrl || '/billing'
      }
      return
    }

    // Handle other errors (network, unauthorized, etc.)
    if (data.error) {
      tokenError.value = {
        message: data.error === 'Unauthorized' ? 'Please log in again' : data.message || data.error,
        upgradeUrl: '/billing'
      }
      return
    }

    // Success - got a token
    if (data.token) {
      token.value = data.token
    } else {
      tokenError.value = {
        message: 'Failed to generate token - no token received',
        upgradeUrl: '/billing'
      }
    }
  } catch (e: any) {
    tokenError.value = {
      message: e.message || 'Failed to generate token',
      upgradeUrl: '/billing'
    }
  } finally {
    loading.value = false
  }
}

// SSH Update Mode (for old agents)
const sshUpdateMode = ref(false)

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
  sshUpdateMode.value = false
  showSshUpdateModal.value = false
}

async function startSSHUpdate() {
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

  sshUpdateMode.value = true
  resetSSHSession()
  sshSession.value.status = 'connecting'
  sshSession.value.message = 'Connecting to server...'
  sshSession.value.totalSteps = 4 // Update has fewer steps

  // Get temporary auth token for WebSocket
  let sshToken: string
  try {
    const tokenRes = await fetch(`${baseUrl}/api/ssh/token`, {
      method: 'POST',
      credentials: 'include'
    })
    if (!tokenRes.ok) {
      showAlert('Auth Error', 'Failed to authenticate for SSH session', 'error')
      resetSSHSession()
      return
    }
    const tokenData = await tokenRes.json()
    sshToken = tokenData.token
  } catch (e) {
    showAlert('Connection Error', 'Failed to connect to server', 'error')
    resetSSHSession()
    return
  }

  // Connect via WebSocket with token in URL
  const sshWsUrl = baseUrl.replace('http', 'ws') + `/api/ssh/session?token=${sshToken}`
  sshWs = new WebSocket(sshWsUrl)

  sshWs.onopen = () => {
    // Send connection request with autoUpdate flag
    sshWs?.send(JSON.stringify({
      type: 'CONNECT',
      host: sshForm.value.host,
      port: sshForm.value.port,
      username: sshForm.value.username,
      password: sshForm.value.authType === 'password' ? sshForm.value.password : undefined,
      privateKey: sshForm.value.authType === 'key' ? sshForm.value.privateKey : undefined,
      autoUpdate: true
    }))
  }

  sshWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'CONNECTED':
          sshSession.value.id = msg.sessionId
          sshSession.value.status = 'preflight'
          // Immediately start update (no preflight needed for update)
          sshWs?.send(JSON.stringify({ type: 'START_UPDATE' }))
          break

        case 'STATUS':
          sshSession.value.step = msg.step
          sshSession.value.totalSteps = msg.total || 4
          sshSession.value.message = msg.message
          sshSession.value.status = 'installing'
          break

        case 'OUTPUT':
          sshSession.value.output.push(msg.data)
          nextTick(() => {
            if (sshTerminalRef.value) {
              sshTerminalRef.value.scrollTop = sshTerminalRef.value.scrollHeight
            }
          })
          break

        case 'COMPLETE':
          sshSession.value.status = 'complete'
          sshSession.value.message = t('infrastructure.updateSuccess')
          setTimeout(() => refreshData(), 2000)
          break

        case 'ERROR':
          sshSession.value.status = 'error'
          sshSession.value.message = msg.message
          break
      }
    } catch (e) {
      console.error('[SSH Update] Message parse error:', e)
    }
  }

  sshWs.onerror = () => {
    sshSession.value.status = 'error'
    sshSession.value.message = 'WebSocket connection failed'
  }

  sshWs.onclose = (e) => {
    if (sshSession.value.status !== 'complete' && sshSession.value.status !== 'error') {
      sshSession.value.status = 'error'
      sshSession.value.message = 'Connection closed unexpectedly'
    }
  }
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

// Server Settings Functions (Story 7.7)
function openServerSettings() {
  serverSettingsMode.value = true
  infrastructureLogs.value = []
  requestServerStatus()
}

function closeServerSettings() {
  serverSettingsMode.value = false
  infraStatus.value = null
}

function requestServerStatus() {
  const targetId = activeServer.value?.id
  if (!targetId) return

  infraStatusLoading.value = true
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'GET_SERVER_STATUS',
    serverId: targetId
  }))
}

function updateAgent(serverId: string) {
  if (updatingAgent.value) return

  // Find the server
  const server = servers.value.find(s => s.id === serverId)
  if (!server) return

  // Always try WebSocket update first (modern agents support this)
  console.log('🔄 Triggering agent update for:', serverId, 'version:', server.agentVersion)
  updatingAgent.value = serverId
  updateStatus.value = { status: 'starting', message: 'Initiating update...' }
  agentUpdateLogs.value = [] // Clear previous logs
  showAgentUpdateModal.value = true // Show update console

  ws?.send(JSON.stringify({
    type: 'UPDATE_AGENT',
    serverId
  }))

  // If no response after 10s, show SSH fallback option
  setTimeout(() => {
    if (updatingAgent.value === serverId && updateStatus.value?.status === 'starting') {
      console.log('⚠️ No response from agent, showing SSH fallback')
      updateStatus.value = { status: 'timeout', message: 'No response. Try SSH update?' }
    }
  }, 10000)
}

function closeAgentUpdateModal() {
  showAgentUpdateModal.value = false
}

/**
 * **openDeleteServerModal**
 * Ouvre le modal de suppression pour un serveur.
 * Affiche les options "Déconnecter" ou "Supprimer complètement".
 */
function openDeleteServerModal(server: any) {
  deleteTargetServer.value = server
  deleteAction.value = 'stop' // Par défaut: déconnecter seulement
  showDeleteServerModal.value = true
}

/**
 * **confirmDeleteServer**
 * Supprime le serveur sélectionné via l'API.
 * Envoie SHUTDOWN_AGENT à l'agent si connecté.
 * Supprime en cascade les apps et domaines associés.
 */
async function confirmDeleteServer() {
  if (!deleteTargetServer.value || deletingServer.value) return

  deletingServer.value = true

  try {
    const res = await request(`/api/nodes/${deleteTargetServer.value.id}?action=${deleteAction.value}`, {
      method: 'DELETE'
    })

    if (res.success) {
      const serverName = deleteTargetServer.value.alias || deleteTargetServer.value.id.slice(0, 8)
      showAlert(
        t('common.success'),
        t('infrastructure.serverDeleted', { name: serverName }) || `Server "${serverName}" deleted successfully`,
        'info'
      )

      // Fermer le modal et réinitialiser
      showDeleteServerModal.value = false
      deleteTargetServer.value = null
      selectedServerId.value = null

      // Rafraîchir les données (le WebSocket devrait aussi mettre à jour)
      await refreshData()
    } else {
      throw new Error(res.message || 'Delete failed')
    }
  } catch (e: any) {
    showAlert(t('common.error'), e.message || t('infrastructure.deleteServerFailed') || 'Failed to delete server', 'error')
  } finally {
    deletingServer.value = false
  }
}

function installRuntime(runtime: string) {
  const targetId = activeServer.value?.id
  if (!targetId || installingRuntime.value) return

  installingRuntime.value = runtime
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'INSTALL_RUNTIME',
    serverId: targetId,
    runtime
  }))
}

function updateRuntime(runtime: string) {
  const targetId = activeServer.value?.id
  if (!targetId || updatingRuntime.value) return

  updatingRuntime.value = runtime
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'UPDATE_RUNTIME',
    serverId: targetId,
    runtime
  }))
}

function configureDatabase() {
  const targetId = activeServer.value?.id
  if (!targetId || configuringDatabase.value) return

  configuringDatabase.value = dbConfigType.value
  showDbConfigModal.value = false
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'CONFIGURE_DATABASE',
    serverId: targetId,
    database: dbConfigType.value,
    dbName: dbConfigName.value,
    securityOptions: dbSecurityOptions.value
  }))
}

// Reset security options to defaults when opening modal
function openDbConfigModal(dbType: 'postgresql' | 'mysql' | 'redis') {
  dbConfigType.value = dbType
  dbConfigName.value = dbType === 'redis' ? '' : 'myapp'
  // Reset to secure defaults
  dbSecurityOptions.value = {
    setRootPassword: true,
    removeAnonymousUsers: true,
    disableRemoteRoot: true,
    removeTestDb: true,
    configureHba: true,
    enableProtectedMode: true,
    bindLocalhost: true
  }
  showDbConfigModal.value = true
}

function copyConnectionString() {
  if (lastConnectionString.value) {
    navigator.clipboard.writeText(lastConnectionString.value)
  }
}

// Runtime/Database Removal Functions (Story 7.7 Extension)
function openRemoveRuntimeModal(runtime: string) {
  runtimeToRemove.value = runtime
  removeRuntimePurge.value = false
  showRemoveRuntimeModal.value = true
}

function confirmRemoveRuntime() {
  const targetId = activeServer.value?.id
  if (!targetId || !runtimeToRemove.value || removingRuntime.value) return

  removingRuntime.value = runtimeToRemove.value
  showRemoveRuntimeModal.value = false // Close modal to show console
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'REMOVE_RUNTIME',
    serverId: targetId,
    runtime: runtimeToRemove.value,
    purge: removeRuntimePurge.value
  }))
}

function openRemoveDatabaseModal(database: string) {
  databaseToRemove.value = database
  removeDatabasePurge.value = false
  removeDatabaseData.value = false
  removeDatabaseConfirmText.value = ''
  showRemoveDatabaseModal.value = true
}

function confirmRemoveDatabase() {
  const targetId = activeServer.value?.id
  if (!targetId || !databaseToRemove.value || removingDatabase.value) return
  if (removeDatabaseConfirmText.value !== `DELETE ${databaseToRemove.value}`) return

  removingDatabase.value = databaseToRemove.value
  showRemoveDatabaseModal.value = false // Close modal to show console
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'REMOVE_DATABASE',
    serverId: targetId,
    database: databaseToRemove.value,
    purge: removeDatabasePurge.value,
    removeData: removeDatabaseData.value
  }))
}

function openReconfigureDatabaseModal(database: string) {
  databaseToReconfigure.value = database
  reconfigureDbName.value = 'myapp'
  reconfigureResetPassword.value = true
  showReconfigureDatabaseModal.value = true
}

function confirmReconfigureDatabase() {
  const targetId = activeServer.value?.id
  if (!targetId || !databaseToReconfigure.value || reconfiguringDatabase.value) return

  reconfiguringDatabase.value = databaseToReconfigure.value
  showReconfigureDatabaseModal.value = false
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'RECONFIGURE_DATABASE',
    serverId: targetId,
    database: databaseToReconfigure.value,
    dbName: reconfigureDbName.value,
    resetPassword: reconfigureResetPassword.value
  }))
}

function clearInfraLogs() {
  infrastructureLogs.value = []
}

function copyInfraLogs() {
  navigator.clipboard.writeText(infrastructureLogs.value.map(l => l.message).join('\n'))
}

// Wrapper functions for ServerSettingsView events
function removeRuntime(runtime: string) {
  const targetId = activeServer.value?.id
  if (!targetId || removingRuntime.value) return

  removingRuntime.value = runtime
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'REMOVE_RUNTIME',
    serverId: targetId,
    runtime: runtime,
    purge: false
  }))
}

function removeDatabase(dbType: string) {
  const targetId = activeServer.value?.id
  if (!targetId || removingDatabase.value) return

  removingDatabase.value = dbType
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'REMOVE_DATABASE',
    serverId: targetId,
    database: dbType,
    purge: false,
    removeData: false
  }))
}

function handleConfigureDatabase(dbType: string, dbName: string, securityOptions: any) {
  const targetId = activeServer.value?.id
  if (!targetId || configuringDatabase.value) return

  configuringDatabase.value = dbType
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'CONFIGURE_DATABASE',
    serverId: targetId,
    database: dbType,
    dbName: dbName,
    securityOptions: securityOptions
  }))
}

function handleReconfigureDatabase(dbType: string, dbName: string) {
  const targetId = activeServer.value?.id
  if (!targetId || reconfiguringDatabase.value) return

  reconfiguringDatabase.value = dbType
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'RECONFIGURE_DATABASE',
    serverId: targetId,
    database: dbType,
    dbName: dbName,
    resetPassword: true
  }))
}

// Service Installation Functions
function installService(serviceType: string) {
  const targetId = activeServer.value?.id
  if (!targetId || installingService.value) return

  installingService.value = serviceType
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'INSTALL_SERVICE',
    serverId: targetId,
    service: serviceType
  }))
}

function removeService(serviceType: string) {
  const targetId = activeServer.value?.id
  if (!targetId || removingService.value) return

  removingService.value = serviceType
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'REMOVE_SERVICE',
    serverId: targetId,
    service: serviceType
  }))
}

function startService(serviceType: string) {
  const targetId = activeServer.value?.id
  if (!targetId || startingService.value) return

  startingService.value = serviceType
  ws?.send(JSON.stringify({
    type: 'START_SERVICE',
    serverId: targetId,
    service: serviceType
  }))
}

function stopService(serviceType: string) {
  const targetId = activeServer.value?.id
  if (!targetId || stoppingService.value) return

  stoppingService.value = serviceType
  ws?.send(JSON.stringify({
    type: 'STOP_SERVICE',
    serverId: targetId,
    service: serviceType
  }))
}

// Mail Stack Configuration
const configuringMailStack = ref(false)
const mailStackResult = ref<{ success: boolean; dkimPublicKey?: string; error?: string } | null>(null)

function configureMailStack(serverId: string, config: any) {
  if (configuringMailStack.value) return

  configuringMailStack.value = true
  mailStackResult.value = null
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'CONFIGURE_MAIL_STACK',
    serverId,
    config
  }))
}

// DNS Stack Configuration
const configuringDnsStack = ref(false)
const dnsStackResult = ref<{ success: boolean; error?: string } | null>(null)

function configureDnsStack(serverId: string, config: any) {
  if (configuringDnsStack.value) return

  configuringDnsStack.value = true
  dnsStackResult.value = null
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'CONFIGURE_DNS_STACK',
    serverId,
    config
  }))
}

// Database Stack Configuration (Wizard)
const configuringDatabaseStack = ref(false)
const databaseStackResult = ref<{ success: boolean; connectionString?: string; error?: string } | null>(null)
// Stocker le serverId de la configuration en cours pour la comparaison lors de la réception du résultat
const databaseStackTargetServerId = ref<string | null>(null)

function configureDatabaseStack(serverId: string, config: any) {
  if (configuringDatabaseStack.value) return

  configuringDatabaseStack.value = true
  databaseStackResult.value = null
  databaseStackTargetServerId.value = serverId // Stocker le serverId cible
  infrastructureLogs.value = []
  ws?.send(JSON.stringify({
    type: 'CONFIGURE_DATABASE_STACK',
    serverId,
    config
  }))
}

// Database Management (for DatabaseManagementWizard)
const databaseInfo = ref<Array<{
  type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  version?: string;
  running: boolean;
  instances: Array<{ name: string; user?: string; createdAt?: string }>;
}>>([])
const databaseOperationResult = ref<{
  success: boolean;
  operation: 'reset_password' | 'create_database';
  connectionString?: string;
  password?: string;
  error?: string;
} | null>(null)

function getDatabaseInfo(serverId: string) {
  databaseInfo.value = []
  ws?.send(JSON.stringify({
    type: 'GET_DATABASE_INFO',
    serverId
  }))
}

function resetDatabasePassword(serverId: string, dbType: string, dbName: string) {
  databaseOperationResult.value = null
  ws?.send(JSON.stringify({
    type: 'RESET_DATABASE_PASSWORD',
    serverId,
    dbType,
    dbName,
  }))
}

function createDatabaseInstance(serverId: string, dbType: string, dbName: string, username?: string) {
  databaseOperationResult.value = null
  ws?.send(JSON.stringify({
    type: 'CREATE_DATABASE_INSTANCE',
    serverId,
    dbType,
    dbName,
    username
  }))
}

function startDatabase(dbType: string) {
  const targetId = activeServer.value?.id
  if (!targetId || startingDatabase.value) return

  startingDatabase.value = dbType
  ws?.send(JSON.stringify({
    type: 'START_DATABASE',
    serverId: targetId,
    database: dbType
  }))
}

function stopDatabase(dbType: string) {
  const targetId = activeServer.value?.id
  if (!targetId || stoppingDatabase.value) return

  stoppingDatabase.value = dbType
  ws?.send(JSON.stringify({
    type: 'STOP_DATABASE',
    serverId: targetId,
    database: dbType
  }))
}

const fetchingRemoteLogs = ref(false)
const remoteLogFilePath = ref<string | null>(null)

function fetchRemoteLogs() {
  const targetId = selectedServerId.value
  if (!targetId || !ws) return

  fetchingRemoteLogs.value = true
  ws.send(JSON.stringify({
    type: 'GET_INFRASTRUCTURE_LOGS',
    serverId: targetId
  }))
}

function clearRemoteLogs() {
  const targetId = selectedServerId.value
  if (!targetId || !ws) return

  ws.send(JSON.stringify({
    type: 'CLEAR_INFRASTRUCTURE_LOGS',
    serverId: targetId
  }))
}

// Service-specific logs (per runtime/database)
const showServiceLogsModal = ref(false)
const serviceLogsService = ref<string | null>(null)
const serviceLogsContent = ref('')
const serviceLogsFilePath = ref('')
const fetchingServiceLogs = ref(false)

function fetchServiceLogs(service: string) {
  const targetId = selectedServerId.value
  if (!targetId || !ws) return

  serviceLogsService.value = service
  serviceLogsContent.value = ''
  serviceLogsFilePath.value = ''
  fetchingServiceLogs.value = true
  showServiceLogsModal.value = true

  ws.send(JSON.stringify({
    type: 'GET_SERVICE_LOGS',
    serverId: targetId,
    service
  }))
}

function closeServiceLogsModal() {
  showServiceLogsModal.value = false
  serviceLogsService.value = null
  serviceLogsContent.value = ''
  serviceLogsFilePath.value = ''
}

function copyServiceLogs() {
  if (serviceLogsContent.value) {
    navigator.clipboard.writeText(serviceLogsContent.value)
  }
}

// Port management helpers
function addPort() {
  const nextPort = newApp.value.ports.length > 0
    ? Math.max(...newApp.value.ports.map(p => p.port)) + 1
    : 3000
  newApp.value.ports.push({ port: nextPort, name: `port-${newApp.value.ports.length}`, isMain: false })
}

function removePort(idx: number) {
  const wasMain = newApp.value.ports[idx].isMain
  newApp.value.ports.splice(idx, 1)
  // If removed port was main, make first port main
  if (wasMain && newApp.value.ports.length > 0) {
    newApp.value.ports[0].isMain = true
  }
}

function setMainPort(idx: number) {
  newApp.value.ports.forEach((p, i) => { p.isMain = i === idx })
}

async function createApp() {
  try {
    const envObj = newApp.value.env.split('\n').reduce((acc: any, line) => {
      const [k, v] = line.split('='); if(k && v) acc[k.trim()] = v.trim(); return acc;
    }, {})
    // Find main port for legacy support
    const mainPort = newApp.value.ports.find(p => p.isMain)?.port || newApp.value.ports[0]?.port || 3000
    await request('/api/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newApp.value.name,
        repoUrl: newApp.value.repoUrl,
        serverId: newApp.value.serverId,
        port: mainPort,
        ports: newApp.value.ports,
        env: envObj
      })
    })
    showAddAppModal.value = false
    newApp.value = {
      name: '',
      repoUrl: '',
      serverId: '',
      port: 3000,
      ports: [{ port: 3000, name: 'main', isMain: true }],
      env: ''
    }
    refreshData()
    activeMenu.value = 'applications'
  } catch(e) {}
}

async function saveAlias() {
  if (!activeServer.value) return
  try {
    await request(`/api/servers/${activeServer.value.id}/alias`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: newAlias.value.trim() })
    })
    // Update local state
    const server = servers.value.find(s => s.id === activeServer.value!.id)
    if (server) {
      server.alias = newAlias.value.trim() || null
    }
    editingAlias.value = false
  } catch(e) {
    console.error('Failed to save alias:', e)
  }
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

// MCP functions are now in useMcp composable

function clearConsoleLogs() {
  consoleLogs.value = []
}

function toggleConsoleFilter(type: string) {
  const idx = consoleFilter.value.indexOf(type)
  if (idx > -1) consoleFilter.value.splice(idx, 1)
  else consoleFilter.value.push(type)
}

// Admin, Billing, and Support functions are now in composables

// Admin support functions: loadAdminTickets, loadSupportMetrics, loadCannedResponses, updateTicketStatus now in useSupport

async function sendAdminReply(isInternal = false) {
  if (!newMessage.value.trim() || !selectedTicket.value) return

  sendingMessage.value = true
  try {
    const res = await request(`/api/admin/support/tickets/${selectedTicket.value.id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newMessage.value, isInternal })
    })

    if (res?.success) {
      newMessage.value = ''
      await loadTicketDetails(selectedTicket.value.id)
      await loadAdminTickets()
    } else {
      showAlert('Error', res?.error || 'Failed to send reply', 'error')
    }
  } catch (e: any) {
    showAlert('Error', e.message || 'Failed to send reply', 'error')
  } finally {
    sendingMessage.value = false
  }
}

function insertCannedResponse(response: any) {
  newMessage.value = response.content
}

async function saveCannedResponse() {
  if (!cannedResponseForm.value.title.trim() || !cannedResponseForm.value.content.trim()) {
    showAlert('Error', 'Title and content are required', 'error')
    return
  }

  try {
    const method = editingCannedResponse.value ? 'PATCH' : 'POST'
    const url = editingCannedResponse.value
      ? `/api/admin/support/canned-responses/${editingCannedResponse.value.id}`
      : '/api/admin/support/canned-responses'

    const res = await request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cannedResponseForm.value)
    })

    if (res?.success) {
      showCannedForm.value = false
      editingCannedResponse.value = null
      cannedResponseForm.value = { title: '', content: '', category: '', keywords: '', isAutoResponse: false, sortOrder: 0 }
      await loadCannedResponses()
    } else {
      showAlert('Error', res?.error || 'Failed to save response', 'error')
    }
  } catch (e: any) {
    showAlert('Error', e.message || 'Failed to save response', 'error')
  }
}

async function deleteCannedResponse(id: string) {
  showConfirm('Delete Response', 'Are you sure you want to delete this canned response?', async () => {
    try {
      const res = await request(`/api/admin/support/canned-responses/${id}`, { method: 'DELETE' })
      if (res?.success) {
        await loadCannedResponses()
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to delete response', 'error')
    }
  })
}

function openEditCannedResponse(response: any) {
  editingCannedResponse.value = response
  cannedResponseForm.value = {
    title: response.title,
    content: response.content,
    category: response.category || '',
    keywords: response.keywords || '',
    isAutoResponse: response.isAutoResponse || false,
    sortOrder: response.sortOrder || 0
  }
  showCannedForm.value = true
}

function openNewCannedResponse() {
  editingCannedResponse.value = null
  cannedResponseForm.value = { title: '', content: '', category: '', keywords: '', isAutoResponse: false, sortOrder: 0 }
  showCannedForm.value = true
}
</script>

<template>
  <!-- Auth Screen -->
  <div v-if="!user" class="login-screen">
    <LoginForm
      :loading="loading"
      :error="authError"
      @submit="handleLoginSubmit"
      @github-login="loginWithGithub"
    />
  </div>

  <!-- Unified Notification Modal -->
  <div v-if="modalState.show" class="modal-overlay" style="z-index: 10000;" @click.self="closeModal">
    <div class="glass-card modal-card" style="max-width: 460px; text-align: center; padding: 48px;">
      <!-- Dynamic Icons for Actions -->
      <div v-if="modalState.title.toLowerCase().includes('start')" class="modal-icon" style="color: #00ffbd; font-size: 4.5rem; margin-bottom: 24px;">▶️</div>
      <div v-else-if="modalState.title.toLowerCase().includes('stop')" class="modal-icon" style="color: #ff4d4d; font-size: 4.5rem; margin-bottom: 24px;">⏹️</div>
      <div v-else-if="modalState.title.toLowerCase().includes('restart')" class="modal-icon" style="color: #fff; font-size: 4.5rem; margin-bottom: 24px;">🔄</div>
      <div v-else-if="modalState.type === 'error'" class="modal-icon" style="color: #ff4d4d; font-size: 4rem; margin-bottom: 24px;">⚠️</div>
      <div v-else-if="modalState.type === 'confirm'" class="modal-icon" style="color: #0070f3; font-size: 4rem; margin-bottom: 24px;">❓</div>
      <div v-else-if="modalState.type === 'input'" class="modal-icon" style="color: #0070f3; font-size: 4rem; margin-bottom: 24px;">📝</div>
      <div v-else class="modal-icon" style="color: #00ffbd; font-size: 4rem; margin-bottom: 24px;">ℹ️</div>

      <h2 style="margin-bottom: 12px; font-weight: 800; font-size: 1.8rem; letter-spacing: -0.02em; color: #0f172a;">{{ modalState.title }}</h2>
      <p style="color: #888; font-size: 1.1rem; line-height: 1.5; margin-bottom: 0;">{{ modalState.message }}</p>

      <div v-if="modalState.type === 'input'" class="form-group" style="margin-top: 24px;">
        <input v-model="modalState.inputValue" :placeholder="modalState.inputPlaceholder" @keyup.enter="handleConfirm" style="text-align: center; font-size: 1.1rem;" />
      </div>

      <div class="modal-actions" style="margin-top: 40px; justify-content: center; gap: 16px;">
        <button v-if="['confirm', 'input'].includes(modalState.type)" class="secondary" @click="closeModal" style="padding: 14px 28px; font-size: 1rem; font-weight: 600;">{{ t('common.cancel') }}</button>
        <button class="premium-btn" style="margin-top: 0; padding: 14px 32px; font-size: 1rem; font-weight: 700; min-width: 140px;" @click="handleConfirm">
          {{ modalState.type === 'confirm' || modalState.type === 'input' ? t('common.confirm') : t('common.ok') }}
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
              <button class="clear-btn" @click="clearConsoleLogs">{{ t('common.clear') }}</button>
              <button class="secondary" @click="showLargeConsole = false">{{ t('common.close') }}</button>
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

  <!-- Database Config Modal with Security Options (Story 7.7) -->
  <div v-if="showDbConfigModal" class="modal-overlay" style="z-index: 10000;" @click.self="showDbConfigModal = false">
     <div class="glass-card db-config-modal w-full max-w-lg">
        <div class="modal-header">
           <h3>🔧 Setup {{ dbConfigType === 'postgresql' ? 'PostgreSQL' : dbConfigType === 'mysql' ? 'MySQL/MariaDB' : 'Redis' }}</h3>
           <button class="close-btn" @click="showDbConfigModal = false">×</button>
        </div>
        <div class="modal-body max-h-[70vh] overflow-y-auto">
           <!-- Database Name -->
           <div class="form-group" v-if="dbConfigType !== 'redis'">
              <label>Database Name</label>
              <input type="text" v-model="dbConfigName" placeholder="myapp" />
              <small class="form-help">A user will be created: {{ dbConfigName }}_user</small>
           </div>

           <!-- Security Options Section -->
           <div class="security-section">
              <h4>🔒 Security Configuration</h4>
              <p class="security-desc">
                 These options secure your database against common attacks.
                 <strong>We recommend keeping all options enabled.</strong>
              </p>

              <!-- MySQL/MariaDB Options -->
              <div v-if="dbConfigType === 'mysql'" class="security-options-list">
                 <label class="security-option" :class="{ selected: dbSecurityOptions.setRootPassword }">
                    <input type="checkbox" v-model="dbSecurityOptions.setRootPassword" />
                    <span class="checkmark">✓</span>
                    <div class="option-content">
                       <div class="option-header">
                          <span class="option-title">Set root password</span>
                          <span class="badge recommended">Recommended</span>
                       </div>
                       <p class="option-desc">Creates a secure password for the admin account.</p>
                    </div>
                 </label>

                 <label class="security-option" :class="{ selected: dbSecurityOptions.removeAnonymousUsers }">
                    <input type="checkbox" v-model="dbSecurityOptions.removeAnonymousUsers" />
                    <span class="checkmark">✓</span>
                    <div class="option-content">
                       <div class="option-header">
                          <span class="option-title">Remove anonymous users</span>
                          <span class="badge recommended">Recommended</span>
                       </div>
                       <p class="option-desc">Deletes accounts that allow anyone to connect without password.</p>
                    </div>
                 </label>

                 <label class="security-option" :class="{ selected: dbSecurityOptions.disableRemoteRoot }">
                    <input type="checkbox" v-model="dbSecurityOptions.disableRemoteRoot" />
                    <span class="checkmark">✓</span>
                    <div class="option-content">
                       <div class="option-header">
                          <span class="option-title">Disable remote root access</span>
                          <span class="badge recommended">Recommended</span>
                       </div>
                       <p class="option-desc">Root should only connect from localhost.</p>
                    </div>
                 </label>

                 <label class="security-option" :class="{ selected: dbSecurityOptions.removeTestDb }">
                    <input type="checkbox" v-model="dbSecurityOptions.removeTestDb" />
                    <span class="checkmark">✓</span>
                    <div class="option-content">
                       <div class="option-header">
                          <span class="option-title">Remove test database</span>
                          <span class="badge recommended">Recommended</span>
                       </div>
                       <p class="option-desc">Deletes the default "test" database anyone can access.</p>
                    </div>
                 </label>

                 <label class="security-option" :class="{ selected: dbSecurityOptions.bindLocalhost }">
                    <input type="checkbox" v-model="dbSecurityOptions.bindLocalhost" />
                    <span class="checkmark">✓</span>
                    <div class="option-content">
                       <div class="option-header">
                          <span class="option-title">Bind to localhost only</span>
                          <span class="badge recommended">Recommended</span>
                       </div>
                       <p class="option-desc">External access requires SSH tunnel.</p>
                    </div>
                 </label>
              </div>

              <!-- PostgreSQL Options -->
              <div v-if="dbConfigType === 'postgresql'" class="security-options-list">
                 <label class="security-option" :class="{ selected: dbSecurityOptions.configureHba }">
                    <input type="checkbox" v-model="dbSecurityOptions.configureHba" />
                    <span class="checkmark">✓</span>
                    <div class="option-content">
                       <div class="option-header">
                          <span class="option-title">Require password authentication</span>
                          <span class="badge recommended">Recommended</span>
                       </div>
                       <p class="option-desc">Configures pg_hba.conf to require passwords.</p>
                    </div>
                 </label>

                 <label class="security-option" :class="{ selected: dbSecurityOptions.bindLocalhost }">
                    <input type="checkbox" v-model="dbSecurityOptions.bindLocalhost" />
                    <span class="checkmark">✓</span>
                    <div class="option-content">
                       <div class="option-header">
                          <span class="option-title">Bind to localhost only</span>
                          <span class="badge recommended">Recommended</span>
                       </div>
                       <p class="option-desc">External access requires SSH tunnel.</p>
                    </div>
                 </label>
              </div>

              <!-- Redis Options -->
              <div v-if="dbConfigType === 'redis'" class="security-options-list">
                 <label class="security-option" :class="{ selected: dbSecurityOptions.enableProtectedMode }">
                    <input type="checkbox" v-model="dbSecurityOptions.enableProtectedMode" />
                    <span class="checkmark">✓</span>
                    <div class="option-content">
                       <div class="option-header">
                          <span class="option-title">Enable protected mode</span>
                          <span class="badge recommended">Recommended</span>
                       </div>
                       <p class="option-desc">Blocks external connections when no password is set.</p>
                    </div>
                 </label>

                 <label class="security-option" :class="{ selected: dbSecurityOptions.bindLocalhost, critical: true }">
                    <input type="checkbox" v-model="dbSecurityOptions.bindLocalhost" />
                    <span class="checkmark">✓</span>
                    <div class="option-content">
                       <div class="option-header">
                          <span class="option-title">Bind to localhost only</span>
                          <span class="badge critical">Critical</span>
                       </div>
                       <p class="option-desc">Prevents external access attempts.</p>
                    </div>
                 </label>
              </div>
           </div>

           <!-- Warning for disabled security -->
           <div v-if="!dbSecurityOptions.bindLocalhost" class="notice warning">
              <span>⚠️</span>
              <span><strong>Warning:</strong> Disabling "Bind to localhost" exposes your database to the internet.</span>
           </div>

           <div class="notice info">
              <span>🔑</span>
              <span>The connection string will be shown <strong>once</strong>. Copy and save it in your app's .env file.</span>
           </div>
        </div>
        <div class="modal-footer">
           <button class="secondary" @click="showDbConfigModal = false">Cancel</button>
           <button class="premium-btn" @click="configureDatabase()" :disabled="configuringDatabase !== null">
              {{ configuringDatabase ? 'Setting up...' : '🚀 Install & Secure' }}
           </button>
        </div>
     </div>
  </div>

  <!-- Connection String Modal (Story 7.7) -->
  <div v-if="showConnectionStringModal" class="modal-overlay" style="z-index: 10001;" @click.self="showConnectionStringModal = false">
     <div class="glass-card connection-string-modal">
        <div class="modal-header success">
           <h3>✅ Database Configured</h3>
           <button class="close-btn" @click="showConnectionStringModal = false">×</button>
        </div>
        <div class="modal-body">
           <p class="modal-description">
              Your database has been configured successfully. Copy the connection string below and add it to your app's environment variables.
           </p>
           <div class="connection-string-box">
              <code>{{ lastConnectionString }}</code>
              <button class="copy-btn" @click="copyConnectionString()">📋 Copy</button>
           </div>
           <div class="warning-notice">
              <span>⚠️</span>
              <span>This connection string is shown only once. Make sure to save it securely!</span>
           </div>
        </div>
        <div class="modal-footer">
           <button class="premium-btn" @click="showConnectionStringModal = false">Got it</button>
        </div>
     </div>
  </div>

  <!-- Agent Update Console Modal -->
  <div v-if="showAgentUpdateModal" class="modal-overlay" style="z-index: 10002;">
     <div class="glass-card agent-update-modal">
        <div class="modal-header" :class="{ success: updateStatus?.status === 'success', error: updateStatus?.status === 'failed' }">
           <h3>🔄 {{ t('infrastructure.updatingAgent') || 'Updating Agent' }}</h3>
           <button class="close-btn" @click="closeAgentUpdateModal()" :disabled="!!updatingAgent && updateStatus?.status !== 'success' && updateStatus?.status !== 'failed'">×</button>
        </div>
        <div class="modal-body">
           <div class="update-status-bar">
              <span class="status-icon" v-if="updateStatus?.status === 'downloading'">📥</span>
              <span class="status-icon" v-else-if="updateStatus?.status === 'installing'">⚙️</span>
              <span class="status-icon" v-else-if="updateStatus?.status === 'restarting'">🔄</span>
              <span class="status-icon" v-else-if="updateStatus?.status === 'success'">✅</span>
              <span class="status-icon" v-else-if="updateStatus?.status === 'failed'">❌</span>
              <span class="status-icon" v-else>⏳</span>
              <span class="status-text">{{ updateStatus?.message || 'Initializing...' }}</span>
              <span v-if="updateStatus?.newVersion" class="new-version">v{{ updateStatus.newVersion }}</span>
           </div>
           <div class="update-console" ref="agentUpdateConsoleRef">
              <div v-if="agentUpdateLogs.length === 0" class="console-empty">
                 <div class="loader"></div>
                 <p>Waiting for logs...</p>
              </div>
              <div v-for="(log, idx) in agentUpdateLogs" :key="idx" :class="['log-line', log.stream]">{{ log.data }}</div>
           </div>
        </div>
        <div class="modal-footer">
           <button class="secondary" @click="closeAgentUpdateModal()">{{ t('common.close') || 'Close' }}</button>
        </div>
     </div>
  </div>

  <!-- Update Error Modal -->
  <div v-if="showUpdateErrorModal" class="modal-overlay" style="z-index: 10003;" @click.self="showUpdateErrorModal = false">
     <div class="glass-card update-error-modal">
        <div class="modal-header error">
           <h3>❌ {{ t('infrastructure.updateFailed') || 'Update Failed' }}</h3>
           <button class="close-btn" @click="showUpdateErrorModal = false">×</button>
        </div>
        <div class="modal-body">
           <p class="modal-description">
              {{ t('infrastructure.updateFailedDescription') || 'The agent update failed with the following error:' }}
           </p>
           <div class="error-console">
              <pre>{{ updateErrorMessage }}</pre>
           </div>
           <div class="warning-notice">
              <span>💡</span>
              <span>{{ t('infrastructure.updateFailedHint') || 'You can try updating manually via SSH or check the server logs for more details.' }}</span>
           </div>
        </div>
        <div class="modal-footer">
           <button class="secondary" @click="showUpdateErrorModal = false">{{ t('common.close') || 'Close' }}</button>
           <button class="premium-btn" @click="showUpdateErrorModal = false; showSshUpdateModal = true">
              🔑 {{ t('infrastructure.trySSHUpdate') || 'Try SSH Update' }}
           </button>
        </div>
     </div>
  </div>

  <!-- Service Logs Modal -->
  <div v-if="showServiceLogsModal" class="modal-overlay" style="z-index: 10004;" @click.self="closeServiceLogsModal()">
     <div class="glass-card service-logs-modal">
        <div class="modal-header">
           <h3>📋 {{ serviceLogsService }} - Installation Logs</h3>
           <button class="close-btn" @click="closeServiceLogsModal()">×</button>
        </div>
        <div class="modal-body">
           <div v-if="serviceLogsFilePath" class="log-file-path">
              <span>📂 Log file:</span>
              <code>{{ serviceLogsFilePath }}</code>
           </div>
           <div class="service-logs-console">
              <div v-if="fetchingServiceLogs" class="logs-loading">
                 Loading logs from server...
              </div>
              <div v-else-if="!serviceLogsContent" class="logs-empty">
                 No installation logs found for this service.
              </div>
              <pre v-else>{{ serviceLogsContent }}</pre>
           </div>
        </div>
        <div class="modal-footer">
           <button class="secondary" @click="copyServiceLogs()" :disabled="!serviceLogsContent">📋 Copy</button>
           <button class="premium-btn" @click="closeServiceLogsModal()">Close</button>
        </div>
     </div>
  </div>

  <!-- SSH Update Modal -->
  <div v-if="showSshUpdateModal" class="modal-overlay" style="z-index: 10002;" @click.self="!sshUpdateMode && (showSshUpdateModal = false)">
     <div class="glass-card ssh-update-modal">
        <div class="modal-header">
           <h3>🔄 {{ t('infrastructure.updateAgent') }}</h3>
           <button v-if="!sshUpdateMode" class="close-btn" @click="showSshUpdateModal = false">×</button>
        </div>

        <!-- Form State -->
        <div v-if="sshSession.status === 'idle'" class="modal-body">
           <p class="modal-description">
              {{ t('infrastructure.sshUpdateDescription') || 'SSH connection required to update agent on this server.' }}
           </p>

           <div class="server-target">
              <span class="server-label">{{ t('infrastructure.targetServer') || 'Target Server' }}:</span>
              <span class="server-name">{{ sshUpdateTargetServer?.name }}</span>
              <span class="server-ip">({{ sshUpdateTargetServer?.ip }})</span>
           </div>

           <div class="ssh-fields">
              <div class="form-group">
                 <label>{{ t('infrastructure.username') }}</label>
                 <input v-model="sshForm.username" placeholder="root" />
              </div>

              <div class="form-group">
                 <label>{{ t('infrastructure.authentication') }}</label>
                 <div class="auth-toggle">
                    <button
                       :class="['auth-btn', { active: sshForm.authType === 'password' }]"
                       @click="sshForm.authType = 'password'"
                    >{{ t('infrastructure.passwordAuth') }}</button>
                    <button
                       :class="['auth-btn', { active: sshForm.authType === 'key' }]"
                       @click="sshForm.authType = 'key'"
                    >{{ t('infrastructure.sshKey') }}</button>
                 </div>
              </div>

              <div v-if="sshForm.authType === 'password'" class="form-group">
                 <label>{{ t('infrastructure.passwordAuth') }}</label>
                 <input v-model="sshForm.password" type="password" :placeholder="t('infrastructure.enterPassword')" />
              </div>

              <div v-else class="form-group">
                 <label>{{ t('infrastructure.privateKey') }}</label>
                 <textarea
                    v-model="sshForm.privateKey"
                    :placeholder="t('infrastructure.pastePrivateKey')"
                    rows="3"
                    class="key-textarea"
                 ></textarea>
              </div>
           </div>

           <div class="privacy-notice-inline">
              🔒 {{ t('infrastructure.credentialsNotStored') || 'Credentials are never stored - used only for this session' }}
           </div>
        </div>

        <!-- Progress State -->
        <div v-else class="modal-body ssh-progress">
           <div class="progress-steps compact">
              <div
                 v-for="(step, idx) in [
                    { name: t('infrastructure.connecting') || 'Connecting', icon: '🔗' },
                    { name: t('infrastructure.downloadingBundle') || 'Downloading bundle', icon: '📦' },
                    { name: t('infrastructure.installingDeps') || 'Installing dependencies', icon: '⚙️' },
                    { name: t('infrastructure.restartingAgent') || 'Restarting agent', icon: '🚀' }
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

           <div :class="['status-message', sshSession.status]">
              {{ sshSession.message }}
           </div>

           <div class="ssh-terminal compact">
              <div v-for="(line, idx) in sshSession.output" :key="idx" class="terminal-line">{{ line }}</div>
              <div v-if="sshSession.output.length === 0" class="terminal-placeholder">
                 {{ t('infrastructure.waitingForOutput') || 'Waiting for output...' }}
              </div>
           </div>

           <div class="progress-bar-container">
              <div
                 class="progress-bar-fill"
                 :style="{ width: ((sshSession.step / sshSession.totalSteps) * 100) + '%' }"
              ></div>
           </div>
        </div>

        <div class="modal-footer">
           <template v-if="sshSession.status === 'idle'">
              <button class="secondary" @click="showSshUpdateModal = false">{{ t('common.cancel') }}</button>
              <button class="premium-btn" @click="startSSHUpdate()">
                 🚀 {{ t('infrastructure.startUpdate') || 'Start Update' }}
              </button>
           </template>
           <template v-else-if="sshSession.status === 'complete'">
              <button class="premium-btn" @click="showSshUpdateModal = false; resetSSHSession()">
                 ✅ {{ t('common.done') || 'Done' }}
              </button>
           </template>
           <template v-else-if="sshSession.status === 'error'">
              <button class="secondary" @click="resetSSHSession()">{{ t('common.tryAgain') || 'Try Again' }}</button>
              <button class="premium-btn" @click="showSshUpdateModal = false; resetSSHSession()">
                 {{ t('common.close') }}
              </button>
           </template>
           <template v-else>
              <button class="secondary" @click="cancelSSHInstallation(); showSshUpdateModal = false">
                 {{ t('common.cancel') }}
              </button>
           </template>
        </div>
     </div>
  </div>

  <!-- Delete Server Modal -->
  <div v-if="showDeleteServerModal" class="modal-overlay" style="z-index: 10003;" @click.self="!deletingServer && (showDeleteServerModal = false)">
     <div class="glass-card delete-server-modal">
        <div class="modal-header danger">
           <h3>🗑️ {{ t('infrastructure.removeServer') }}</h3>
           <button v-if="!deletingServer" class="close-btn" @click="showDeleteServerModal = false">×</button>
        </div>

        <div class="modal-body">
           <!-- Server info -->
           <div class="server-target danger">
              <span class="server-label">{{ t('infrastructure.targetServer') || 'Target Server' }}:</span>
              <span class="server-name">{{ deleteTargetServer?.alias || deleteTargetServer?.id?.slice(0, 8) }}</span>
              <span class="server-ip">({{ deleteTargetServer?.ip }})</span>
           </div>

           <!-- Warning message -->
           <div class="warning-box">
              <span class="warning-icon">⚠️</span>
              <div class="warning-text">
                 <strong>{{ t('infrastructure.deleteWarningTitle') || 'Warning' }}</strong>
                 <p>{{ t('infrastructure.confirmRemoveServer') }}</p>
              </div>
           </div>

           <!-- Associated resources -->
           <div v-if="deleteTargetServer" class="associated-resources">
              <h4>{{ t('infrastructure.associatedResources') || 'Associated resources that will be deleted:' }}</h4>
              <ul>
                 <li>{{ apps.filter(a => a.nodeId === deleteTargetServer.id).length }} {{ t('nav.applications') }}</li>
                 <li>{{ proxies.filter(p => p.nodeId === deleteTargetServer.id).length }} {{ t('nav.domains') }}</li>
              </ul>
           </div>

           <!-- Action choice -->
           <div class="action-choice">
              <h4>{{ t('infrastructure.deleteActionChoice') || 'Choose an action:' }}</h4>
              <div class="action-options">
                 <label class="action-option" :class="{ selected: deleteAction === 'stop' }">
                    <input type="radio" v-model="deleteAction" value="stop" />
                    <div class="option-content">
                       <span class="option-icon">⏹️</span>
                       <div class="option-text">
                          <strong>{{ t('infrastructure.disconnectOnly') || 'Disconnect only' }}</strong>
                          <p>{{ t('infrastructure.disconnectOnlyDesc') || 'Stop the agent but keep files on the server. You can reinstall later.' }}</p>
                       </div>
                    </div>
                 </label>
                 <label class="action-option" :class="{ selected: deleteAction === 'uninstall' }">
                    <input type="radio" v-model="deleteAction" value="uninstall" />
                    <div class="option-content">
                       <span class="option-icon">🗑️</span>
                       <div class="option-text">
                          <strong>{{ t('infrastructure.uninstallCompletely') || 'Uninstall completely' }}</strong>
                          <p>{{ t('infrastructure.uninstallCompletelyDesc') || 'Remove agent, apps and all ServerFlow files from the server.' }}</p>
                       </div>
                    </div>
                 </label>
              </div>
           </div>

           <!-- Offline warning -->
           <div v-if="deleteTargetServer?.status !== 'online'" class="offline-warning">
              <span>⚠️</span>
              <span>{{ t('infrastructure.agentOfflineWarning') || 'Agent is offline. The server will be removed from the dashboard, but the agent may continue running on the server.' }}</span>
           </div>
        </div>

        <div class="modal-footer">
           <button class="secondary" @click="showDeleteServerModal = false" :disabled="deletingServer">
              {{ t('common.cancel') }}
           </button>
           <button class="danger-btn" @click="confirmDeleteServer()" :disabled="deletingServer">
              {{ deletingServer ? '...' : (deleteAction === 'uninstall' ? t('infrastructure.uninstallCompletely') || 'Uninstall' : t('infrastructure.disconnectOnly') || 'Disconnect') }}
           </button>
        </div>
     </div>
  </div>

  <!-- Remove Runtime Modal -->
  <div v-if="showRemoveRuntimeModal" class="modal-overlay" style="z-index: 10003;" @click.self="!removingRuntime && (showRemoveRuntimeModal = false)">
     <div class="glass-card delete-server-modal">
        <div class="modal-header danger">
           <h3>🗑️ Remove {{ runtimeToRemove }}</h3>
           <button v-if="!removingRuntime" class="close-btn" @click="showRemoveRuntimeModal = false">×</button>
        </div>

        <div class="modal-body">
           <div class="warning-box">
              <span class="warning-icon">⚠️</span>
              <div class="warning-text">
                 <strong>Warning: This action may break your applications</strong>
                 <p>Removing this runtime will affect applications that depend on it. They will stop working until the runtime is reinstalled.</p>
              </div>
           </div>

           <div class="action-choice">
              <h4>Options</h4>
              <div class="action-options">
                 <label class="action-option" :class="{ selected: !removeRuntimePurge }">
                    <input type="radio" v-model="removeRuntimePurge" :value="false">
                    <div class="option-content">
                       <span class="option-icon">📦</span>
                       <div class="option-text">
                          <strong>Remove only</strong>
                          <p>Keep configuration files for potential reinstallation</p>
                       </div>
                    </div>
                 </label>
                 <label class="action-option" :class="{ selected: removeRuntimePurge }">
                    <input type="radio" v-model="removeRuntimePurge" :value="true">
                    <div class="option-content">
                       <span class="option-icon">🧹</span>
                       <div class="option-text">
                          <strong>Purge (complete removal)</strong>
                          <p>Also remove all configuration files</p>
                       </div>
                    </div>
                 </label>
              </div>
           </div>
        </div>

        <div class="modal-footer">
           <button class="secondary" @click="showRemoveRuntimeModal = false" :disabled="!!removingRuntime">
              {{ t('common.cancel') }}
           </button>
           <button class="danger-btn" @click="confirmRemoveRuntime()" :disabled="!!removingRuntime">
              {{ removingRuntime ? 'Removing...' : `Remove ${runtimeToRemove}` }}
           </button>
        </div>
     </div>
  </div>

  <!-- Remove Database Modal (Type-to-Confirm) -->
  <div v-if="showRemoveDatabaseModal" class="modal-overlay" style="z-index: 10003;" @click.self="!removingDatabase && (showRemoveDatabaseModal = false)">
     <div class="glass-card delete-server-modal">
        <div class="modal-header danger">
           <h3>🗑️ Remove {{ databaseToRemove }}</h3>
           <button v-if="!removingDatabase" class="close-btn" @click="showRemoveDatabaseModal = false">×</button>
        </div>

        <div class="modal-body">
           <div class="warning-box" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3);">
              <span class="warning-icon">🔴</span>
              <div class="warning-text">
                 <strong style="color: rgba(239, 68, 68, 0.9);">DANGER ZONE</strong>
                 <p>This action has serious consequences:</p>
                 <ul style="margin: 8px 0 0 16px; color: rgba(255, 255, 255, 0.7);">
                    <li>All database connections will be severed</li>
                    <li>Applications will lose access to their data</li>
                    <li>Data files remain on disk but become inaccessible</li>
                 </ul>
              </div>
           </div>

           <div class="action-choice">
              <h4>Options</h4>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                 <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" v-model="removeDatabasePurge">
                    <span>Purge configuration files</span>
                 </label>
                 <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #ef4444;">
                    <input type="checkbox" v-model="removeDatabaseData">
                    <span>⚠️ Delete data directory (IRREVERSIBLE)</span>
                 </label>
              </div>

              <h4>Type "DELETE {{ databaseToRemove }}" to confirm:</h4>
              <input
                 type="text"
                 v-model="removeDatabaseConfirmText"
                 placeholder="DELETE ..."
                 style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; font-family: monospace;"
              >
           </div>
        </div>

        <div class="modal-footer">
           <button class="secondary" @click="showRemoveDatabaseModal = false" :disabled="!!removingDatabase">
              {{ t('common.cancel') }}
           </button>
           <button
              class="danger-btn"
              @click="confirmRemoveDatabase()"
              :disabled="!!removingDatabase || removeDatabaseConfirmText !== `DELETE ${databaseToRemove}`"
           >
              {{ removingDatabase ? 'Removing...' : `Remove ${databaseToRemove}` }}
           </button>
        </div>
     </div>
  </div>

  <!-- Reconfigure Database Modal -->
  <div v-if="showReconfigureDatabaseModal" class="modal-overlay" style="z-index: 10003;" @click.self="!reconfiguringDatabase && (showReconfigureDatabaseModal = false)">
     <div class="glass-card delete-server-modal">
        <div class="modal-header" style="background: rgba(245, 158, 11, 0.1); border-bottom-color: rgba(245, 158, 11, 0.2);">
           <h3>🔄 Reconfigure {{ databaseToReconfigure }}</h3>
           <button v-if="!reconfiguringDatabase" class="close-btn" @click="showReconfigureDatabaseModal = false">×</button>
        </div>

        <div class="modal-body">
           <div class="warning-box">
              <span class="warning-icon">⚠️</span>
              <div class="warning-text">
                 <strong>New credentials will be generated</strong>
                 <p>Applications using the current credentials will need to be updated with the new connection string.</p>
              </div>
           </div>

           <div class="action-choice">
              <h4>Choose action</h4>
              <div class="action-options">
                 <label class="action-option" :class="{ selected: reconfigureResetPassword }">
                    <input type="radio" v-model="reconfigureResetPassword" :value="true">
                    <div class="option-content">
                       <span class="option-icon">🔑</span>
                       <div class="option-text">
                          <strong>Reset password only</strong>
                          <p>Generate new password for existing database/user</p>
                       </div>
                    </div>
                 </label>
                 <label class="action-option" :class="{ selected: !reconfigureResetPassword }" v-if="databaseToReconfigure !== 'redis'">
                    <input type="radio" v-model="reconfigureResetPassword" :value="false">
                    <div class="option-content">
                       <span class="option-icon">🗄️</span>
                       <div class="option-text">
                          <strong>Create new database</strong>
                          <p>Create a new database with new credentials</p>
                       </div>
                    </div>
                 </label>
              </div>

              <div v-if="!reconfigureResetPassword && databaseToReconfigure !== 'redis'" style="margin-top: 16px;">
                 <label style="display: block; margin-bottom: 8px; color: rgba(255,255,255,0.7);">Database name:</label>
                 <input
                    type="text"
                    v-model="reconfigureDbName"
                    placeholder="myapp"
                    style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white;"
                 >
              </div>
           </div>
        </div>

        <div class="modal-footer">
           <button class="secondary" @click="showReconfigureDatabaseModal = false" :disabled="!!reconfiguringDatabase">
              {{ t('common.cancel') }}
           </button>
           <button
              class="danger-btn"
              style="background: linear-gradient(135deg, #f59e0b, #d97706);"
              @click="confirmReconfigureDatabase()"
              :disabled="!!reconfiguringDatabase"
           >
              {{ reconfiguringDatabase ? 'Reconfiguring...' : 'Reconfigure' }}
           </button>
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
           <button class="secondary" @click="showDeployModal = false">{{ t('common.close') }}</button>
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
    <!-- Onboarding Overlay -->
    <div v-if="!user.onboardingCompleted" class="onboarding-overlay">
      <div class="onboarding-card">
        <div class="onboarding-header">
          <div class="onboarding-logo">SF</div>
          <h2>{{ t('onboarding.title') }}</h2>
          <p>{{ t('onboarding.subtitle') }}</p>
        </div>

        <form class="onboarding-form" @submit.prevent="submitOnboarding">
          <div class="form-row">
            <div class="form-group">
              <label>{{ t('onboarding.fullName') }} *</label>
              <input v-model="onboardingForm.billingName" type="text" placeholder="John Doe" required />
            </div>
            <div class="form-group">
              <label>{{ t('onboarding.email') }} *</label>
              <input v-model="onboardingForm.billingEmail" type="email" placeholder="john@example.com" required />
            </div>
          </div>

          <div class="form-group">
            <label>{{ t('onboarding.company') }} ({{ t('common.optional') }})</label>
            <input v-model="onboardingForm.billingCompany" type="text" placeholder="Acme Inc." />
          </div>

          <div class="form-group">
            <label>{{ t('onboarding.address') }} *</label>
            <input v-model="onboardingForm.billingAddress" type="text" placeholder="123 Main Street" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>{{ t('onboarding.city') }} *</label>
              <input v-model="onboardingForm.billingCity" type="text" placeholder="Paris" required />
            </div>
            <div class="form-group">
              <label>{{ t('onboarding.postalCode') }} *</label>
              <input v-model="onboardingForm.billingPostalCode" type="text" placeholder="75001" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>{{ t('onboarding.country') }} *</label>
              <select v-model="onboardingForm.billingCountry" required>
                <option value="">{{ t('onboarding.selectCountry') }}</option>
                <option value="FR">{{ t('onboarding.countries.FR') }}</option>
                <option value="DE">{{ t('onboarding.countries.DE') }}</option>
                <option value="GB">{{ t('onboarding.countries.GB') }}</option>
                <option value="US">{{ t('onboarding.countries.US') }}</option>
                <option value="BE">{{ t('onboarding.countries.BE') }}</option>
                <option value="CH">{{ t('onboarding.countries.CH') }}</option>
                <option value="ES">{{ t('onboarding.countries.ES') }}</option>
                <option value="IT">{{ t('onboarding.countries.IT') }}</option>
                <option value="NL">{{ t('onboarding.countries.NL') }}</option>
                <option value="PT">{{ t('onboarding.countries.PT') }}</option>
                <option value="CA">{{ t('onboarding.countries.CA') }}</option>
                <option value="AU">{{ t('onboarding.countries.AU') }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>{{ t('onboarding.phone') }} ({{ t('common.optional') }})</label>
              <input v-model="onboardingForm.billingPhone" type="tel" placeholder="+33 6 12 34 56 78" />
            </div>
          </div>

          <div class="form-group">
            <label>{{ t('onboarding.vatNumber') }} ({{ t('common.optional') }})</label>
            <input v-model="onboardingForm.billingVatNumber" type="text" placeholder="FR12345678901" />
          </div>

          <!-- Legal Checkboxes -->
          <div class="legal-section">
            <label class="checkbox-label">
              <input type="checkbox" v-model="onboardingForm.acceptTerms" />
              <span class="checkmark"></span>
              <span class="checkbox-text">
                {{ t('onboarding.acceptTerms') }} <a href="/terms" target="_blank">{{ t('onboarding.termsOfService') }}</a> {{ t('onboarding.and') }} <a href="/cgv" target="_blank">{{ t('onboarding.generalConditions') }}</a> *
              </span>
            </label>

            <label class="checkbox-label">
              <input type="checkbox" v-model="onboardingForm.acceptPrivacy" />
              <span class="checkmark"></span>
              <span class="checkbox-text">
                {{ t('onboarding.acceptTerms') }} <a href="/privacy" target="_blank">{{ t('onboarding.privacyPolicy') }}</a> {{ t('onboarding.gdpr') }} *
              </span>
            </label>

            <label class="checkbox-label">
              <input type="checkbox" v-model="onboardingForm.waiveWithdrawal" />
              <span class="checkmark"></span>
              <span class="checkbox-text">
                {{ t('onboarding.waiveWithdrawal') }} *
              </span>
            </label>
          </div>

          <p v-if="onboardingError" class="error-message">{{ onboardingError }}</p>

          <button type="submit" class="onboarding-submit" :disabled="onboardingLoading || !onboardingForm.acceptTerms || !onboardingForm.acceptPrivacy || !onboardingForm.waiveWithdrawal">
            <span v-if="onboardingLoading">{{ t('onboarding.saving') }}</span>
            <span v-else>{{ t('onboarding.continueToPlans') }}</span>
          </button>

          <p class="onboarding-footer">
            {{ t('auth.hasAccount') }} <a href="#" @click.prevent="logout">{{ t('common.logout') }}</a>
          </p>
        </form>
      </div>
    </div>

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
        <label>Application Ports</label>
        <div class="ports-config">
          <div v-for="(p, idx) in newApp.ports" :key="idx" class="port-row">
            <input v-model.number="p.port" type="number" placeholder="3000" class="port-input" />
            <input v-model="p.name" type="text" placeholder="main" class="port-name" />
            <label class="port-main-label">
              <input type="radio" name="mainPort" :checked="p.isMain" @change="setMainPort(idx)" /> Main
            </label>
            <button v-if="newApp.ports.length > 1" class="port-remove" @click="removePort(idx)" title="Remove">×</button>
          </div>
          <button type="button" class="add-port-btn" @click="addPort">+ Add Port</button>
        </div>
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

    <!-- Plan Modal -->
    <div v-if="showPlanModal" class="modal-overlay" @click.self="showPlanModal = false">
      <div class="modal-box" style="max-width: 500px;">
        <h3>{{ editingPlan ? 'Edit Plan' : 'Create Plan' }}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Name (internal)</label>
            <input v-model="planForm.name" placeholder="pro" :disabled="!!editingPlan" />
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input v-model="planForm.displayName" placeholder="Pro Plan" />
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label>Description</label>
            <input v-model="planForm.description" placeholder="For growing teams..." />
          </div>
          <div class="form-group">
            <label>Price Monthly (cents)</label>
            <input type="number" v-model.number="planForm.priceMonthly" />
          </div>
          <div class="form-group">
            <label>Price Yearly (cents)</label>
            <input type="number" v-model.number="planForm.priceYearly" />
          </div>
          <div class="form-group">
            <label>Max Servers (-1 = unlimited)</label>
            <input type="number" v-model.number="planForm.maxServers" />
          </div>
          <div class="form-group">
            <label>Max Apps</label>
            <input type="number" v-model.number="planForm.maxApps" />
          </div>
          <div class="form-group">
            <label>Max Domains</label>
            <input type="number" v-model.number="planForm.maxDomains" />
          </div>
          <div class="form-group">
            <label>Max Deploys/Day</label>
            <input type="number" v-model.number="planForm.maxDeploysPerDay" />
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label>Stripe Price ID Monthly</label>
            <input v-model="planForm.stripePriceIdMonthly" placeholder="price_xxx (optional)" />
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label>Stripe Price ID Yearly</label>
            <input v-model="planForm.stripePriceIdYearly" placeholder="price_xxx (optional)" />
          </div>
          <div class="form-group">
            <label><input type="checkbox" v-model="planForm.isActive" /> Active</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" v-model="planForm.isDefault" /> Default Plan</label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" @click="showPlanModal = false">Cancel</button>
          <button class="premium-btn" @click="savePlan">{{ editingPlan ? 'Save Changes' : 'Create Plan' }}</button>
        </div>
      </div>
    </div>

    <!-- PROVISION SERVER MODAL -->
    <div v-if="showProvisionModal" class="modal-overlay" @click.self="showProvisionModal = false">
      <div class="modal-box" style="max-width: 500px;">
        <h3 style="margin: 0 0 1rem 0;">Provision Cloud Server</h3>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
          Automatically deploy a new server with ServerFlow pre-installed.
        </p>

        <div class="form-group">
          <label>Provider</label>
          <select v-model="provisionForm.provider" class="form-input">
            <option v-for="p in vpsProviders.filter(p => p.configured)" :key="p.provider" :value="p.provider">
              {{ p.name }}
            </option>
          </select>
          <p v-if="!vpsProviders.some(p => p.configured)" style="color: #f59e0b; font-size: 0.875rem; margin-top: 0.5rem;">
            No providers configured. Add API keys in .env file.
          </p>
        </div>

        <div class="form-group">
          <label>Server Name</label>
          <input v-model="provisionForm.name" type="text" placeholder="my-server" class="form-input" />
        </div>

        <div class="form-group">
          <label>Server Type</label>
          <select v-model="provisionForm.planId" class="form-input">
            <option value="">Select a plan...</option>
            <option v-for="plan in filteredVPSPlans" :key="plan.id" :value="plan.id">
              {{ plan.name }} - {{ formatCurrency(plan.priceMonthly) }}/mo
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Region</label>
          <select v-model="provisionForm.regionId" class="form-input">
            <option value="">Select a region...</option>
            <option v-for="region in filteredVPSRegions" :key="region.id" :value="region.id">
              {{ region.name }} ({{ region.country }})
            </option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="secondary-btn" @click="showProvisionModal = false">Cancel</button>
          <button class="premium-btn" @click="provisionManagedServer" :disabled="provisionLoading || !provisionForm.name || !provisionForm.planId || !provisionForm.regionId">
            {{ provisionLoading ? 'Provisioning...' : 'Provision Server' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Menu Overlay -->
    <div v-if="mobileMenuOpen" class="mobile-overlay" @click="closeMobileMenu"></div>

    <!-- Sidebar Component -->
    <AppSidebar
      :user="user"
      :servers="servers"
      :active-menu="activeMenu"
      :selected-server-id="selectedServerId"
      :mobile-open="mobileMenuOpen"
      @update:active-menu="handleMenuChange"
      @update:selected-server-id="selectedServerId = $event"
      @navigate="handleSidebarNavigate"
      @connect-server="generateToken(); selectedServerId = 'pending'"
      @logout="logout"
      @close-mobile="closeMobileMenu"
    />

    <div class="main-wrapper">
      <header class="top-bar">
        <!-- Mobile Hamburger Button -->
        <button class="hamburger-btn" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="Toggle menu">
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </button>
        <div class="actions" style="margin-left: auto;">
           <button v-if="activeMenu === 'applications'" class="premium-btn" @click="showAddAppModal = true">+ {{ t('applications.newApp') }}</button>
           <span :class="['status-badge', serverStatus]" v-if="selectedServerId !== 'pending'">
             {{ serverStatus === 'online' ? 'Engine Online' : 'Node Offline' }}
          </span>
        </div>
      </header>

      <main class="content">
        <!-- APPLICATIONS VIEW -->
        <div v-if="activeMenu === 'applications'" class="apps-view">
           <h1 class="gradient-text">{{ t('nav.applications') }}</h1>
           <div class="apps-grid">
              <div v-for="app in apps" :key="app.id" class="glass-card app-card">
                 <div class="app-header">
                    <div class="app-icon"></div>
                    <div class="app-meta">
                       <h4>{{ app.name }}</h4>
                       <p>{{ app.repoUrl.split('/').pop() }}</p>
                    </div>
                    <div class="app-status">{{ t('applications.running') }}</div>
                 </div>
                 <div class="app-details">
                    <span>Node: {{ app.nodeId?.slice(0,8) }}</span>
                    <span v-if="app.ports && JSON.parse(app.ports || '[]').length > 0">
                      {{ t('applications.ports') || 'Ports' }}: {{ JSON.parse(app.ports || '[]').map((p: any) => `${p.port}${p.isMain ? '*' : ''}`).join(', ') }}
                    </span>
                    <span v-else>{{ t('applications.port') }}: {{ app.port }}</span>
                    <span v-if="app.detectedPorts" class="detected-ports" :title="'Detected from server'">
                      🔍 {{ JSON.parse(app.detectedPorts || '[]').join(', ') }}
                    </span>
                 </div>
                 <div class="app-actions">
                    <button class="action-btn" @click="triggerDeploy(app.id)">{{ t('applications.deploy') }}</button>
                    <button class="action-btn restore" @click="restoreApp(app.id)">{{ t('applications.restore') }}</button>
                    <button class="action-btn" @click="lifecycleAction(app.id, 'start')">{{ t('applications.start') }}</button>
                    <button class="action-btn" @click="lifecycleAction(app.id, 'restart')">{{ t('applications.restart') }}</button>
                    <button class="action-btn secondary" @click="lifecycleAction(app.id, 'stop')">{{ t('applications.stop') }}</button>
                    <button class="action-btn error" @click="deleteApp(app.id)">{{ t('common.delete') }}</button>
                 </div>
              </div>
              <div v-if="apps.length === 0" class="empty-msg">{{ t('applications.noApps') }}</div>
           </div>
        </div>

        <!-- ACTIVITY VIEW -->
        <div v-else-if="activeMenu === 'activity'" class="activity-view">
           <h1 class="gradient-text">{{ t('activityLogs.title') }}</h1>
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
        <!-- MCP VIEW -->
        <McpView v-else-if="activeMenu === 'mcp'" />

        <!-- CONSOLE VIEW -->
        <div v-else-if="activeMenu === 'console'" class="console-view">
           <h1 class="gradient-text">{{ t('console.liveConsole') }}</h1>
           <div v-if="!activeServer || selectedServerId === 'pending'" class="empty-msg">
              {{ t('console.selectServer') }}
           </div>
           <div v-else class="glass-card console-card">
              <div class="console-toolbar">
                 <div class="console-info">
                    <span class="console-server">{{ activeServer.id?.slice(0, 12) }}</span>
                    <span class="console-count">{{ filteredConsoleLogs.length }} {{ t('console.lines') }}</span>
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
                    <button class="clear-btn" @click="clearConsoleLogs">{{ t('common.clear') }}</button>
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

        <!-- BILLING VIEW -->
        <!-- BILLING VIEW -->
        <BillingView v-else-if="activeMenu === 'billing'" />

        <!-- MANAGED SERVERS VIEW (HIDDEN - kept for future use) -->
        <div v-else-if="false && activeMenu === 'managed-servers'" class="managed-servers-view">
           <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h1 class="gradient-text">Managed Servers</h1>
              <button class="premium-btn" @click="openProvisionModal">+ Provision Server</button>
           </div>

           <!-- Providers Status -->
           <div class="glass-card" style="padding: 1rem; margin-bottom: 1.5rem;" v-if="vpsProviders.length">
              <h4 style="margin: 0 0 0.5rem 0;">Available Providers</h4>
              <div style="display: flex; gap: 1rem;">
                 <div v-for="p in vpsProviders" :key="p.provider" class="provider-badge" :class="{ configured: p.configured }">
                    <span class="provider-icon">{{ getProviderIcon(p.provider) }}</span>
                    <span>{{ p.name }}</span>
                    <span :class="['status-dot', p.configured ? 'online' : 'offline']"></span>
                 </div>
              </div>
           </div>

           <!-- Managed Servers List -->
           <div v-if="managedServers.length === 0" class="glass-card empty-state" style="padding: 3rem; text-align: center;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">☁️</div>
              <h3>No managed servers yet</h3>
              <p style="color: var(--text-secondary);">Provision your first cloud server with one click.</p>
              <button class="premium-btn" style="margin-top: 1rem;" @click="openProvisionModal">+ Provision Server</button>
           </div>

           <div v-else class="managed-servers-grid">
              <div v-for="server in managedServers" :key="server.id" class="glass-card server-card">
                 <div class="server-header">
                    <div class="provider-icon-large">{{ getProviderIcon(server.provider) }}</div>
                    <div class="server-info">
                       <h4>{{ server.hostname || server.id.slice(0, 12) }}</h4>
                       <span :class="['status-badge', getManagedServerStatus(server.status).class]">
                          {{ getManagedServerStatus(server.status).label }}
                       </span>
                    </div>
                 </div>
                 <div class="server-details">
                    <div class="detail-row">
                       <span class="label">Provider</span>
                       <span class="value">{{ server.provider }}</span>
                    </div>
                    <div class="detail-row" v-if="server.ipAddress">
                       <span class="label">IP Address</span>
                       <span class="value monospace">{{ server.ipAddress }}</span>
                    </div>
                    <div class="detail-row" v-if="server.serverType">
                       <span class="label">Type</span>
                       <span class="value">{{ server.serverType }}</span>
                    </div>
                    <div class="detail-row" v-if="server.providerRegion">
                       <span class="label">Region</span>
                       <span class="value">{{ server.providerRegion }}</span>
                    </div>
                    <div class="detail-row" v-if="server.monthlyCostCents">
                       <span class="label">Cost</span>
                       <span class="value">{{ formatCurrency(server.monthlyCostCents) }}/mo</span>
                    </div>
                 </div>
                 <div class="server-actions">
                    <button class="action-btn danger" @click="deleteManagedServer(server)" title="Delete Server">🗑️</button>
                 </div>
              </div>
           </div>
        </div>

        <!-- SETTINGS VIEW -->
        <!-- SETTINGS VIEW -->
        <SettingsView v-else-if="activeMenu === 'settings'" :user="user" @logout="logout" />

        <!-- SUPPORT VIEW -->
        <SupportView v-else-if="activeMenu === 'support'" />

        <!-- SECURITY VIEW -->
        <SecurityView v-else-if="activeMenu === 'security'" />

        <!-- ADMIN USERS VIEW -->
        <AdminUsersView v-else-if="activeMenu === 'admin-users'" />

        <!-- ADMIN PLANS VIEW -->
        <AdminPlansView v-else-if="activeMenu === 'admin-plans'" />

        <!-- ADMIN METRICS VIEW -->
        <AdminMetricsView v-else-if="activeMenu === 'admin-metrics'" :proxies-count="proxies.length" />

        <!-- ADMIN SECURITY VIEW -->
        <AdminSecurityView v-else-if="activeMenu === 'admin-security'" />

        <!-- ADMIN SUPPORT VIEW -->
        <div v-else-if="activeMenu === 'admin-support'" class="admin-view support-admin">
           <h1 class="gradient-text">{{ t('support.admin.title') }}</h1>

           <!-- Support Metrics -->
           <div class="support-metrics" v-if="supportMetrics">
              <div class="metric-card open">
                 <div class="metric-value">{{ supportMetrics.openTickets }}</div>
                 <div class="metric-label">{{ t('support.statuses.open') }}</div>
              </div>
              <div class="metric-card progress">
                 <div class="metric-value">{{ supportMetrics.inProgressTickets }}</div>
                 <div class="metric-label">{{ t('support.statuses.inProgress') }}</div>
              </div>
              <div class="metric-card resolved">
                 <div class="metric-value">{{ supportMetrics.resolvedTickets }}</div>
                 <div class="metric-label">{{ t('support.statuses.resolved') }}</div>
              </div>
              <div class="metric-card unread">
                 <div class="metric-value">{{ supportMetrics.unreadMessages }}</div>
                 <div class="metric-label">{{ t('support.newLabel') }}</div>
              </div>
              <div class="metric-card new">
                 <div class="metric-value">{{ supportMetrics.newThisWeek }}</div>
                 <div class="metric-label">{{ t('time.weeksAgo', 1).replace('1 ', '') }}</div>
              </div>
           </div>

           <!-- Tabs -->
           <div class="support-tabs">
              <button :class="{ active: !showCannedResponseModal }" @click="showCannedResponseModal = false; loadAdminTickets()">{{ t('support.tickets') }}</button>
              <button :class="{ active: showCannedResponseModal }" @click="showCannedResponseModal = true; loadCannedResponses()">{{ t('support.admin.cannedResponses') }}</button>
           </div>

           <!-- Ticket Filters -->
           <div class="ticket-filters glass-card">
              <select v-model="adminTicketFilters.status" @change="loadAdminTickets()" class="filter-select">
                 <option value="">{{ t('common.all') }} {{ t('support.status') }}</option>
                 <option value="open">{{ t('support.statuses.open') }}</option>
                 <option value="pending">{{ t('support.statuses.pending') }}</option>
                 <option value="in_progress">{{ t('support.statuses.inProgress') }}</option>
                 <option value="resolved">{{ t('support.statuses.resolved') }}</option>
                 <option value="closed">{{ t('support.statuses.closed') }}</option>
              </select>
              <select v-model="adminTicketFilters.category" @change="loadAdminTickets()" class="filter-select">
                 <option value="">{{ t('common.all') }} {{ t('support.category') }}</option>
                 <option value="general">{{ t('support.categories.general') }}</option>
                 <option value="billing">{{ t('support.categories.billing') }}</option>
                 <option value="technical">{{ t('support.categories.technical') }}</option>
                 <option value="feature_request">{{ t('support.categories.featureRequest') }}</option>
                 <option value="bug_report">{{ t('support.categories.bugReport') }}</option>
              </select>
              <select v-model="adminTicketFilters.priority" @change="loadAdminTickets()" class="filter-select">
                 <option value="">{{ t('common.all') }} {{ t('support.priority') }}</option>
                 <option value="low">{{ t('support.priorities.low') }}</option>
                 <option value="normal">{{ t('support.priorities.normal') }}</option>
                 <option value="high">{{ t('support.priorities.high') }}</option>
                 <option value="urgent">{{ t('support.priorities.urgent') }}</option>
              </select>
           </div>

           <div class="admin-support-layout">
              <!-- Tickets List -->
              <div class="admin-tickets-panel glass-card">
                 <h3>{{ t('support.tickets') }}</h3>
                 <div v-if="adminTickets.length === 0" class="empty-state">
                    <p>{{ t('support.noTickets') }}</p>
                 </div>
                 <div v-else class="admin-tickets-list">
                    <div
                       v-for="ticket in adminTickets"
                       :key="ticket.id"
                       class="admin-ticket-item"
                       :class="{ active: selectedTicket?.id === ticket.id }"
                       @click="loadTicketDetails(ticket.id)"
                    >
                       <div class="ticket-row-header">
                          <span :class="['ticket-status', getTicketStatusClass(ticket.status)]">{{ ticket.status }}</span>
                          <span :class="['ticket-priority', getPriorityClass(ticket.priority)]">{{ ticket.priority }}</span>
                          <span v-if="ticket.unreadCount > 0" class="unread-badge">{{ ticket.unreadCount }}</span>
                       </div>
                       <div class="ticket-subject">{{ ticket.subject }}</div>
                       <div class="ticket-user">
                          <span class="user-email">{{ ticket.userEmail }}</span>
                          <span class="user-name">{{ ticket.userName }}</span>
                       </div>
                       <div class="ticket-meta">
                          <span>{{ getCategoryLabel(ticket.category) }}</span>
                          <span>{{ formatDate(ticket.lastMessageAt || ticket.createdAt) }}</span>
                       </div>
                    </div>
                 </div>
              </div>

              <!-- Ticket Detail / Chat -->
              <div class="admin-chat-panel glass-card" :class="{ expanded: expandedAdminChat }">
                 <div v-if="!selectedTicket" class="empty-state">
                    <p>{{ t('support.selectConversationDesc') }}</p>
                 </div>
                 <div v-else class="admin-chat-content">
                    <div class="admin-chat-header">
                       <div>
                          <h3>{{ selectedTicket.subject }}</h3>
                          <div class="chat-meta">
                             <select :value="selectedTicket.status" @change="updateTicketStatus(selectedTicket.id, ($event.target as HTMLSelectElement).value)" class="status-select">
                                <option value="open">{{ t('support.statuses.open') }}</option>
                                <option value="pending">{{ t('support.statuses.pending') }}</option>
                                <option value="in_progress">{{ t('support.statuses.inProgress') }}</option>
                                <option value="resolved">{{ t('support.statuses.resolved') }}</option>
                                <option value="closed">{{ t('support.statuses.closed') }}</option>
                             </select>
                             <span :class="['ticket-priority', getPriorityClass(selectedTicket.priority)]">{{ selectedTicket.priority }}</span>
                             <span>{{ getCategoryLabel(selectedTicket.category) }}</span>
                          </div>
                       </div>
                       <button class="expand-btn" @click="expandedAdminChat = !expandedAdminChat" :title="expandedAdminChat ? 'Réduire' : 'Agrandir'">
                          {{ expandedAdminChat ? '⊖' : '⊕' }}
                       </button>
                    </div>

                    <div class="chat-messages admin-messages">
                       <div
                          v-for="msg in ticketMessages"
                          :key="msg.id"
                          :class="['message', msg.senderType === 'user' ? 'message-user' : 'message-support', msg.isInternal ? 'message-internal' : '']"
                       >
                          <div class="message-header">
                             <span class="message-sender">
                                <template v-if="msg.senderType === 'user'">{{ msg.senderName || t('support.senderYou') }}</template>
                                <template v-else-if="msg.senderType === 'ai'">🤖 {{ t('support.senderAi') }}</template>
                                <template v-else-if="msg.senderType === 'system'">⚙️ {{ t('support.senderSystem') }}</template>
                                <template v-else>{{ msg.senderName || t('support.senderSupport') }}</template>
                                <span v-if="msg.isInternal" class="internal-badge">{{ t('support.admin.internal') }}</span>
                             </span>
                             <span class="message-time">{{ formatDate(msg.createdAt) }}</span>
                          </div>
                          <div class="message-content">{{ msg.content }}</div>
                       </div>
                    </div>

                    <!-- Attachments Section -->
                    <div v-if="ticketAttachments.length > 0" class="chat-attachments">
                       <div class="attachments-header">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                             <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                          <span>{{ t('support.attachments') }} ({{ ticketAttachments.length }})</span>
                       </div>
                       <div class="attachments-grid">
                          <div v-for="att in ticketAttachments" :key="att.id" class="attachment-item" @click="downloadAttachment(att)">
                             <div class="attachment-icon">
                                <svg v-if="att.mimeType?.startsWith('image/')" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                   <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                   <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                                </svg>
                             </div>
                             <div class="attachment-info">
                                <span class="attachment-name">{{ att.fileName }}</span>
                                <span class="attachment-size">{{ formatFileSize(att.fileSize) }}</span>
                             </div>
                             <div class="attachment-download">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                   <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                             </div>
                          </div>
                       </div>
                    </div>

                    <!-- Canned Responses Quick Insert -->
                    <div v-if="cannedResponses.length > 0" class="canned-quick">
                       <span>Quick:</span>
                       <button v-for="cr in cannedResponses.slice(0, 3)" :key="cr.id" @click="insertCannedResponse(cr)" class="canned-btn">
                          {{ cr.title }}
                       </button>
                    </div>

                    <!-- Admin Reply Box -->
                    <div class="admin-reply-box">
                       <textarea v-model="newMessage" :placeholder="t('support.typeMessage')" rows="3"></textarea>
                       <div class="reply-actions">
                          <label class="file-upload-btn">
                             <input type="file" multiple @change="uploadTicketFile" accept="image/*,.pdf,.txt,.zip" hidden />
                             <span>📎</span>
                          </label>
                          <button class="secondary" @click="sendAdminReply(true)" :disabled="sendingMessage || !newMessage.trim()">
                             {{ t('support.admin.internal') }}
                          </button>
                          <button class="primary-btn" @click="sendAdminReply(false)" :disabled="sendingMessage || !newMessage.trim()">
                             {{ sendingMessage ? t('common.loading') : t('support.sendMessage') }}
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <!-- Canned Responses Management Modal -->
           <div v-if="showCannedResponseModal" class="canned-responses-section glass-card" style="margin-top: 2rem;">
              <div class="section-header">
                 <h3>{{ t('support.admin.cannedResponses') }}</h3>
                 <button class="primary-btn small" @click="openNewCannedResponse()">+ {{ t('support.admin.newResponse') }}</button>
              </div>
              <div class="canned-list">
                 <div v-for="cr in cannedResponses" :key="cr.id" class="canned-item">
                    <div class="canned-info">
                       <strong>{{ cr.title }}</strong>
                       <span v-if="cr.isAutoResponse" class="auto-badge">Auto</span>
                       <span v-if="cr.category" class="category-badge">{{ cr.category }}</span>
                    </div>
                    <div class="canned-preview">{{ cr.content.substring(0, 100) }}...</div>
                    <div class="canned-actions">
                       <button class="action-btn" @click="openEditCannedResponse(cr)">✏️</button>
                       <button class="action-btn danger" @click="deleteCannedResponse(cr.id)">🗑️</button>
                    </div>
                 </div>
              </div>
           </div>

           <!-- Edit/Create Canned Response Modal -->
           <div v-if="showCannedForm" class="modal-overlay" @click.self="showCannedForm = false; editingCannedResponse = null">
              <div class="modal-card" style="max-width: 600px;">
                 <h2>{{ editingCannedResponse ? t('support.admin.editResponse') : t('support.admin.newResponse') }}</h2>
                 <div class="form-group">
                    <label>{{ t('support.admin.responseTitle') }}</label>
                    <input v-model="cannedResponseForm.title" type="text" class="form-input" />
                 </div>
                 <div class="form-group">
                    <label>{{ t('support.admin.responseContent') }}</label>
                    <textarea v-model="cannedResponseForm.content" rows="5" class="form-textarea"></textarea>
                 </div>
                 <div class="form-row">
                    <div class="form-group">
                       <label>{{ t('support.category') }} ({{ t('common.optional') }})</label>
                       <select v-model="cannedResponseForm.category" class="form-select">
                          <option value="">{{ t('common.all') }}</option>
                          <option value="general">{{ t('support.categories.general') }}</option>
                          <option value="billing">{{ t('support.categories.billing') }}</option>
                          <option value="technical">{{ t('support.categories.technical') }}</option>
                       </select>
                    </div>
                    <div class="form-group">
                       <label>Sort Order</label>
                       <input v-model.number="cannedResponseForm.sortOrder" type="number" class="form-input" />
                    </div>
                 </div>
                 <div class="form-group">
                    <label>{{ t('support.admin.keywords') }}</label>
                    <input v-model="cannedResponseForm.keywords" type="text" :placeholder="t('support.admin.keywordsPlaceholder')" class="form-input" />
                 </div>
                 <div class="form-group checkbox">
                    <label>
                       <input type="checkbox" v-model="cannedResponseForm.isAutoResponse" />
                       {{ t('support.admin.autoResponse') }}
                    </label>
                 </div>
                 <div class="modal-actions">
                    <button class="secondary" @click="showCannedForm = false; editingCannedResponse = null">{{ t('common.cancel') }}</button>
                    <button class="primary-btn" @click="saveCannedResponse">{{ t('common.save') }}</button>
                 </div>
              </div>
           </div>
        </div>

        <!-- INFRASTRUCTURE VIEW -->
        <div v-else-if="activeMenu === 'infrastructure'">
           <!-- Connect New Node -->
           <div v-if="selectedServerId === 'pending'" class="onboarding-view">
              <div class="connect-header">
                <button class="back-btn" @click="selectedServerId = null; resetSSHSession()">← {{ t('common.back') }}</button>
                <h1 class="gradient-text">{{ t('infrastructure.connectServer') }}</h1>
              </div>

              <!-- Tab Navigation -->
              <div class="connect-tabs">
                <button
                  :class="['tab-btn', { active: connectTab === 'quick' }]"
                  @click="connectTab = 'quick'; if (!token) generateToken()"
                >{{ t('infrastructure.quickInstall') }}</button>
                <button
                  :class="['tab-btn', { active: connectTab === 'assisted' }]"
                  @click="connectTab = 'assisted'"
                >{{ t('infrastructure.assistedInstall') }}</button>
              </div>

              <!-- Quick Install Tab -->
              <div v-if="connectTab === 'quick'" class="glass-card onboarding-box">
                <!-- Token generated successfully -->
                <template v-if="token">
                  <p class="quick-install-desc">{{ t('infrastructure.runCommand') }}</p>
                  <div class="terminal-mini" @click="copyCommand">
                    <code class="code-line"><span class="prompt">$</span> curl -sSL {{ baseUrl }}/install.sh | bash -s -- --token <span class="token">{{ token }}</span> --url {{ baseUrl }}</code>
                    <span class="copy-hint">{{ t('infrastructure.copyCommand') }}</span>
                  </div>
                  <div class="status-waiting"><div class="loader"></div> {{ t('infrastructure.connecting') }}</div>
                  <div class="requirements-inline">
                    <span>Requirements:</span> Debian/Ubuntu, root or sudo access, internet connectivity
                  </div>
                </template>
                <!-- Limit reached error -->
                <template v-else-if="tokenError">
                  <div class="limit-error-box">
                    <div class="limit-icon">🚫</div>
                    <h3>{{ t('errors.limitExceeded') }}</h3>
                    <p>{{ tokenError.message }}</p>
                    <button class="premium-btn" @click="activeMenu = 'billing'">
                      {{ t('billing.upgrade') }}
                    </button>
                  </div>
                </template>
                <!-- Loading state -->
                <template v-else-if="loading">
                  <div class="status-waiting"><div class="loader"></div> {{ t('common.loading') }}</div>
                </template>
                <!-- Initial state - trigger token generation -->
                <template v-else>
                  <div class="status-waiting">
                    <button class="premium-btn" @click="generateToken">Generate Installation Token</button>
                  </div>
                </template>
              </div>

              <!-- Assisted Setup Tab -->
              <div v-else-if="connectTab === 'assisted'" class="glass-card assisted-setup-box">
                <!-- Limit reached error -->
                <div v-if="tokenError" class="limit-error-box">
                  <div class="limit-icon">🚫</div>
                  <h3>{{ t('errors.serverLimitReached') }}</h3>
                  <p>{{ tokenError.message }}</p>
                  <button class="premium-btn" @click="activeMenu = 'billing'">
                    {{ t('billing.upgradePlan') }}
                  </button>
                </div>
                <!-- Idle/Form State -->
                <div v-else-if="sshSession.status === 'idle'" class="ssh-form">
                  <p class="assisted-desc">{{ t('infrastructure.assistedDesc') }}</p>

                  <div class="ssh-fields">
                    <div class="form-row">
                      <div class="form-group flex-grow">
                        <label>{{ t('infrastructure.serverAddress') }}</label>
                        <input v-model="sshForm.host" placeholder="192.168.1.100 or hostname" />
                      </div>
                      <div class="form-group port-field">
                        <label>{{ t('infrastructure.port') }}</label>
                        <input v-model.number="sshForm.port" type="number" />
                      </div>
                    </div>

                    <div class="form-group">
                      <label>{{ t('infrastructure.username') }}</label>
                      <input v-model="sshForm.username" placeholder="root" />
                    </div>

                    <div class="form-group">
                      <label>{{ t('infrastructure.authentication') }}</label>
                      <div class="auth-toggle">
                        <button
                          :class="['auth-btn', { active: sshForm.authType === 'password' }]"
                          @click="sshForm.authType = 'password'"
                        >{{ t('infrastructure.passwordAuth') }}</button>
                        <button
                          :class="['auth-btn', { active: sshForm.authType === 'key' }]"
                          @click="sshForm.authType = 'key'"
                        >{{ t('infrastructure.sshKey') }}</button>
                      </div>
                    </div>

                    <div v-if="sshForm.authType === 'password'" class="form-group">
                      <label>{{ t('infrastructure.passwordAuth') }}</label>
                      <input v-model="sshForm.password" type="password" :placeholder="t('infrastructure.enterPassword')" />
                    </div>

                    <div v-else class="form-group">
                      <label>{{ t('infrastructure.privateKey') }}</label>
                      <textarea
                        v-model="sshForm.privateKey"
                        :placeholder="t('infrastructure.pastePrivateKey')"
                        rows="3"
                        class="key-textarea"
                      ></textarea>
                    </div>
                  </div>

                  <div class="ssh-options">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="sshForm.verbose" />
                      <span>{{ t('infrastructure.showDetailedOutput') }}</span>
                    </label>
                  </div>

                  <button class="premium-btn full-width" @click="startSSHInstallation">
                    🚀 {{ t('infrastructure.startInstallation') }}
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
                 <h1 class="gradient-text">{{ t('nav.infrastructure') }}</h1>
                 <button class="add-node-btn" @click="selectedServerId = 'pending'; generateToken()">
                    <span>+</span> {{ t('infrastructure.connectServer') }}
                 </button>
              </div>

              <!-- Stats Bar -->
              <div class="infra-stats">
                 <div class="stat-card">
                    <span class="stat-value">{{ servers.length }}</span>
                    <span class="stat-label">{{ t('infrastructure.servers') }}</span>
                 </div>
                 <div class="stat-card">
                    <span class="stat-value success">{{ servers.filter(s => s.status === 'online').length }}</span>
                    <span class="stat-label">{{ t('infrastructure.online') }}</span>
                 </div>
                 <div class="stat-card">
                    <span class="stat-value">{{ apps.length }}</span>
                    <span class="stat-label">{{ t('nav.applications') }}</span>
                 </div>
                 <div class="stat-card">
                    <span class="stat-value">{{ proxies.length }}</span>
                    <span class="stat-label">{{ t('nav.domains') }}</span>
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
                          <span class="node-id">{{ server.id.slice(0, 8) }}{{ server.alias ? ` (${server.alias})` : '' }}</span>
                          <span :class="['node-status', server.status]">{{ t('infrastructure.' + server.status) }}</span>
                          <span v-if="server.agentVersion" class="node-version">v{{ server.agentVersion }}</span>
                       </div>
                       <span v-if="server.updateAvailable && server.status === 'online'" class="update-badge" @click.stop="updateAgent(server.id)">
                          <template v-if="updatingAgent === server.id">
                             ⏳ {{ updateStatus?.message || 'Updating...' }}
                          </template>
                          <template v-else>
                             ⬆️ {{ server.agentVersion || '?' }} → {{ bundleVersion || '?' }}
                          </template>
                       </span>
                    </div>
                    <div class="node-card-stats">
                       <div class="node-stat">
                          <span class="node-stat-value">{{ apps.filter(a => a.nodeId === server.id).length }}</span>
                          <span class="node-stat-label">{{ t('nav.applications') }}</span>
                       </div>
                       <div class="node-stat">
                          <span class="node-stat-value">{{ proxies.filter(p => p.nodeId === server.id).length }}</span>
                          <span class="node-stat-label">{{ t('nav.domains') }}</span>
                       </div>
                    </div>
                    <div class="node-card-action">
                       <span>{{ t('common.details') }} →</span>
                    </div>
                 </div>

                 <!-- Empty State -->
                 <div v-if="servers.length === 0" class="empty-infra">
                    <div class="empty-icon">🖥️</div>
                    <p>{{ t('infrastructure.noServers') }}</p>
                    <button class="premium-btn" @click="selectedServerId = 'pending'; generateToken()">{{ t('infrastructure.connectFirstServer') }}</button>
                 </div>
              </div>
           </div>

           <!-- Node Details -->
           <div v-else-if="activeServer && !serverSettingsMode" class="grid-layout">
              <div class="node-detail-header">
                 <button class="back-btn" @click="selectedServerId = null">← {{ t('common.back') }}</button>
                 <h1 class="gradient-text">{{ activeServer.alias || t('infrastructure.serverDetails') }}</h1>
                 <div class="header-actions">
                    <button class="settings-btn" @click="openServerSettings()" title="Server Settings">
                       ⚙️ {{ t('infrastructure.serverSettings') || 'Settings' }}
                    </button>
                    <button class="delete-server-btn" @click="openDeleteServerModal(activeServer)" :title="t('infrastructure.removeServer')">
                       🗑️ {{ t('infrastructure.removeServer') }}
                    </button>
                    <div class="alias-editor">
                       <template v-if="!editingAlias">
                          <button class="edit-alias-btn" @click="editingAlias = true; newAlias = activeServer.alias || ''">
                             {{ activeServer.alias ? '✏️' : '+ ' + t('infrastructure.setAlias') }}
                          </button>
                       </template>
                       <template v-else>
                          <input
                             v-model="newAlias"
                             type="text"
                             :placeholder="t('infrastructure.aliasPlaceholder')"
                             class="alias-input"
                             @keyup.enter="saveAlias"
                             @keyup.escape="editingAlias = false"
                          />
                          <button class="save-alias-btn" @click="saveAlias">✓</button>
                          <button class="cancel-alias-btn" @click="editingAlias = false">✗</button>
                       </template>
                    </div>
                 </div>
              </div>

              <!-- Status Bar - Full Width -->
              <div class="glass-card status-bar">
                 <div class="status-item">
                    <span class="status-label">{{ t('common.status') }}</span>
                    <span :class="['status-value', serverStatus === 'online' ? 'success' : 'error']">{{ t('infrastructure.' + serverStatus) }}</span>
                 </div>
                 <div class="status-item">
                    <span class="status-label">{{ t('infrastructure.serverId') }}</span>
                    <span class="status-value mono">{{ activeServer.id.slice(0, 12) }}</span>
                 </div>
                 <div class="status-item">
                    <span class="status-label">{{ t('nav.applications') }}</span>
                    <span class="status-value">{{ activeApps.length }}</span>
                 </div>
                 <div class="status-item">
                    <span class="status-label">{{ t('nav.domains') }}</span>
                    <span class="status-value">{{ activeProxies.length }}</span>
                 </div>
              </div>

              <div class="node-detail-grid">
                 <!-- Left Column: Services + Applications -->
                 <div class="glass-card provision-card">
                    <!-- Applications Header with Add button and Services dropdown -->
                    <div class="card-header-row">
                       <div class="card-title-group">
                          <h3>Applications</h3>
                          <span class="badge-mini">{{ activeApps.length }}</span>
                       </div>
                       <div class="card-actions-group">
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
                    <div v-if="activeApps.length === 0" class="empty-msg">No applications on this node.</div>
                    <div v-else class="apps-list">
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
                    <div class="card-header-row">
                       <div class="card-title-group">
                          <h3>Domains</h3>
                          <span class="badge-mini">{{ activeProxies.length }}</span>
                       </div>
                       <button class="add-app-btn" @click="showAddDomainModal = true" title="Add domain">+</button>
                    </div>
                    <div v-if="activeProxies.length === 0" class="empty-msg">No domains configured.</div>
                    <div v-else class="proxies-list">
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

           <!-- Server Settings View -->
           <ServerSettingsView
             v-else-if="activeServer && serverSettingsMode"
             :server="activeServer"
             :infra-status="infraStatus"
             :infra-status-loading="infraStatusLoading"
             :installing-runtime="installingRuntime"
             :updating-runtime="updatingRuntime"
             :removing-runtime="removingRuntime"
             :configuring-database="configuringDatabase"
             :reconfiguring-database="reconfiguringDatabase"
             :removing-database="removingDatabase"
             :installing-service="installingService"
             :removing-service="removingService"
             :starting-service="startingService"
             :stopping-service="stoppingService"
             :starting-database="startingDatabase"
             :stopping-database="stoppingDatabase"
             :infrastructure-logs="infrastructureLogs"
             :fetching-remote-logs="fetchingRemoteLogs"
             :remote-log-file-path="remoteLogFilePath"
             :mail-stack-result="mailStackResult"
             :database-stack-result="databaseStackResult"
             :database-info="databaseInfo"
             :database-operation-result="databaseOperationResult"
             @back="closeServerSettings"
             @refresh="requestServerStatus"
             @install-runtime="installRuntime"
             @update-runtime="updateRuntime"
             @remove-runtime="removeRuntime"
             @configure-database="handleConfigureDatabase"
             @reconfigure-database="handleReconfigureDatabase"
             @remove-database="removeDatabase"
             @start-database="startDatabase"
             @stop-database="stopDatabase"
             @install-service="installService"
             @remove-service="removeService"
             @start-service="startService"
             @stop-service="stopService"
             @fetch-service-logs="fetchServiceLogs"
             @fetch-remote-logs="fetchRemoteLogs"
             @clear-remote-logs="clearRemoteLogs"
             @clear-infra-logs="() => infrastructureLogs = []"
             @configure-mail-stack="configureMailStack"
             @configure-dns-stack="configureDnsStack"
             @configure-database-stack="configureDatabaseStack"
             @get-database-info="getDatabaseInfo"
             @reset-database-password="resetDatabasePassword"
             @create-database-instance="createDatabaseInstance"
           />

        </div>
      </main>
    </div>
  </div>
</template>

