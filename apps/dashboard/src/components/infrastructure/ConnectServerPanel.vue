<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SSHForm, SSHSession } from '@/types'
import { useApi } from '@/composables'

const { t } = useI18n()
const { baseUrl } = useApi()

interface Props {
  token?: string | null
  tokenError?: { message: string; upgradeUrl?: string } | null
  loading?: boolean
  sshSession: SSHSession
  sshForm: SSHForm
}

const props = defineProps<Props>()

const emit = defineEmits<{
  generateToken: []
  startSSHInstall: []
  cancelSSHInstall: []
  resetSession: []
  back: []
  goToBilling: []
  copyCommand: []
  'update:sshForm': [form: SSHForm]
}>()

const connectTab = ref<'quick' | 'assisted'>('quick')

const installCommand = computed(() =>
  `curl -sSL ${baseUrl}/install.sh | bash -s -- --token ${props.token} --url ${baseUrl}`
)

function handleTabChange(tab: 'quick' | 'assisted') {
  connectTab.value = tab
  if (tab === 'quick' && !props.token) {
    emit('generateToken')
  }
}

function updateSshForm<K extends keyof SSHForm>(key: K, value: SSHForm[K]) {
  emit('update:sshForm', { ...props.sshForm, [key]: value })
}

const progressSteps = [
  { name: 'Connected', icon: '🔗' },
  { name: 'Pre-flight checks', icon: '✅' },
  { name: 'Installing dependencies', icon: '📦' },
  { name: 'Configuring agent', icon: '⚙️' },
  { name: 'Starting service', icon: '🚀' }
]
</script>

