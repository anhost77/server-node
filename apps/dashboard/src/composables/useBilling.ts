import { ref, computed } from 'vue'
import { useApi } from './useApi'
import { useModal } from './useModal'

// Billing state (singleton)
const billingPlans = ref<any[]>([])
const currentSubscription = ref<any>(null)
const usageReport = ref<any>(null)

// Managed Servers state
const managedServers = ref<any[]>([])
const vpsProviders = ref<any[]>([])
const vpsPlans = ref<any[]>([])
const vpsRegions = ref<any[]>([])
const showProvisionModal = ref(false)
const provisionForm = ref({
  provider: 'hetzner',
  planId: '',
  regionId: '',
  name: ''
})
const provisionLoading = ref(false)

export function useBilling() {
  const { request } = useApi()
  const { showAlert, showConfirm } = useModal()

  async function loadBillingPlans() {
    try {
      const res = await request('/api/billing/plans')
      billingPlans.value = res?.plans || []
    } catch (e) {
      console.error('Failed to load billing plans:', e)
    }
  }

  async function loadSubscription() {
    try {
      currentSubscription.value = await request('/api/billing/subscription')
    } catch (e) {
      console.error('Failed to load subscription:', e)
    }
  }

  async function loadUsageReport() {
    try {
      usageReport.value = await request('/api/billing/usage')
    } catch (e) {
      console.error('Failed to load usage report:', e)
    }
  }

  async function upgradePlan(planId: string, interval: 'month' | 'year' = 'month') {
    try {
      const res = await request('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingInterval: interval })
      })
      if (res?.url) {
        window.location.href = res.url
      } else {
        showAlert('Error', 'Could not create checkout session', 'error')
      }
    } catch (e) {
      showAlert('Error', 'Failed to start checkout', 'error')
    }
  }

  async function openBillingPortal() {
    try {
      const res = await request('/api/billing/portal', { method: 'POST' })
      if (res?.url) {
        window.open(res.url, '_blank')
      } else {
        showAlert('Info', 'No billing account found. Upgrade first to access the billing portal.', 'info')
      }
    } catch (e) {
      showAlert('Error', 'Failed to open billing portal', 'error')
    }
  }

  function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
  }

  // Managed Servers functions
  async function loadManagedServers() {
    try {
      managedServers.value = await request('/api/managed-servers') || []
    } catch (e) {
      console.error('Failed to load managed servers:', e)
    }
  }

  async function loadVPSProviders() {
    try {
      vpsProviders.value = await request('/api/managed-servers/providers') || []
    } catch (e) {
      console.error('Failed to load VPS providers:', e)
    }
  }

  async function loadVPSPlans() {
    try {
      vpsPlans.value = await request('/api/managed-servers/plans') || []
    } catch (e) {
      console.error('Failed to load VPS plans:', e)
    }
  }

  async function loadVPSRegions() {
    try {
      vpsRegions.value = await request('/api/managed-servers/regions') || []
    } catch (e) {
      console.error('Failed to load VPS regions:', e)
    }
  }

  const filteredVPSPlans = computed(() => {
    return vpsPlans.value.filter(p => p.provider === provisionForm.value.provider)
  })

  const filteredVPSRegions = computed(() => {
    const selectedPlan = vpsPlans.value.find(p => p.id === provisionForm.value.planId)
    if (!selectedPlan) return vpsRegions.value.filter(r => r.provider === provisionForm.value.provider)
    return vpsRegions.value.filter(r =>
      r.provider === provisionForm.value.provider &&
      selectedPlan.regions.includes(r.id.replace(`${r.provider}-`, ''))
    )
  })

  async function openProvisionModal() {
    showProvisionModal.value = true
    provisionForm.value = { provider: 'hetzner', planId: '', regionId: '', name: '' }
    await Promise.all([loadVPSProviders(), loadVPSPlans(), loadVPSRegions()])
  }

  async function provisionManagedServer() {
    if (!provisionForm.value.name || !provisionForm.value.planId || !provisionForm.value.regionId) {
      showAlert('Error', 'Please fill all fields', 'error')
      return
    }

    provisionLoading.value = true
    try {
      const planParts = provisionForm.value.planId.split('-')
      const regionParts = provisionForm.value.regionId.split('-')

      const res = await request('/api/managed-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provisionForm.value.provider,
          planId: planParts.slice(1).join('-'),
          regionId: regionParts.slice(1).join('-'),
          name: provisionForm.value.name
        })
      })

      if (res?.error) {
        showAlert('Error', res.message || 'Failed to provision server', 'error')
      } else {
        showAlert('Success', `Server "${provisionForm.value.name}" is being provisioned. It will appear in your list once ready.`, 'info')
        showProvisionModal.value = false
        await loadManagedServers()
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to provision server', 'error')
    } finally {
      provisionLoading.value = false
    }
  }

  async function deleteManagedServer(server: any) {
    showConfirm('Delete Server', `Are you sure you want to delete "${server.hostname || server.id}"? This will also terminate the server at the provider.`, async () => {
      try {
        const res = await request(`/api/managed-servers/${server.id}`, { method: 'DELETE' })
        if (res?.success) {
          await loadManagedServers()
          showAlert('Success', 'Server deleted successfully', 'info')
        } else {
          showAlert('Error', res?.message || 'Failed to delete server', 'error')
        }
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to delete server', 'error')
      }
    })
  }

  function getProviderIcon(provider: string): string {
    switch (provider) {
      case 'hetzner': return 'H'
      case 'digitalocean': return 'DO'
      case 'vultr': return 'V'
      default: return '?'
    }
  }

  function getManagedServerStatus(status: string): { class: string, label: string } {
    switch (status) {
      case 'provisioning': return { class: 'status-pending', label: 'Provisioning' }
      case 'active': return { class: 'status-online', label: 'Active' }
      case 'error': return { class: 'status-error', label: 'Error' }
      case 'terminated': return { class: 'status-offline', label: 'Terminated' }
      default: return { class: 'status-unknown', label: status }
    }
  }

  return {
    // State
    billingPlans,
    currentSubscription,
    usageReport,
    managedServers,
    vpsProviders,
    vpsPlans,
    vpsRegions,
    showProvisionModal,
    provisionForm,
    provisionLoading,
    filteredVPSPlans,
    filteredVPSRegions,
    // Functions
    loadBillingPlans,
    loadSubscription,
    loadUsageReport,
    upgradePlan,
    openBillingPortal,
    formatCurrency,
    loadManagedServers,
    loadVPSProviders,
    loadVPSPlans,
    loadVPSRegions,
    openProvisionModal,
    provisionManagedServer,
    deleteManagedServer,
    getProviderIcon,
    getManagedServerStatus
  }
}
