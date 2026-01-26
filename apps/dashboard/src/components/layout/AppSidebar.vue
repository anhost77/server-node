<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSelector from './LanguageSelector.vue'
import UserMenu from './UserMenu.vue'
import type { User, Server } from '@/types'

const { t } = useI18n()

interface Props {
  user: User
  servers: Server[]
  activeMenu: string
  selectedServerId: string | null
  mobileOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mobileOpen: false
})

const emit = defineEmits<{
  'update:activeMenu': [menu: string]
  'update:selectedServerId': [id: string | null]
  navigate: [menu: string]
  connectServer: []
  logout: []
  closeMobile: []
}>()

// Collapsed sections state
const collapsedSections = ref<Record<string, boolean>>({
  orchestration: false,
  integrations: true,
  admin: true
})

function toggleSection(section: string) {
  collapsedSections.value[section] = !collapsedSections.value[section]
}

function handleNavClick(menu: string) {
  emit('update:activeMenu', menu)
  emit('update:selectedServerId', null)
  emit('closeMobile')
}

function handleServerClick(serverId: string) {
  emit('update:selectedServerId', serverId)
  emit('update:activeMenu', 'infrastructure')
  emit('closeMobile')
}

function handleConnectServer() {
  emit('connectServer')
  emit('closeMobile')
}

function handleUserNavigate(menu: string) {
  emit('navigate', menu)
  emit('closeMobile')
}

function handleLogout() {
  emit('logout')
}

function handleLogoClick() {
  emit('update:activeMenu', 'infrastructure')
  emit('update:selectedServerId', null)
  emit('closeMobile')
}
</script>

<template>
  <aside class="sidebar" :class="{ 'mobile-open': mobileOpen }">
    <!-- Logo -->
    <div class="logo" @click="handleLogoClick">
      <div class="logo-icon" />
      <span>ServerFlow</span>
    </div>

    <!-- ORCHESTRATION Section -->
    <div class="nav-section">
      <div class="nav-label clickable" @click="toggleSection('orchestration')">
        <span>{{ t('nav.orchestration') }}</span>
        <span class="collapse-icon" :class="{ collapsed: collapsedSections.orchestration }">▾</span>
      </div>
      <nav v-show="!collapsedSections.orchestration">
        <a
          href="#"
          :class="{ active: activeMenu === 'infrastructure' }"
          @click.prevent="handleNavClick('infrastructure')"
        >
          {{ t('nav.infrastructure') }}
        </a>
        <a
          href="#"
          :class="{ active: activeMenu === 'applications' }"
          @click.prevent="handleNavClick('applications')"
        >
          {{ t('nav.applications') }}
        </a>
        <a
          href="#"
          :class="{ active: activeMenu === 'activity' }"
          @click.prevent="handleNavClick('activity')"
        >
          {{ t('nav.activityLogs') }}
        </a>
      </nav>
    </div>

    <!-- INTEGRATIONS Section -->
    <div class="nav-section">
      <div class="nav-label clickable" @click="toggleSection('integrations')">
        <span>{{ t('nav.integrations') }}</span>
        <span class="collapse-icon" :class="{ collapsed: collapsedSections.integrations }">▾</span>
      </div>
      <nav v-show="!collapsedSections.integrations">
        <a
          href="#"
          :class="{ active: activeMenu === 'mcp' }"
          @click.prevent="handleNavClick('mcp')"
        >
          {{ t('nav.mcpTokens') }}
        </a>
      </nav>
    </div>

    <!-- ADMIN Section (conditional) -->
    <template v-if="user?.role === 'admin'">
      <div class="nav-section">
        <div class="nav-label clickable admin-label" @click="toggleSection('admin')">
          <span>{{ t('nav.admin') }}</span>
          <span class="collapse-icon" :class="{ collapsed: collapsedSections.admin }">▾</span>
        </div>
        <nav v-show="!collapsedSections.admin">
          <a
            href="#"
            :class="{ active: activeMenu === 'admin-users' }"
            @click.prevent="handleNavClick('admin-users')"
          >
            {{ t('nav.users') }}
          </a>
          <a
            href="#"
            :class="{ active: activeMenu === 'admin-plans' }"
            @click.prevent="handleNavClick('admin-plans')"
          >
            {{ t('nav.plans') }}
          </a>
          <a
            href="#"
            :class="{ active: activeMenu === 'admin-security' }"
            @click.prevent="handleNavClick('admin-security')"
          >
            {{ t('nav.security') }}
          </a>
          <a
            href="#"
            :class="{ active: activeMenu === 'admin-support' }"
            @click.prevent="handleNavClick('admin-support')"
          >
            {{ t('nav.support') }}
          </a>
          <a
            href="#"
            :class="{ active: activeMenu === 'admin-metrics' }"
            @click.prevent="handleNavClick('admin-metrics')"
          >
            {{ t('admin.metrics.title') }}
          </a>
        </nav>
      </div>
    </template>

    <!-- SERVERS Section -->
    <div class="nav-section management-section">
      <div class="nav-label">
        <span>{{ t('infrastructure.servers') }}</span>
        <span class="server-count">{{ servers.length }}</span>
      </div>
      <nav>
        <a
          href="#"
          :class="{ active: selectedServerId === 'pending' }"
          @click.prevent="handleConnectServer"
        >
          + {{ t('infrastructure.connectServer') }}
        </a>
      </nav>

      <!-- Server List -->
      <div class="server-list">
        <div
          v-for="s in servers"
          :key="s.id"
          class="server-item"
          :class="{
            selected: selectedServerId === s.id,
            online: s.status === 'online'
          }"
          @click="handleServerClick(s.id)"
        >
          <div class="status-dot" />
          <div class="node-info">
            <p>{{ s.id.slice(0, 8) }}{{ s.alias ? ` (${s.alias})` : '' }}</p>
            <span>{{ s.status }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <LanguageSelector />
      <UserMenu
        :user="user"
        @navigate="handleUserNavigate"
        @logout="handleLogout"
      />
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  background: var(--surface-color);
  border-right: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
  transition: transform 0.3s ease;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--surface-border);
}

