<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { User } from '@/types'

const { t } = useI18n()

interface Props {
  user: User
}

defineProps<Props>()

const emit = defineEmits<{
  navigate: [menu: string]
  logout: []
}>()

const showMenu = ref(false)

function handleNavigation(menu: string) {
  emit('navigate', menu)
  showMenu.value = false
}

function handleLogout() {
  emit('logout')
  showMenu.value = false
}

// Close menu when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.user-profile-wrapper')) {
    showMenu.value = false
  }
}

watch(showMenu, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', handleClickOutside)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="user-profile-wrapper">
    <div class="user-profile" @click.stop="showMenu = !showMenu">
      <div
        class="avatar-mini"
        :style="{ backgroundImage: user.avatarUrl ? `url(${user.avatarUrl})` : '' }"
      />
      <div class="user-info">
        <p>{{ user.name || 'User' }}</p>
        <span class="user-email">{{ user.email }}</span>
      </div>
      <span class="dropdown-arrow" :class="{ open: showMenu }">▾</span>
    </div>

    <Transition name="dropdown">
      <div v-show="showMenu" class="user-dropdown">
        <a href="#" class="dropdown-item" @click.prevent="handleNavigation('billing')">
          <span class="dropdown-icon">💳</span>
          {{ t('nav.billing') }}
        </a>
        <a href="#" class="dropdown-item" @click.prevent="handleNavigation('support')">
          <span class="dropdown-icon">🎫</span>
          {{ t('nav.support') }}
        </a>
        <a href="#" class="dropdown-item" @click.prevent="handleNavigation('settings')">
          <span class="dropdown-icon">⚙️</span>
          {{ t('common.settings') }}
        </a>
        <div class="dropdown-divider" />
        <a href="#" class="dropdown-item logout-item" @click.prevent="handleLogout">
          <span class="dropdown-icon">🚪</span>
          {{ t('common.logout') }}
        </a>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.user-profile-wrapper {
  position: relative;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-profile:hover {
  background: var(--bg-color);
}

.avatar-mini {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-info p {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-arrow {
  font-size: 0.7rem;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.user-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 8px;
  background: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  color: var(--text-main);
  text-decoration: none;
  font-size: 0.9rem;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--bg-color);
}

.dropdown-icon {
  font-size: 1rem;
  width: 20px;
  text-align: center;
}

.dropdown-divider {
  height: 1px;
  background: var(--surface-border);
  margin: 4px 0;
}

.logout-item {
  color: var(--error-color);
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
