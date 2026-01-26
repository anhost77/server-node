import { ref, readonly } from 'vue'
import { useApi } from './useApi'
import type { User, AuthForm, OnboardingForm } from '@/types'

// Singleton state
const user = ref<User | null>(null)
const loading = ref(false)
const authError = ref('')
const authMode = ref<'login' | 'register' | 'forgot'>('login')
const authForm = ref<AuthForm>({
  email: '',
  password: '',
  name: ''
})

// GitHub OAuth
const ghToken = ref<string | null>(localStorage.getItem('gh_token'))

// Onboarding
const onboardingForm = ref<OnboardingForm>({
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

export function useAuth() {
  const { request, post, baseUrl } = useApi()

  /**
   * Check current authentication state
   */
  async function checkAuth(): Promise<boolean> {
    try {
      const res = await request<User>('/api/auth/me')
      if (res && res.id) {
        user.value = res
        initOnboardingForm()
        return true
      }
    } catch (e) {
      // Ignore errors
    }
    user.value = null
    return false
  }

  /**
   * Handle email/password authentication
   */
  async function handleEmailAuth(): Promise<boolean> {
    authError.value = ''
    loading.value = true

    try {
      const endpoint = authMode.value === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res = await post(endpoint, authForm.value)

      if (res.error) {
        authError.value = res.error
        return false
      }

      const ok = await checkAuth()
      return ok
    } catch (e: any) {
      authError.value = 'Connection failed'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Redirect to GitHub OAuth login
   */
  function loginWithGithub() {
    window.location.href = `${baseUrl}/api/auth/github/login`
  }

  /**
   * Handle GitHub OAuth callback token
   */
  function handleGithubCallback(): boolean {
    const urlParams = new URLSearchParams(window.location.search)
    const tokenFromUrl = urlParams.get('gh_token')

    if (tokenFromUrl) {
      ghToken.value = tokenFromUrl
      localStorage.setItem('gh_token', tokenFromUrl)
      window.history.replaceState({}, document.title, '/')
      return true
    }
    return false
  }

  /**
   * Logout current user
   */
  async function logout() {
    await post('/api/auth/logout')
    user.value = null
    ghToken.value = null
    localStorage.removeItem('gh_token')
  }

  /**
   * Initialize onboarding form with user data
   */
  function initOnboardingForm() {
    if (user.value) {
      onboardingForm.value.billingName = user.value.name || ''
      onboardingForm.value.billingEmail = user.value.email || ''
    }
  }

  /**
   * Submit onboarding form
   */
  async function submitOnboarding(): Promise<{ success: boolean; error?: string }> {
    onboardingError.value = ''

    // Validate legal checkboxes
    if (!onboardingForm.value.acceptTerms) {
      onboardingError.value = 'You must accept the Terms of Service'
      return { success: false, error: onboardingError.value }
    }
    if (!onboardingForm.value.acceptPrivacy) {
      onboardingError.value = 'You must accept the Privacy Policy'
      return { success: false, error: onboardingError.value }
    }
    if (!onboardingForm.value.waiveWithdrawal) {
      onboardingError.value = 'You must acknowledge the withdrawal waiver to access the service immediately'
      return { success: false, error: onboardingError.value }
    }

    onboardingLoading.value = true

    try {
      const res = await post('/api/billing/onboarding', onboardingForm.value)

      if (res.error) {
        onboardingError.value = res.error
        return { success: false, error: res.error }
      }

      // Update user
      if (user.value) {
        user.value.onboardingCompleted = 1
      }
      return { success: true }
    } catch (e: any) {
      onboardingError.value = 'Failed to save billing information'
      return { success: false, error: onboardingError.value }
    } finally {
      onboardingLoading.value = false
    }
  }

  /**
   * Clear GitHub token (on error)
   */
  function clearGithubToken() {
    ghToken.value = null
    localStorage.removeItem('gh_token')
  }

  /**
   * Reset auth form
   */
  function resetAuthForm() {
    authForm.value = { email: '', password: '', name: '' }
    authError.value = ''
  }

  return {
    // State
    user: readonly(user),
    loading: readonly(loading),
    authError: readonly(authError),
    authMode,
    authForm,
    ghToken: readonly(ghToken),
    onboardingForm,
    onboardingError: readonly(onboardingError),
    onboardingLoading: readonly(onboardingLoading),

    // Internal state (for mutations)
    _user: user,
    _ghToken: ghToken,

    // Methods
    checkAuth,
    handleEmailAuth,
    loginWithGithub,
    handleGithubCallback,
    logout,
    initOnboardingForm,
    submitOnboarding,
    clearGithubToken,
    resetAuthForm
  }
}
