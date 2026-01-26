import { ref, computed } from 'vue'
import { useApi } from './useApi'
import { useModal } from './useModal'

// Admin state (singleton)
const adminUsers = ref<any[]>([])
const adminPlans = ref<any[]>([])
const adminSubscriptions = ref<any[]>([])
const adminMetrics = ref<any>(null)
const adminSecurity = ref<any>(null)
const adminAgentKeys = ref<any[]>([])
const rotatingCPKey = ref(false)
const rotatingAgentKey = ref<string | null>(null)
const showPlanModal = ref(false)
const editingPlan = ref<any>(null)
const selectedUserDetails = ref<any>(null)
const showAssignPlanModal = ref(false)
const assignPlanUserId = ref<string | null>(null)
const assignPlanUserEmail = ref('')
const selectedPlanId = ref('')

const planForm = ref({
  name: '',
  displayName: '',
  description: '',
  priceMonthly: 0,
  priceYearly: 0,
  maxServers: 1,
  maxApps: 3,
  maxDomains: 3,
  maxDeploysPerDay: 10,
  stripePriceIdMonthly: '',
  stripePriceIdYearly: '',
  isActive: true,
  isDefault: false
})

export function useAdmin() {
  const { request } = useApi()
  const { showAlert, showConfirm } = useModal()

  async function loadAdminUsers() {
    try {
      const res = await request('/api/admin/users')
      adminUsers.value = res || []
    } catch (e) {
      console.error('Failed to load admin users:', e)
    }
  }

  async function loadAdminPlans() {
    try {
      const res = await request('/api/admin/plans')
      adminPlans.value = res || []
    } catch (e) {
      console.error('Failed to load admin plans:', e)
    }
  }

  async function loadAdminSubscriptions() {
    try {
      const res = await request('/api/admin/subscriptions')
      adminSubscriptions.value = res || []
    } catch (e) {
      console.error('Failed to load admin subscriptions:', e)
    }
  }

  async function loadAdminMetrics() {
    try {
      const res = await request('/api/admin/metrics')
      adminMetrics.value = res
    } catch (e) {
      console.error('Failed to load admin metrics:', e)
    }
  }

  async function loadAdminSecurity() {
    try {
      const [securityRes, agentsRes] = await Promise.all([
        request('/api/admin/security'),
        request('/api/admin/security/agents')
      ])
      adminSecurity.value = securityRes
      adminAgentKeys.value = agentsRes || []
    } catch (e) {
      console.error('Failed to load security info:', e)
    }
  }

  async function rotateCPKey() {
    if (!confirm('Regenerating the Control Plane key will require all offline agents to be manually updated. Continue?')) return
    rotatingCPKey.value = true
    try {
      const res = await request('/api/admin/security/rotate-cp-key', { method: 'POST' })
      if (res?.success) {
        alert(`Key rotated successfully. ${res.agentsNotified} agents notified.`)
        await loadAdminSecurity()
      }
    } catch (e) {
      console.error('Failed to rotate CP key:', e)
      alert('Failed to rotate key')
    } finally {
      rotatingCPKey.value = false
    }
  }

  async function rotateAgentKey(nodeId: string) {
    if (!confirm('This will regenerate the agent identity. The agent must be online. Continue?')) return
    rotatingAgentKey.value = nodeId
    try {
      const res = await request(`/api/admin/security/rotate-agent-key/${nodeId}`, { method: 'POST' })
      if (res?.success) {
        alert('Agent key rotation initiated')
        setTimeout(() => loadAdminSecurity(), 2000)
      }
    } catch (e: any) {
      console.error('Failed to rotate agent key:', e)
      alert(e.message || 'Failed to rotate agent key')
    } finally {
      rotatingAgentKey.value = null
    }
  }

  function openPlanModal(plan?: any) {
    if (plan) {
      editingPlan.value = plan
      planForm.value = {
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description || '',
        priceMonthly: plan.priceMonthly || 0,
        priceYearly: plan.priceYearly || 0,
        maxServers: plan.maxServers || 1,
        maxApps: plan.maxApps || 3,
        maxDomains: plan.maxDomains || 3,
        maxDeploysPerDay: plan.maxDeploysPerDay || 10,
        stripePriceIdMonthly: plan.stripePriceIdMonthly || '',
        stripePriceIdYearly: plan.stripePriceIdYearly || '',
        isActive: plan.isActive ?? true,
        isDefault: plan.isDefault ?? false
      }
    } else {
      editingPlan.value = null
      planForm.value = {
        name: '',
        displayName: '',
        description: '',
        priceMonthly: 0,
        priceYearly: 0,
        maxServers: 1,
        maxApps: 3,
        maxDomains: 3,
        maxDeploysPerDay: 10,
        stripePriceIdMonthly: '',
        stripePriceIdYearly: '',
        isActive: true,
        isDefault: false
      }
    }
    showPlanModal.value = true
  }

  async function savePlan() {
    try {
      if (editingPlan.value) {
        await request(`/api/admin/plans/${editingPlan.value.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(planForm.value)
        })
        showAlert('Success', 'Plan updated successfully', 'info')
      } else {
        await request('/api/admin/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(planForm.value)
        })
        showAlert('Success', 'Plan created successfully', 'info')
      }
      showPlanModal.value = false
      loadAdminPlans()
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save plan', 'error')
    }
  }

  async function deletePlan(planId: string) {
    showConfirm('Delete Plan', 'Are you sure you want to delete this plan?', async () => {
      try {
        await request(`/api/admin/plans/${planId}`, { method: 'DELETE' })
        showAlert('Success', 'Plan deleted', 'info')
        loadAdminPlans()
      } catch (e: any) {
        showAlert('Error', e.error || 'Failed to delete plan', 'error')
      }
    })
  }

  async function updateUserRole(userId: string, role: string) {
    try {
      await request(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      showAlert('Success', 'User role updated', 'info')
      loadAdminUsers()
    } catch (e) {
      showAlert('Error', 'Failed to update user', 'error')
    }
  }

  async function impersonateUser(userId: string) {
    showConfirm('Impersonate User', 'You will be logged in as this user. Continue?', async () => {
      try {
        await request(`/api/admin/users/${userId}/impersonate`, { method: 'POST' })
        window.location.reload()
      } catch (e) {
        showAlert('Error', 'Failed to impersonate user', 'error')
      }
    })
  }

  function assignUserPlan(userId: string, userEmail: string) {
    assignPlanUserId.value = userId
    assignPlanUserEmail.value = userEmail
    selectedPlanId.value = ''
    showAssignPlanModal.value = true
  }

  async function confirmAssignPlan() {
    if (!assignPlanUserId.value || !selectedPlanId.value) return
    try {
      await request(`/api/admin/subscriptions/${assignPlanUserId.value}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId.value, status: 'active' })
      })
      showAlert('Success', 'Subscription assigned', 'info')
      showAssignPlanModal.value = false
      loadAdminUsers()
      loadAdminSubscriptions()
    } catch (e) {
      showAlert('Error', 'Failed to assign subscription', 'error')
    }
  }

  function viewUserDetails(u: any) {
    selectedUserDetails.value = u
  }

  // Chart helper functions
  function getFreeUsersArc(): string {
    if (!adminMetrics.value || adminMetrics.value.users.total === 0) return '0 251.2'
    const freeUsers = adminMetrics.value.users.total - adminMetrics.value.subscriptions.active
    const percentage = freeUsers / adminMetrics.value.users.total
    const circumference = 2 * Math.PI * 40
    return `${percentage * circumference} ${circumference}`
  }

  function getPaidUsersArc(): string {
    if (!adminMetrics.value || adminMetrics.value.users.total === 0) return '0 251.2'
    const percentage = adminMetrics.value.subscriptions.active / adminMetrics.value.users.total
    const circumference = 2 * Math.PI * 40
    return `${percentage * circumference} ${circumference}`
  }

  function getFreeUsersOffset(): string {
    if (!adminMetrics.value || adminMetrics.value.users.total === 0) return '0'
    const freeUsers = adminMetrics.value.users.total - adminMetrics.value.subscriptions.active
    const percentage = freeUsers / adminMetrics.value.users.total
    const circumference = 2 * Math.PI * 40
    return `${percentage * circumference}`
  }

  function getBarWidth(value: number, max: number): string {
    if (max === 0) return '0%'
    return `${Math.min(100, (value / max) * 100)}%`
  }

  return {
    // State
    adminUsers,
    adminPlans,
    adminSubscriptions,
    adminMetrics,
    adminSecurity,
    adminAgentKeys,
    rotatingCPKey,
    rotatingAgentKey,
    showPlanModal,
    editingPlan,
    selectedUserDetails,
    showAssignPlanModal,
    assignPlanUserId,
    assignPlanUserEmail,
    selectedPlanId,
    planForm,
    // Functions
    loadAdminUsers,
    loadAdminPlans,
    loadAdminSubscriptions,
    loadAdminMetrics,
    loadAdminSecurity,
    rotateCPKey,
    rotateAgentKey,
    openPlanModal,
    savePlan,
    deletePlan,
    updateUserRole,
    impersonateUser,
    assignUserPlan,
    confirmAssignPlan,
    viewUserDetails,
    getFreeUsersArc,
    getPaidUsersArc,
    getFreeUsersOffset,
    getBarWidth
  }
}