.logo-icon {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  border-radius: 6px;
}

.logo span {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.nav-section {
  padding: 6px 0;
}

.nav-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.nav-label.clickable {
  cursor: pointer;
  transition: color 0.2s;
}

.nav-label.clickable:hover {
  color: var(--text-main);
}

.admin-label {
  color: var(--secondary-color);
}

.collapse-icon {
  font-size: 0.6rem;
  transition: transform 0.2s;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.server-count {
  background: var(--bg-color);
  padding: 1px 6px;
  border-radius: 99px;
  font-size: 0.65rem;
}

nav {
  display: flex;
  flex-direction: column;
}

nav a {
  display: block;
  padding: 6px 12px 6px 16px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.15s;
  border-left: 2px solid transparent;
}

nav a:hover {
  color: var(--text-main);
  background: var(--bg-color);
}

nav a.active {
  color: var(--primary-color);
  background: rgba(59, 130, 246, 0.08);
  border-left-color: var(--primary-color);
}

.management-section {
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid var(--surface-border);
  margin-top: 4px;
}

.server-list {
  padding: 0 6px;
}

.server-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 2px;
}

.server-item:hover {
  background: var(--bg-color);
}

.server-item.selected {
  background: rgba(59, 130, 246, 0.1);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.server-item.online .status-dot {
  background: var(--success-color);
  box-shadow: 0 0 6px var(--success-color);
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-info p {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-info span {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: capitalize;
}

.sidebar-footer {
  padding: 8px;
  border-top: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Mobile styles */
@media (max-width: 1024px) {
  .sidebar {
    transform: translateX(-100%);
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }
}
</style>
