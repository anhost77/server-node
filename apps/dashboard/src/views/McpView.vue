<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMcp, useApi } from '@/composables'

const { t } = useI18n()
const { baseUrl } = useApi()
const {
  mcpTokens,
  showNewTokenModal,
  newlyGeneratedToken,
  newTokenName,
  loadMcpTokens,
  generateMcpToken,
  revokeMcpToken,
  copyToken,
  closeTokenModal,
  copyMcpConfig
} = useMcp()

const tokenToRevoke = ref<string | null>(null)
const showRevokeModal = ref(false)

function confirmRevoke(tokenId: string) {
  tokenToRevoke.value = tokenId
  showRevokeModal.value = true
}

function handleRevoke() {
  if (tokenToRevoke.value) {
    revokeMcpToken(tokenToRevoke.value)
    showRevokeModal.value = false
    tokenToRevoke.value = null
  }
}

function cancelRevoke() {
  showRevokeModal.value = false
  tokenToRevoke.value = null
}
</script>

<template>
  <div class="mcp-view">
    <!-- Header -->
    <h1 class="gradient-text">{{ t('mcp.title') }}</h1>
    <p class="view-subtitle">{{ t('mcp.subtitle') }}</p>

    <div class="grid grid-cols-1 lg:grid-cols-1 gap-6">
      <!-- Setup Card -->
      <div class="glass-card mcp-setup-card">
        <h3 class="card-title">{{ t('mcp.quickSetup') }}</h3>
        <p class="card-desc">{{ t('mcp.setupDesc') }}</p>

        <!-- Step 1 -->
        <div class="setup-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <strong>{{ t('mcp.step1Title') }}</strong>
            <code class="config-path">~/.config/claude/claude_desktop_config.json</code>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="setup-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <strong>{{ t('mcp.step2Title') }}</strong>
            <div class="code-block">
              <pre>{
  "mcpServers": {
    "serverflow": {
      "command": "npx",
      "args": ["-y", "serverflow-mcp@latest"],
      "env": {
        "SERVERFLOW_API_KEY": "your-token-here",
        "SERVERFLOW_URL": "{{ baseUrl }}"
      }
    }
  }
}</pre>
              <button class="copy-btn" @click="copyMcpConfig">{{ t('mcp.copy') }}</button>
            </div>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="setup-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <strong>{{ t('mcp.step3Title') }}</strong>
            <span class="step-hint">{{ t('mcp.step3Hint') }}</span>
          </div>
        </div>
      </div>

      <!-- Tokens Card -->
      <div class="glass-card mcp-tokens-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">{{ t('mcp.apiTokens') }}</h3>
            <p class="card-desc">{{ t('mcp.tokensDesc') }}</p>
          </div>
          <button class="premium-btn" @click="showNewTokenModal = true; newTokenName = ''">
            {{ t('mcp.generateToken') }}
          </button>
        </div>

        <!-- Empty State -->
        <div v-if="mcpTokens.length === 0" class="empty-state">
          <div class="empty-icon">🔑</div>
          <p>{{ t('mcp.noTokens') }}</p>
        </div>

        <!-- Tokens List -->
        <div v-else class="tokens-list">
          <div v-for="token in mcpTokens" :key="token.id" class="token-item">
            <div class="token-info">
              <div class="token-key">
                <code>{{ token.prefix }}••••••••</code>
                <span class="token-name">{{ token.name }}</span>
              </div>
              <div class="token-meta">
                {{ t('mcp.created') }} {{ new Date(token.createdAt * 1000).toLocaleDateString() }}
                <template v-if="token.lastUsedAt">
                  · {{ t('mcp.lastUsed') }} {{ new Date(token.lastUsedAt * 1000).toLocaleDateString() }}
                </template>
              </div>
            </div>
            <button class="action-btn error" @click="confirmRevoke(token.id)">
              {{ t('mcp.revoke') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tools Card -->
      <div class="glass-card mcp-tools-card">
        <h3 class="card-title">{{ t('mcp.availableTools') }}</h3>
        <p class="card-desc">{{ t('mcp.toolsCount', { n: 14 }) }}</p>

        <div class="tools-grid">
          <div class="tool-item"><span class="tool-icon">📋</span><div><code>list_servers</code><span>{{ t('mcp.tools.listServers') }}</span></div></div>
          <div class="tool-item"><span class="tool-icon">📦</span><div><code>list_apps</code><span>{{ t('mcp.tools.listApps') }}</span></div></div>
          <div class="tool-item"><span class="tool-icon">🚀</span><div><code>deploy_app</code><span>{{ t('mcp.tools.deployApp') }}</span></div></div>
          <div class="tool-item"><span class="tool-icon">⚡</span><div><code>app_action</code><span>{{ t('mcp.tools.appAction') }}</span></div></div>
          <div class="tool-item"><span class="tool-icon">📊</span><div><code>get_activity_logs</code><span>{{ t('mcp.tools.getActivityLogs') }}</span></div></div>
          <div class="tool-item"><span class="tool-icon">🌐</span><div><code>provision_domain</code><span>{{ t('mcp.tools.provisionDomain') }}</span></div></div>
          <div class="tool-item"><span class="tool-icon">🔗</span><div><code>list_domains</code><span>{{ t('mcp.tools.listDomains') }}</span></div></div>
          <div class="tool-item"><span class="tool-icon">📈</span><div><code>get_server_metrics</code><span>{{ t('mcp.tools.getServerMetrics') }}</span></div></div>
          <div class="tool-item"><span class="tool-icon">💓</span><div><code>check_app_health</code><span>{{ t('mcp.tools.checkAppHealth') }}</span></div></div>
          <div class="tool-item"><span class="tool-icon">📜</span><div><code>get_deployment_history</code><span>{{ t('mcp.tools.getDeploymentHistory') }}</span></div></div>
        </div>
      </div>

      <!-- Examples Card -->
      <div class="glass-card mcp-examples-card">
        <h3 class="card-title">{{ t('mcp.examplePrompts') }}</h3>
        <p class="card-desc">{{ t('mcp.examplePromptsDesc') }}</p>

        <div class="examples-grid">
          <div class="example-item deploy">
            <span class="example-label">{{ t('mcp.examples.deploy') }}</span>
            <p>"{{ t('mcp.examples.deployText') }}"</p>
          </div>
          <div class="example-item status">
            <span class="example-label">{{ t('mcp.examples.status') }}</span>
            <p>"{{ t('mcp.examples.statusText') }}"</p>
          </div>
          <div class="example-item restart">
            <span class="example-label">{{ t('mcp.examples.restart') }}</span>
            <p>"{{ t('mcp.examples.restartText') }}"</p>
          </div>
          <div class="example-item domain">
            <span class="example-label">{{ t('mcp.examples.domain') }}</span>
            <p>"{{ t('mcp.examples.domainText') }}"</p>
          </div>
          <div class="example-item dryrun">
            <span class="example-label">{{ t('mcp.examples.dryRun') }}</span>
            <p>"{{ t('mcp.examples.dryRunText') }}"</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Generate Token Modal -->
    <div v-if="showNewTokenModal && !newlyGeneratedToken" class="modal-overlay" @click.self="showNewTokenModal = false">
      <div class="glass-card modal-card">
        <h3>{{ t('mcp.generateToken') }}</h3>
        <p class="modal-desc">This token will be shown only once. Store it securely.</p>

        <div class="form-group">
          <label>Token Name</label>
          <input v-model="newTokenName" type="text" placeholder="e.g., Claude Desktop, Cursor IDE" />
        </div>

        <div class="warning-box">
          <span>⚠️</span>
          <span>You won't be able to see this token again after closing. Make sure to copy it.</span>
        </div>

        <div class="modal-actions">
          <button class="secondary" @click="showNewTokenModal = false">{{ t('common.cancel') }}</button>
          <button class="premium-btn" @click="generateMcpToken">{{ t('mcp.generateToken') }}</button>
        </div>
      </div>
    </div>

    <!-- Token Success Modal -->
    <div v-if="showNewTokenModal && newlyGeneratedToken" class="modal-overlay" @click.self="closeTokenModal">
      <div class="glass-card modal-card success-modal">
        <div class="success-icon">✅</div>
        <h3>Token Generated!</h3>
        <p class="modal-desc">Copy this token now. It won't be shown again.</p>

        <div class="token-display">
          <code>{{ newlyGeneratedToken }}</code>
          <button class="copy-btn" @click="copyToken(newlyGeneratedToken || '')">Copy</button>
        </div>

        <div class="danger-box">
          <span>🔒</span>
          <span>Store this token in a secure location. You will not be able to retrieve it later.</span>
        </div>

        <div class="modal-actions">
          <button class="premium-btn full-width" @click="closeTokenModal">I've Copied It</button>
        </div>
      </div>
    </div>

    <!-- Revoke Confirmation Modal -->
    <div v-if="showRevokeModal" class="modal-overlay" @click.self="cancelRevoke">
      <div class="glass-card modal-card">
        <h3>{{ t('mcp.revoke') }} Token</h3>
        <p class="modal-desc">MCP connections using this token will stop working. Are you sure you want to continue?</p>

        <div class="modal-actions">
          <button class="secondary" @click="cancelRevoke">{{ t('common.cancel') }}</button>
          <button class="action-btn error" @click="handleRevoke">{{ t('mcp.revoke') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mcp-view {
  padding: 0;
}

.view-subtitle {
  color: #64748b;
  margin: 0.5rem 0 2rem;
  font-size: 0.95rem;
}

.mcp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.mcp-tools-card,
.mcp-examples-card {
  grid-column: span 2;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.5rem;
}

.card-desc {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0 0 1.5rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.card-header .card-desc {
  margin: 0;
}

/* Setup Steps */
.setup-step {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.step-number {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-content strong {
  display: block;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.step-hint {
  color: #64748b;
  font-size: 0.875rem;
}

.config-path {
  display: inline-block;
  background: #f1f5f9;
  color: #8b5cf6;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.8rem;
}

.code-block {
  position: relative;
  background: #1a1f2e;
  border-radius: 12px;
  padding: 1rem;
  margin-top: 0.5rem;
}

.code-block pre {
  color: #e2e8f0;
  font-size: 0.8rem;
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  font-family: 'Fira Code', monospace;
}

.code-block .copy-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(139, 92, 246, 0.3);
  color: #c4b5fd;
  border: none;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}

.code-block .copy-btn:hover {
  background: rgba(139, 92, 246, 0.5);
}

/* Tokens */
.empty-state {
  text-align: center;
  padding: 2rem;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #64748b;
  margin: 0;
}

.tokens-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.token-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.token-key {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.token-key code {
  color: #8b5cf6;
  font-size: 0.875rem;
}

.token-name {
  color: #0f172a;
  font-size: 0.875rem;
}

.token-meta {
  color: #94a3b8;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

/* Tools */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.tool-icon {
  font-size: 1.25rem;
}

.tool-item div {
  flex: 1;
  min-width: 0;
}

.tool-item code {
  display: block;
  font-size: 0.75rem;
  color: #0f172a;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-item span {
  display: block;
  font-size: 0.7rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Examples */
.examples-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.example-item {
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid;
}

.example-item.deploy { background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1)); border-color: rgba(139, 92, 246, 0.3); }
.example-item.status { background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(20, 184, 166, 0.1)); border-color: rgba(16, 185, 129, 0.3); }
.example-item.restart { background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(249, 115, 22, 0.1)); border-color: rgba(245, 158, 11, 0.3); }
.example-item.domain { background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(6, 182, 212, 0.1)); border-color: rgba(59, 130, 246, 0.3); }
.example-item.dryrun { background: linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(244, 63, 94, 0.1)); border-color: rgba(236, 72, 153, 0.3); }

.example-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  display: block;
}

.example-item.deploy .example-label { color: #8b5cf6; }
.example-item.status .example-label { color: #10b981; }
.example-item.restart .example-label { color: #f59e0b; }
.example-item.domain .example-label { color: #3b82f6; }
.example-item.dryrun .example-label { color: #ec4899; }

.example-item p {
  margin: 0;
  font-size: 0.875rem;
  color: #475569;
  font-style: italic;
}

/* Modals */
.modal-card {
  max-width: 450px;
  padding: 1.5rem;
}

.modal-card h3 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  color: #0f172a;
}

.modal-desc {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0 0 1.25rem;
}

.warning-box,
.danger-box {
  display: flex;
  gap: 0.75rem;
  padding: 0.875rem;
  border-radius: 10px;
  margin-bottom: 1.25rem;
  font-size: 0.8rem;
}

.warning-box {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #92400e;
}

.danger-box {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #991b1b;
}

.success-modal {
  text-align: center;
}

.success-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.token-display {
  position: relative;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.875rem;
  margin-bottom: 1rem;
}

.token-display code {
  display: block;
  color: #8b5cf6;
  font-size: 0.8rem;
  word-break: break-all;
  padding-right: 4rem;
}

.token-display .copy-btn {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  transform: translateY(-50%);
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border: none;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
}

.full-width {
  width: 100%;
}

/* Responsive */
@media (max-width: 1200px) {
  .tools-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1024px) {
  .mcp-grid {
    grid-template-columns: 1fr;
  }

  .mcp-tools-card,
  .mcp-examples-card {
    grid-column: span 1;
  }

  .tools-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .examples-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .tools-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .examples-grid {
    grid-template-columns: 1fr;
  }
}
</style>
