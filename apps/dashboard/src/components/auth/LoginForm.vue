<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GithubAuthButton from './GithubAuthButton.vue'
import type { AuthForm } from '@/types'

const { t } = useI18n()

interface Props {
  loading?: boolean
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: ''
})

const emit = defineEmits<{
  submit: [form: AuthForm]
  githubLogin: []
}>()

const authMode = ref<'login' | 'register'>('login')
const form = ref<AuthForm>({
  email: '',
  password: '',
  name: ''
})

const isLogin = computed(() => authMode.value === 'login')

function handleSubmit() {
  emit('submit', { ...form.value })
}

function handleGithubLogin() {
  emit('githubLogin')
}

function switchMode(mode: 'login' | 'register') {
  authMode.value = mode
  form.value = { email: '', password: '', name: '' }
}
</script>

<template>
  <div class="login-card glass-card">
    <div class="login-logo">{{ t('app.title') }}</div>
    <p class="tagline">{{ t('app.tagline') }}</p>

    <!-- Auth Tabs -->
    <div class="auth-tabs">
      <div
        class="auth-tab"
        :class="{ active: authMode === 'login' }"
        @click="switchMode('login')"
      >
        {{ t('auth.login') }}
      </div>
      <div
        class="auth-tab"
        :class="{ active: authMode === 'register' }"
        @click="switchMode('register')"
      >
        {{ t('auth.register') }}
      </div>
    </div>

    <!-- Login/Register Form -->
    <form class="login-form" @submit.prevent="handleSubmit">
      <!-- Name field (register only) -->
      <div v-if="!isLogin" class="form-group">
        <label>{{ t('auth.fullName') }}</label>
        <input
          v-model="form.name"
          type="text"
          placeholder="John Doe"
          required
        />
      </div>

      <div class="form-group">
        <label>{{ t('auth.emailAddress') }}</label>
        <input
          v-model="form.email"
          type="email"
          placeholder="john@example.com"
          required
        />
      </div>

      <div class="form-group">
        <label>{{ t('common.password') }}</label>
        <input
          v-model="form.password"
          type="password"
          placeholder="••••••••"
          required
        />
      </div>

      <button type="submit" class="premium-btn" :disabled="loading">
        {{ isLogin ? t('auth.signIn') : t('auth.createAccount') }}
      </button>

      <div v-if="error" class="auth-error">{{ error }}</div>
    </form>

    <!-- OAuth Divider -->
    <div class="oauth-divider">{{ t('auth.orContinueWith') }}</div>

    <!-- GitHub Login -->
    <GithubAuthButton @click="handleGithubLogin" />
  </div>
</template>

<style scoped>
.login-card {
  width: 100%;
  max-width: 420px;
  padding: 48px 40px;
  text-align: center;
}

.login-logo {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.tagline {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-bottom: 32px;
}

.auth-tabs {
  display: flex;
  background: var(--bg-color);
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 24px;
}

.auth-tab {
  flex: 1;
  padding: 10px;
  text-align: center;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-muted);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.auth-tab.active {
  background: var(--surface-color);
  color: var(--text-main);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.auth-tab:hover:not(.active) {
  color: var(--text-main);
}

.login-form {
  text-align: left;
}

.login-form .form-group {
  margin-bottom: 16px;
}

.login-form label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 6px;
}

.login-form input {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-color);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  font-size: 0.95rem;
  color: var(--text-main);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.login-form input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.login-form .premium-btn {
  width: 100%;
  margin-top: 8px;
}

.auth-error {
  margin-top: 16px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: var(--error-color);
  font-size: 0.9rem;
  text-align: center;
}

.oauth-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.oauth-divider::before,
.oauth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--surface-border);
}

/* Responsive */
@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
    margin: 16px;
  }

  .login-logo {
    font-size: 1.75rem;
  }
}
</style>