<template>
  <div class="connect-panel">
    <!-- Header -->
    <div class="connect-header">
      <button class="back-btn" @click="emit('back'); emit('resetSession')">
        ← {{ t('common.back') }}
      </button>
      <h1 class="gradient-text">{{ t('infrastructure.connectServer') }}</h1>
    </div>

    <!-- Tab Navigation -->
    <div class="connect-tabs">
      <button
        :class="['tab-btn', { active: connectTab === 'quick' }]"
        @click="handleTabChange('quick')"
      >
        {{ t('infrastructure.quickInstall') }}
      </button>
      <button
        :class="['tab-btn', { active: connectTab === 'assisted' }]"
        @click="handleTabChange('assisted')"
      >
        {{ t('infrastructure.assistedInstall') }}
      </button>
    </div>

    <!-- Quick Install Tab -->
    <div v-if="connectTab === 'quick'" class="glass-card tab-content">
      <!-- Token generated -->
      <template v-if="token">
        <p class="install-desc">{{ t('infrastructure.runCommand') }}</p>
        <div class="terminal-mini" @click="emit('copyCommand')">
          <code class="code-line">
            <span class="prompt">$</span>
            {{ installCommand }}
          </code>
          <span class="copy-hint">{{ t('infrastructure.copyCommand') }}</span>
        </div>
        <div class="status-waiting">
          <div class="loader" />
          {{ t('infrastructure.connecting') }}
        </div>
        <div class="requirements">
          <span>Requirements:</span> Debian/Ubuntu, root or sudo access, internet connectivity
        </div>
      </template>

      <!-- Limit reached error -->
      <template v-else-if="tokenError">
        <div class="limit-error">
          <div class="error-icon">🚫</div>
          <h3>{{ t('errors.limitExceeded') }}</h3>
          <p>{{ tokenError.message }}</p>
          <button class="premium-btn" @click="emit('goToBilling')">
            {{ t('billing.upgrade') }}
          </button>
        </div>
      </template>

      <!-- Loading -->
      <template v-else-if="loading">
        <div class="status-waiting">
          <div class="loader" />
          {{ t('common.loading') }}
        </div>
      </template>

      <!-- Initial state -->
      <template v-else>
        <div class="status-waiting">
          <button class="premium-btn" @click="emit('generateToken')">
            Generate Installation Token
          </button>
        </div>
      </template>
    </div>

    <!-- Assisted Setup Tab -->
    <div v-else class="glass-card tab-content">
      <!-- Limit error -->
      <div v-if="tokenError" class="limit-error">
        <div class="error-icon">🚫</div>
        <h3>{{ t('errors.serverLimitReached') }}</h3>
        <p>{{ tokenError.message }}</p>
        <button class="premium-btn" @click="emit('goToBilling')">
          {{ t('billing.upgradePlan') }}
        </button>
      </div>

      <!-- SSH Form (Idle) -->
      <div v-else-if="sshSession.status === 'idle'" class="ssh-form">
        <p class="install-desc">{{ t('infrastructure.assistedDesc') }}</p>

        <div class="form-fields">
          <div class="form-row">
            <div class="form-group flex-1">
              <label>{{ t('infrastructure.serverAddress') }}</label>
              <input
                :value="sshForm.host"
                @input="updateSshForm('host', ($event.target as HTMLInputElement).value)"
                placeholder="192.168.1.100 or hostname"
              />
            </div>
            <div class="form-group port-field">
              <label>{{ t('infrastructure.port') }}</label>
              <input
                :value="sshForm.port"
                @input="updateSshForm('port', parseInt(($event.target as HTMLInputElement).value) || 22)"
                type="number"
              />
            </div>
          </div>

          <div class="form-group">
            <label>{{ t('infrastructure.username') }}</label>
            <input
              :value="sshForm.username"
              @input="updateSshForm('username', ($event.target as HTMLInputElement).value)"
              placeholder="root"
            />
          </div>

          <div class="form-group">
            <label>{{ t('infrastructure.authentication') }}</label>
            <div class="auth-toggle">
              <button
                :class="['auth-btn', { active: sshForm.authType === 'password' }]"
                @click="updateSshForm('authType', 'password')"
              >
                {{ t('infrastructure.passwordAuth') }}
              </button>
              <button
                :class="['auth-btn', { active: sshForm.authType === 'key' }]"
                @click="updateSshForm('authType', 'key')"
              >
                {{ t('infrastructure.sshKey') }}
              </button>
            </div>
          </div>

          <div v-if="sshForm.authType === 'password'" class="form-group">
            <label>{{ t('infrastructure.passwordAuth') }}</label>
            <input
              :value="sshForm.password"
              @input="updateSshForm('password', ($event.target as HTMLInputElement).value)"
              type="password"
              :placeholder="t('infrastructure.enterPassword')"
            />
          </div>

          <div v-else class="form-group">
            <label>{{ t('infrastructure.privateKey') }}</label>
            <textarea
              :value="sshForm.privateKey"
              @input="updateSshForm('privateKey', ($event.target as HTMLTextAreaElement).value)"
              :placeholder="t('infrastructure.pastePrivateKey')"
              rows="3"
              class="key-textarea"
            />
          </div>
        </div>

        <div class="ssh-options">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="sshForm.verbose"
              @change="updateSshForm('verbose', ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ t('infrastructure.showDetailedOutput') }}</span>
          </label>
        </div>

        <button class="premium-btn full-width" @click="emit('startSSHInstall')">
          🚀 {{ t('infrastructure.startInstallation') }}
        </button>

        <div class="privacy-notice">
          🔒 Credentials are <strong>never stored</strong> - used only for this session
        </div>
      </div>

      <!-- SSH Progress -->
      <div v-else class="ssh-progress">
        <div class="progress-header">
          <h3>Installing ServerFlow Agent</h3>
          <button
            v-if="sshSession.status !== 'complete'"
            class="cancel-btn"
            @click="emit('cancelSSHInstall')"
          >
            Cancel
          </button>
        </div>

        <!-- Progress Steps -->
        <div class="progress-steps">
          <div
            v-for="(step, idx) in progressSteps"
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
                <span class="spinner" />
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
        <div class="ssh-terminal">
          <div v-for="(line, idx) in sshSession.output" :key="idx" class="terminal-line">
            {{ line }}
          </div>
          <div v-if="sshSession.output.length === 0" class="terminal-placeholder">
            Waiting for output...
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="progress-bar-container">
          <div
            class="progress-bar-fill"
            :style="{ width: ((sshSession.step / sshSession.totalSteps) * 100) + '%' }"
          />
        </div>

        <!-- Success Actions -->
        <div v-if="sshSession.status === 'complete'" class="success-actions">
          <p>✅ Your node has been successfully connected!</p>
          <button class="premium-btn" @click="emit('back'); emit('resetSession')">
            View Infrastructure
          </button>
        </div>

        <!-- Error Actions -->
        <div v-if="sshSession.status === 'error'" class="error-actions">
          <button class="secondary-btn" @click="emit('resetSession')">Try Again</button>
          <button class="secondary-btn" @click="connectTab = 'quick'; emit('generateToken')">
            Use Quick Install
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.connect-panel {
  max-width: 700px;
  margin: 0 auto;
}

