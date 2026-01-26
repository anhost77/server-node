<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { availableLocales, setLocale } from '@/i18n'

const { locale } = useI18n()
const showMenu = ref(false)

const currentLocale = () => availableLocales.find((l: { code: string; name: string; flag: string }) => l.code === locale.value)

function selectLanguage(code: string) {
  setLocale(code)
  showMenu.value = false
}

// Close menu when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.language-selector-wrapper')) {
    showMenu.value = false
  }
}

// Add click listener when menu opens
import { watch, onUnmounted } from 'vue'

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
  <div class="language-selector-wrapper">
    <div class="language-selector" @click.stop="showMenu = !showMenu">
      <span class="lang-flag">{{ currentLocale()?.flag }}</span>
      <span class="lang-name">{{ currentLocale()?.name }}</span>
      <span class="dropdown-arrow" :class="{ open: showMenu }">▾</span>
    </div>

    <Transition name="dropdown">
      <div v-show="showMenu" class="language-dropdown">
        <a
          v-for="lang in availableLocales"
          :key="lang.code"
          href="#"
          class="dropdown-item"
          :class="{ active: locale === lang.code }"
          @click.prevent="selectLanguage(lang.code)"
        >
          <span class="lang-flag">{{ lang.flag }}</span>
          {{ lang.name }}
        </a>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.language-selector-wrapper {
  position: relative;
}

.language-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.language-selector:hover {
  background: var(--bg-color);
}

.lang-flag {
  font-size: 1.1rem;
}

.lang-name {
  font-size: 0.85rem;
  color: var(--text-main);
}

.dropdown-arrow {
  font-size: 0.7rem;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.language-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 8px;
  background: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  color: var(--text-main);
  text-decoration: none;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--bg-color);
}

.dropdown-item.active {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
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