.connect-header {
  margin-bottom: 24px;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 8px 0;
  margin-bottom: 8px;
  display: block;
}

.back-btn:hover {
  color: var(--primary-color);
}

.gradient-text {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
}

.connect-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  background: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.tab-btn:hover:not(.active) {
  border-color: var(--text-muted);
}

.tab-content {
  padding: 32px;
}

.install-desc {
  color: var(--text-muted);
  margin-bottom: 20px;
}

.terminal-mini {
  background: #1e1e1e;
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.code-line {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: #e5e7eb;
  word-break: break-all;
}

.prompt {
  color: var(--success-color);
  margin-right: 8px;
}

.copy-hint {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 0.7rem;
  color: var(--text-muted);
}

.status-waiting {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  color: var(--text-muted);
}

.loader {
  width: 20px;
  height: 20px;
  border: 2px solid var(--surface-border);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.requirements {
  margin-top: 16px;
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
}

.limit-error {
  text-align: center;
  padding: 24px;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.limit-error h3 {
  margin-bottom: 8px;
  color: var(--error-color);
}

.limit-error p {
  color: var(--text-muted);
  margin-bottom: 20px;
}

/* SSH Form Styles */
.form-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.flex-1 {
  flex: 1;
}

.port-field {
  width: 100px;
}

.auth-toggle {
  display: flex;
  background: var(--bg-color);
  border-radius: 8px;
  padding: 4px;
}

.auth-btn {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.auth-btn.active {
  background: var(--surface-color);
  color: var(--text-main);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.key-textarea {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  resize: vertical;
}

.ssh-options {
  margin-bottom: 20px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.full-width {
  width: 100%;
}

.privacy-notice {
  margin-top: 16px;
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
}

/* SSH Progress Styles */
.ssh-progress {
  padding: 0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.progress-header h3 {
  font-weight: 700;
}

.cancel-btn {
  padding: 8px 16px;
  background: none;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
}

.cancel-btn:hover {
  border-color: var(--error-color);
  color: var(--error-color);
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-color);
  transition: all 0.2s;
}

.progress-step.active {
  background: rgba(59, 130, 246, 0.1);
}

.progress-step.completed {
  opacity: 0.6;
}

.progress-step.error {
  background: rgba(239, 68, 68, 0.1);
}

.step-icon {
  width: 24px;
  text-align: center;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--surface-border);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.step-name {
  font-size: 0.9rem;
  font-weight: 500;
}

.status-message {
  padding: 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.status-message.connecting,
.status-message.preflight,
.status-message.installing {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
}

.status-message.complete {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
}

.status-message.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
}

.ssh-terminal {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 16px;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 16px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.terminal-line {
  color: #a1a1aa;
  line-height: 1.6;
}

.terminal-placeholder {
  color: #52525b;
  font-style: italic;
}

.progress-bar-container {
  height: 4px;
  background: var(--bg-color);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 20px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  transition: width 0.3s ease;
}

.success-actions,
.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid var(--surface-border);
}

.success-actions p {
  color: var(--success-color);
  font-weight: 600;
  margin-bottom: 12px;
}

.secondary-btn {
  padding: 10px 20px;
  background: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-main);
  cursor: pointer;
}

.secondary-btn:hover {
  border-color: var(--text-muted);
}

/* Responsive */
@media (max-width: 600px) {
  .tab-content {
    padding: 20px;
  }

  .form-row {
    flex-direction: column;
  }

  .port-field {
    width: 100%;
  }

  .progress-steps {
    gap: 8px;
  }

  .progress-step {
    padding: 10px;
  }
}
</style>
