<!--
  @file apps/dashboard/src/components/databases/DatabaseServerWizard.vue
  @description Wizard de configuration pour installer et configurer les bases de données.
  Ce composant guide l'utilisateur à travers toutes les étapes nécessaires
  pour configurer une base de données : choix du type, configuration, sécurité, backup.

  @dependencies
  - Vue 3 : Framework frontend
  - Lucide Icons : Icônes pour l'interface

  @fonctions_principales
  - selectDatabase() : Choix du type de base de données
  - configureBasic() : Configuration de base (nom, user, password)
  - configureAdvanced() : Options avancées (performance, réplication, backup)
  - startInstallation() : Lance l'installation sur le serveur
-->
<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div
      class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      <!-- Header -->
      <div
        class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Database class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">{{ t('database.wizard.title') }}</h2>
            <p class="text-sm text-white/80">{{ t('database.wizard.subtitle') }}</p>
          </div>
        </div>
        <button @click="$emit('close')" class="text-white/80 hover:text-white transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Progress Steps -->
      <div class="px-6 py-4 bg-slate-50 border-b border-slate-200">
        <div class="flex items-center justify-between">
          <template v-for="(step, index) in steps" :key="step.id">
            <div class="flex items-center gap-2">
              <div
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  currentStep > index
                    ? 'bg-green-500 text-white'
                    : currentStep === index
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200 text-slate-500',
                ]"
              >
                <Check v-if="currentStep > index" class="w-4 h-4" />
                <span v-else>{{ index + 1 }}</span>
              </div>
              <span
                :class="[
                  'text-sm font-medium hidden sm:block',
                  currentStep >= index ? 'text-slate-900' : 'text-slate-400',
                ]"
              >
                {{ step.title }}
              </span>
            </div>
            <div
              v-if="index < steps.length - 1"
              :class="['flex-1 h-0.5 mx-2', currentStep > index ? 'bg-green-500' : 'bg-slate-200']"
            />
          </template>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Step 1: Database Selection -->
        <div v-if="currentStep === 0" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('database.wizard.selection.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('database.wizard.selection.description') }}</p>
          </div>

          <div class="grid gap-4">
            <!-- PostgreSQL -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
                config.databaseType === 'postgresql'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input type="radio" v-model="config.databaseType" value="postgresql" class="sr-only" />
              <div
                class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0"
              >
                <span class="text-lg font-bold text-blue-600">PG</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">PostgreSQL</h4>
                  <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{{
                    t('database.wizard.recommended')
                  }}</span>
                </div>
                <p class="text-sm text-slate-600 mt-1">
                  {{ t('database.wizard.selection.postgresql.description') }}
                </p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Transactions ACID</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">JSON/JSONB</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Extensions</span>
                </div>
              </div>
              <div v-if="config.databaseType === 'postgresql'" class="absolute top-4 right-4">
                <CheckCircle2 class="w-5 h-5 text-blue-500" />
              </div>
            </label>

            <!-- MySQL/MariaDB -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
                config.databaseType === 'mysql'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input type="radio" v-model="config.databaseType" value="mysql" class="sr-only" />
              <div
                class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0"
              >
                <span class="text-lg font-bold text-orange-600">My</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">MySQL / MariaDB</h4>
                </div>
                <p class="text-sm text-slate-600 mt-1">
                  {{ t('database.wizard.selection.mysql.description') }}
                </p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">WordPress</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Lectures rapides</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Ecosystème PHP</span>
                </div>
              </div>
              <div v-if="config.databaseType === 'mysql'" class="absolute top-4 right-4">
                <CheckCircle2 class="w-5 h-5 text-blue-500" />
              </div>
            </label>

            <!-- Redis -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
                config.databaseType === 'redis'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input type="radio" v-model="config.databaseType" value="redis" class="sr-only" />
              <div
                class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0"
              >
                <span class="text-lg font-bold text-red-600">Rd</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">Redis</h4>
                </div>
                <p class="text-sm text-slate-600 mt-1">
                  {{ t('database.wizard.selection.redis.description') }}
                </p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Cache</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Sessions</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Queues</span>
                </div>
              </div>
              <div v-if="config.databaseType === 'redis'" class="absolute top-4 right-4">
                <CheckCircle2 class="w-5 h-5 text-blue-500" />
              </div>
            </label>

            <!-- MongoDB -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
                config.databaseType === 'mongodb'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input type="radio" v-model="config.databaseType" value="mongodb" class="sr-only" />
              <div
                class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0"
              >
                <span class="text-lg font-bold text-green-600">Mg</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">MongoDB</h4>
                </div>
                <p class="text-sm text-slate-600 mt-1">
                  {{ t('database.wizard.selection.mongodb.description') }}
                </p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Documents</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Schéma flexible</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Scalable</span>
                </div>
              </div>
              <div v-if="config.databaseType === 'mongodb'" class="absolute top-4 right-4">
                <CheckCircle2 class="w-5 h-5 text-blue-500" />
              </div>
            </label>
          </div>
        </div>

        <!-- Step 2: Server Selection -->
        <div v-if="currentStep === 1" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('database.wizard.server.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('database.wizard.server.description') }}</p>
          </div>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">{{
              t('database.wizard.server.selectServer')
            }}</span>
            <select
              v-model="config.serverId"
              class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{{ t('database.wizard.server.choose') }}</option>
              <option v-for="server in availableServers" :key="server.id" :value="server.id">
                {{ server.alias || server.hostname }} ({{ server.ip }})
              </option>
            </select>
          </label>

          <div v-if="config.serverId" class="p-4 bg-blue-50 rounded-xl">
            <h4 class="font-medium text-blue-900 mb-2">
              {{ t('database.wizard.server.whatWillBeInstalled') }}
            </h4>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-4 h-4 text-green-500" />
                <span class="text-sm text-slate-700">{{ selectedDatabaseName }} Server</span>
              </div>
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-4 h-4 text-green-500" />
                <span class="text-sm text-slate-700">{{ t('database.wizard.server.clientTools') }}</span>
              </div>
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-4 h-4 text-green-500" />
                <span class="text-sm text-slate-700">{{ t('database.wizard.server.securityConfig') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Basic Configuration -->
        <div v-if="currentStep === 2" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('database.wizard.config.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('database.wizard.config.description') }}</p>
          </div>

          <!-- For Redis, we don't need a database name -->
          <div v-if="config.databaseType !== 'redis'" class="space-y-4">
            <label class="block">
              <span class="text-sm font-medium text-slate-700">{{ t('database.wizard.config.dbName') }} *</span>
              <input
                v-model="config.basic.databaseName"
                type="text"
                placeholder="app_db"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="mt-1 text-xs text-slate-500">{{ t('database.wizard.config.dbNameHint') }}</p>
            </label>

            <label class="block">
              <span class="text-sm font-medium text-slate-700">{{ t('database.wizard.config.username') }} *</span>
              <input
                v-model="config.basic.username"
                type="text"
                :placeholder="config.basic.databaseName ? `${config.basic.databaseName}_user` : 'app_user'"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="mt-1 text-xs text-slate-500">{{ t('database.wizard.config.usernameHint') }}</p>
            </label>
          </div>

          <!-- Redis-specific config -->
          <div v-if="config.databaseType === 'redis'" class="space-y-4">
            <label class="block">
              <span class="text-sm font-medium text-slate-700">{{ t('database.wizard.config.usage') }}</span>
              <select
                v-model="config.basic.redisUsage"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="cache">{{ t('database.wizard.config.usageCache') }}</option>
                <option value="sessions">{{ t('database.wizard.config.usageSessions') }}</option>
                <option value="queue">{{ t('database.wizard.config.usageQueue') }}</option>
                <option value="general">{{ t('database.wizard.config.usageGeneral') }}</option>
              </select>
            </label>
          </div>

          <!-- Password info -->
          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div class="flex items-start gap-3">
              <Lock class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-emerald-900">{{ t('database.wizard.config.passwordAuto') }}</h4>
                <p class="text-sm text-emerald-700 mt-1">{{ t('database.wizard.config.passwordAutoDesc') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Security Configuration -->
        <div v-if="currentStep === 3" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('database.wizard.security.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('database.wizard.security.description') }}</p>
          </div>

          <!-- Auto-configured security -->
          <div class="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div class="flex items-center gap-2 mb-3">
              <ShieldCheck class="w-5 h-5 text-green-600" />
              <h4 class="font-medium text-green-900">{{ t('database.wizard.security.autoConfig') }}</h4>
            </div>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Check class="w-4 h-4 text-green-600" />
                <span class="text-sm text-green-800">{{ t('database.wizard.security.bindLocalhost') }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Check class="w-4 h-4 text-green-600" />
                <span class="text-sm text-green-800">{{ t('database.wizard.security.strongPassword') }}</span>
              </div>
              <div v-if="config.databaseType === 'mysql'" class="flex items-center gap-2">
                <Check class="w-4 h-4 text-green-600" />
                <span class="text-sm text-green-800">{{ t('database.wizard.security.removeAnonymous') }}</span>
              </div>
              <div v-if="config.databaseType === 'mysql'" class="flex items-center gap-2">
                <Check class="w-4 h-4 text-green-600" />
                <span class="text-sm text-green-800">{{ t('database.wizard.security.disableRemoteRoot') }}</span>
              </div>
              <div v-if="config.databaseType === 'postgresql'" class="flex items-center gap-2">
                <Check class="w-4 h-4 text-green-600" />
                <span class="text-sm text-green-800">{{ t('database.wizard.security.scramAuth') }}</span>
              </div>
              <div v-if="config.databaseType === 'redis'" class="flex items-center gap-2">
                <Check class="w-4 h-4 text-green-600" />
                <span class="text-sm text-green-800">{{ t('database.wizard.security.protectedMode') }}</span>
              </div>
            </div>
          </div>

          <!-- Optional security settings - TLS (Coming Soon) -->
          <div class="p-4 border border-slate-200 rounded-xl space-y-4 opacity-60">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Lock class="w-5 h-5 text-slate-400" />
                <h4 class="font-medium text-slate-900">{{ t('database.wizard.security.tlsTitle') }}</h4>
                <span class="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                  Coming Soon
                </span>
              </div>
              <label class="relative inline-flex items-center cursor-not-allowed">
                <input
                  type="checkbox"
                  disabled
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-slate-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5"
                ></div>
              </label>
            </div>
            <p class="text-sm text-slate-400">{{ t('database.wizard.security.tlsDesc') }}</p>
          </div>
        </div>

        <!-- Step 5: Advanced Options (Accordion) -->
        <div v-if="currentStep === 4" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('database.wizard.advanced.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('database.wizard.advanced.description') }}</p>
          </div>

          <!-- Backup Accordion -->
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <button
              @click="toggleAccordion('backup')"
              class="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-left"
            >
              <div class="flex items-center gap-3">
                <HardDrive class="w-5 h-5 text-slate-600" />
                <span class="font-medium text-slate-900">{{ t('database.wizard.advanced.backup.title') }}</span>
                <span v-if="config.advanced.backup.enabled" class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                  {{ t('common.enabled') }}
                </span>
              </div>
              <ChevronDown :class="['w-5 h-5 text-slate-400 transition-transform', { 'rotate-180': accordionOpen.backup }]" />
            </button>
            <div v-show="accordionOpen.backup" class="p-4 space-y-4">
              <label class="flex items-center gap-2">
                <input type="checkbox" v-model="config.advanced.backup.enabled" class="rounded text-blue-500" />
                <span class="text-sm text-slate-700">{{ t('database.wizard.advanced.backup.enable') }}</span>
              </label>
              <div v-if="config.advanced.backup.enabled" class="space-y-4 ml-6">
                <div class="grid grid-cols-2 gap-4">
                  <label class="block">
                    <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.backup.schedule') }}</span>
                    <select v-model="config.advanced.backup.schedule" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="daily">{{ t('database.wizard.advanced.backup.daily') }}</option>
                      <option value="weekly">{{ t('database.wizard.advanced.backup.weekly') }}</option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.backup.retention') }}</span>
                    <select v-model="config.advanced.backup.retentionDays" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option :value="7">7 {{ t('common.days') }}</option>
                      <option :value="14">14 {{ t('common.days') }}</option>
                      <option :value="30">30 {{ t('common.days') }}</option>
                    </select>
                  </label>
                </div>

                <!-- Outils de backup additionnels -->
                <div class="pt-4 border-t border-slate-200">
                  <BackupToolsSelector
                    v-model="config.advanced.backup.toolsToInstall"
                    :tools-status="backupToolsStatus"
                    :show-header="true"
                    :show-all-installed-message="true"
                    :show-cloud-sync-info="true"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Performance Accordion -->
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <button
              @click="toggleAccordion('performance')"
              class="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-left"
            >
              <div class="flex items-center gap-3">
                <Gauge class="w-5 h-5 text-slate-600" />
                <span class="font-medium text-slate-900">{{ t('database.wizard.advanced.performance.title') }}</span>
              </div>
              <ChevronDown :class="['w-5 h-5 text-slate-400 transition-transform', { 'rotate-180': accordionOpen.performance }]" />
            </button>
            <div v-show="accordionOpen.performance" class="p-4 space-y-4">
              <!-- Server RAM Info -->
              <div v-if="serverRam" class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div class="flex items-center gap-2">
                  <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span class="text-sm text-blue-700">
                    {{ t('database.wizard.advanced.performance.serverRam') }}: <strong>{{ serverRam }}</strong>
                  </span>
                </div>
              </div>

              <!-- Performance Preset Selector -->
              <div class="space-y-3">
                <label class="text-sm font-medium text-slate-700">{{ t('database.wizard.advanced.performance.presetLabel') }}</label>
                <div class="grid grid-cols-2 gap-2">
                  <!-- Auto (Recommended) -->
                  <button
                    type="button"
                    @click="applyPerformancePreset('auto')"
                    :class="[
                      'p-3 border rounded-lg text-left transition-all',
                      performancePreset === 'auto'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-slate-200 hover:border-slate-300'
                    ]"
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetAuto') }}</span>
                      <span class="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">{{ t('common.recommended') }}</span>
                    </div>
                    <p class="text-xs text-slate-500">{{ autoPresetDescription }}</p>
                  </button>

                  <!-- Light -->
                  <button
                    type="button"
                    @click="applyPerformancePreset('light')"
                    :class="[
                      'p-3 border rounded-lg text-left transition-all',
                      performancePreset === 'light'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-slate-200 hover:border-slate-300'
                    ]"
                  >
                    <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetLight') }}</span>
                    <p class="text-xs text-slate-500">50 conn. / 256MB cache</p>
                  </button>

                  <!-- Standard -->
                  <button
                    type="button"
                    @click="applyPerformancePreset('standard')"
                    :class="[
                      'p-3 border rounded-lg text-left transition-all',
                      performancePreset === 'standard'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-slate-200 hover:border-slate-300'
                    ]"
                  >
                    <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetStandard') }}</span>
                    <p class="text-xs text-slate-500">100 conn. / {{ recommendedValues.standard.sharedBuffers }} cache</p>
                  </button>

                  <!-- Performance -->
                  <button
                    type="button"
                    @click="applyPerformancePreset('performance')"
                    :class="[
                      'p-3 border rounded-lg text-left transition-all',
                      performancePreset === 'performance'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-slate-200 hover:border-slate-300'
                    ]"
                  >
                    <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetPerformance') }}</span>
                    <p class="text-xs text-slate-500">{{ recommendedValues.performance.maxConnections }} conn. / {{ recommendedValues.performance.sharedBuffers }} cache</p>
                  </button>
                </div>

                <!-- Custom toggle -->
                <button
                  type="button"
                  @click="applyPerformancePreset('custom')"
                  :class="[
                    'w-full p-3 border rounded-lg text-left transition-all',
                    performancePreset === 'custom'
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 hover:border-slate-300'
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetCustom') }}</span>
                  </div>
                </button>
              </div>

              <!-- Custom configuration (shown when preset is 'custom') -->
              <div v-if="performancePreset === 'custom'" class="pt-4 border-t border-slate-200 space-y-4">
                <!-- PostgreSQL Performance -->
                <template v-if="config.databaseType === 'postgresql'">
                  <label class="block">
                    <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.maxConnections') }}</span>
                    <input type="number" v-model.number="config.advanced.performance.maxConnections" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </label>
                  <label class="block">
                    <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.sharedBuffers') }}</span>
                    <select v-model="config.advanced.performance.sharedBuffers" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="128MB">128 MB</option>
                      <option value="256MB">256 MB</option>
                      <option value="512MB">512 MB</option>
                      <option value="1GB">1 GB</option>
                      <option value="2GB">2 GB</option>
                      <option value="4GB">4 GB</option>
                    </select>
                  </label>
                </template>
                <!-- MySQL Performance -->
                <template v-if="config.databaseType === 'mysql'">
                  <label class="block">
                    <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.maxConnections') }}</span>
                    <input type="number" v-model.number="config.advanced.performance.maxConnections" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </label>
                  <label class="block">
                    <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.innodbBuffer') }}</span>
                    <select v-model="config.advanced.performance.innodbBufferPoolSize" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="128M">128 MB</option>
                      <option value="256M">256 MB</option>
                      <option value="512M">512 MB</option>
                      <option value="1G">1 GB</option>
                      <option value="2G">2 GB</option>
                      <option value="4G">4 GB</option>
                    </select>
                  </label>
                </template>
                <!-- Redis Performance -->
                <template v-if="config.databaseType === 'redis'">
                  <label class="block">
                    <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.maxMemory') }}</span>
                    <select v-model="config.advanced.performance.maxMemory" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="64mb">64 MB</option>
                      <option value="128mb">128 MB</option>
                      <option value="256mb">256 MB</option>
                      <option value="512mb">512 MB</option>
                      <option value="1gb">1 GB</option>
                      <option value="2gb">2 GB</option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.evictionPolicy') }}</span>
                    <select v-model="config.advanced.performance.maxmemoryPolicy" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="allkeys-lru">allkeys-lru ({{ t('database.wizard.advanced.performance.lruAll') }})</option>
                      <option value="volatile-lru">volatile-lru ({{ t('database.wizard.advanced.performance.lruExpire') }})</option>
                      <option value="noeviction">noeviction ({{ t('database.wizard.advanced.performance.noEviction') }})</option>
                    </select>
                  </label>
                </template>
                <!-- MongoDB Performance -->
                <template v-if="config.databaseType === 'mongodb'">
                  <label class="block">
                    <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.cacheSizeGB') }}</span>
                    <select v-model="config.advanced.performance.wiredTigerCacheSizeGB" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="0.25">0.25 GB</option>
                      <option value="0.5">0.5 GB</option>
                      <option value="1">1 GB</option>
                      <option value="2">2 GB</option>
                      <option value="4">4 GB</option>
                    </select>
                  </label>
                </template>
              </div>

              <!-- Current values summary (shown when not custom) -->
              <div v-else class="p-3 bg-slate-50 rounded-lg">
                <p class="text-xs text-slate-500 mb-2">{{ t('database.wizard.advanced.performance.appliedValues') }}:</p>
                <div class="flex flex-wrap gap-2">
                  <span class="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                    {{ config.advanced.performance.maxConnections }} {{ t('database.wizard.advanced.performance.connections') }}
                  </span>
                  <span v-if="config.databaseType === 'postgresql'" class="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                    {{ config.advanced.performance.sharedBuffers }} cache
                  </span>
                  <span v-if="config.databaseType === 'mysql'" class="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                    {{ config.advanced.performance.innodbBufferPoolSize }} buffer
                  </span>
                  <span v-if="config.databaseType === 'redis'" class="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                    {{ config.advanced.performance.maxMemory }} max
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Replication Accordion (Coming Soon) -->
          <div class="border border-slate-200 rounded-xl overflow-hidden opacity-60">
            <div class="w-full px-4 py-3 bg-slate-50 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Network class="w-5 h-5 text-slate-600" />
                <span class="font-medium text-slate-900">{{ t('database.wizard.advanced.replication.title') }}</span>
                <span class="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">{{ t('common.comingSoon') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 6: Summary -->
        <div v-if="currentStep === 5" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('database.wizard.summary.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('database.wizard.summary.description') }}</p>
          </div>

          <!-- Summary Card -->
          <div class="p-4 bg-slate-50 rounded-xl space-y-4">
            <div class="flex items-center gap-3">
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center"
                :class="getDatabaseColorClass()"
              >
                <span class="text-lg font-bold">{{ getDatabaseIcon() }}</span>
              </div>
              <div>
                <h4 class="font-semibold text-slate-900">{{ selectedDatabaseName }}</h4>
                <p class="text-sm text-slate-500">{{ getServerName() }}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div v-if="config.databaseType !== 'redis'">
                <span class="text-xs text-slate-500 uppercase">{{ t('database.wizard.summary.database') }}</span>
                <p class="font-medium text-slate-900">{{ config.basic.databaseName || 'app_db' }}</p>
              </div>
              <div v-if="config.databaseType !== 'redis'">
                <span class="text-xs text-slate-500 uppercase">{{ t('database.wizard.summary.user') }}</span>
                <p class="font-medium text-slate-900">{{ config.basic.username || `${config.basic.databaseName}_user` }}</p>
              </div>
              <div v-if="config.databaseType === 'redis'">
                <span class="text-xs text-slate-500 uppercase">{{ t('database.wizard.summary.usage') }}</span>
                <p class="font-medium text-slate-900">{{ getRedisUsageLabel() }}</p>
              </div>
              <div>
                <span class="text-xs text-slate-500 uppercase">{{ t('database.wizard.summary.backup') }}</span>
                <p class="font-medium text-slate-900">{{ config.advanced.backup.enabled ? t('common.enabled') : t('common.disabled') }}</p>
              </div>
            </div>
          </div>

          <!-- Security reminder -->
          <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div class="flex items-start gap-3">
              <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-amber-900">{{ t('database.wizard.summary.credentialsReminder') }}</h4>
                <p class="text-sm text-amber-700 mt-1">{{ t('database.wizard.summary.credentialsReminderDesc') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 7: Installation -->
        <div v-if="currentStep === 6" class="space-y-6">
          <div v-if="!installComplete">
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('database.wizard.install.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('database.wizard.install.description') }}</p>
          </div>

          <!-- Installation Progress -->
          <div v-if="installing" class="space-y-4">
            <div
              v-for="step in installationSteps"
              :key="step.id"
              class="flex items-center gap-3 p-3 rounded-lg"
              :class="{
                'bg-blue-50': step.status === 'running',
                'bg-green-50': step.status === 'complete',
                'bg-red-50': step.status === 'error',
              }"
            >
              <div
                v-if="step.status === 'pending'"
                class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center"
              >
                <span class="text-xs text-slate-500">{{ installationSteps.indexOf(step) + 1 }}</span>
              </div>
              <Loader2
                v-else-if="step.status === 'running'"
                class="w-6 h-6 text-blue-500 animate-spin"
              />
              <CheckCircle2
                v-else-if="step.status === 'complete'"
                class="w-6 h-6 text-green-500"
              />
              <XCircle v-else-if="step.status === 'error'" class="w-6 h-6 text-red-500" />
              <div class="flex-1">
                <span
                  :class="[
                    'text-sm font-medium',
                    step.status === 'running' ? 'text-blue-600' : 'text-slate-700',
                  ]"
                >
                  {{ step.name }}
                </span>
                <p v-if="step.message" class="text-xs text-slate-500">{{ step.message }}</p>
              </div>
            </div>

            <!-- Live Console Logs -->
            <div class="mt-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-slate-700">Console</span>
                <span class="text-xs text-slate-500">{{ installationLogs?.length || 0 }} lignes</span>
              </div>
              <div
                ref="logsContainer"
                class="bg-slate-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs"
              >
                <div
                  v-for="(log, i) in installationLogs"
                  :key="i"
                  :class="[
                    'whitespace-pre-wrap',
                    log.stream === 'stderr' ? 'text-red-400' : 'text-green-400',
                  ]"
                >
                  {{ log.message }}
                </div>
                <div v-if="!installationLogs?.length" class="text-slate-500 italic">
                  {{ t('database.wizard.install.waitingLogs') }}
                </div>
              </div>
            </div>
          </div>

          <!-- Installation Complete -->
          <div v-if="installComplete" class="text-center py-8">
            <div
              class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 class="w-8 h-8 text-green-600" />
            </div>
            <h4 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('database.wizard.install.complete') }}
            </h4>
            <p class="text-sm text-slate-600 mb-4">{{ t('database.wizard.install.completeDesc') }}</p>

            <!-- Connection String -->
            <div v-if="connectionString" class="p-4 bg-slate-100 rounded-xl text-left mb-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-slate-700">{{ t('database.wizard.install.connectionString') }}</span>
                <button @click="copyConnectionString" class="text-blue-500 hover:text-blue-600">
                  <Copy class="w-4 h-4" />
                </button>
              </div>
              <code class="text-xs text-slate-600 break-all">{{ connectionString }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between"
      >
        <button
          v-if="currentStep > 0 && !installing"
          @click="previousStep"
          class="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium flex items-center gap-2"
        >
          <ChevronLeft class="w-4 h-4" />
          {{ t('common.back') }}
        </button>
        <div v-else></div>

        <div class="flex items-center gap-3">
          <button
            v-if="currentStep < steps.length - 1"
            @click="nextStep"
            :disabled="!canProceed"
            class="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            {{ t('common.next') }}
            <ChevronRight class="w-4 h-4" />
          </button>
          <button
            v-else-if="!installing && !installComplete"
            @click="startInstallation"
            class="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            <Play class="w-4 h-4" />
            {{ t('database.wizard.install.start') }}
          </button>
          <button
            v-else-if="installComplete"
            @click="$emit('close')"
            class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            {{ t('common.done') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Database,
  X,
  Check,
  CheckCircle2,
  XCircle,
  Lock,
  ShieldCheck,
  HardDrive,
  Gauge,
  Network,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Loader2,
  Copy,
  AlertTriangle,
} from 'lucide-vue-next';
import { BackupToolsSelector } from '../shared';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'complete', config: any): void;
  (e: 'configureDatabaseStack', serverId: string, config: any): void;
}>();

const props = defineProps<{
  servers: Array<{
    id: string;
    hostname: string;
    ip: string;
    alias?: string;
    online: boolean;
  }>;
  /** Statut des outils de backup sur le serveur sélectionné */
  backupToolsStatus?: {
    rsync: boolean;
    rclone: boolean;
    restic: boolean;
  };
  /** RAM du serveur (ex: "4 GB", "8 GB") */
  serverRam?: string;
  installationLogs?: Array<{ message: string; stream: 'stdout' | 'stderr' }>;
  installationResult?: { success: boolean; connectionString?: string; error?: string } | null;
}>();

// Performance preset
type PerformancePreset = 'auto' | 'light' | 'standard' | 'performance' | 'custom';
const performancePreset = ref<PerformancePreset>('auto');

// Parse RAM from string like "4 GB" or "8192 MB" to GB
const serverRamGB = computed(() => {
  if (!props.serverRam) return 4; // Default 4GB
  const match = props.serverRam.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
  if (!match) return 4;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'TB') return value * 1024;
  if (unit === 'MB') return value / 1024;
  return value;
});

// Recommended values based on RAM
const recommendedValues = computed(() => {
  const ram = serverRamGB.value;

  // PostgreSQL: shared_buffers = 25% RAM, max_connections based on RAM
  // MySQL: innodb_buffer_pool_size = 50-70% RAM
  // Redis: maxmemory = 25% RAM for cache

  const presets = {
    light: {
      maxConnections: 50,
      sharedBuffers: '256MB',
      innodbBufferPoolSize: '256M',
      maxMemory: '128mb',
      wiredTigerCacheSizeGB: '0.5',
    },
    standard: {
      maxConnections: 100,
      sharedBuffers: ram >= 8 ? '1GB' : ram >= 4 ? '512MB' : '256MB',
      innodbBufferPoolSize: ram >= 8 ? '1G' : ram >= 4 ? '512M' : '256M',
      maxMemory: ram >= 8 ? '512mb' : ram >= 4 ? '256mb' : '128mb',
      wiredTigerCacheSizeGB: ram >= 8 ? '2' : ram >= 4 ? '1' : '0.5',
    },
    performance: {
      maxConnections: ram >= 16 ? 300 : ram >= 8 ? 200 : 150,
      sharedBuffers: ram >= 16 ? '4GB' : ram >= 8 ? '2GB' : '1GB',
      innodbBufferPoolSize: ram >= 16 ? '4G' : ram >= 8 ? '2G' : '1G',
      maxMemory: ram >= 16 ? '2gb' : ram >= 8 ? '1gb' : '512mb',
      wiredTigerCacheSizeGB: ram >= 16 ? '4' : ram >= 8 ? '2' : '1',
    },
    auto: {
      // Auto = standard optimisé pour la RAM
      maxConnections: Math.min(Math.floor(ram * 25), 300),
      sharedBuffers: ram >= 16 ? '4GB' : ram >= 8 ? '2GB' : ram >= 4 ? '1GB' : '512MB',
      innodbBufferPoolSize: ram >= 16 ? '4G' : ram >= 8 ? '2G' : ram >= 4 ? '1G' : '512M',
      maxMemory: ram >= 16 ? '2gb' : ram >= 8 ? '1gb' : ram >= 4 ? '512mb' : '256mb',
      wiredTigerCacheSizeGB: String(Math.min(Math.floor(ram * 0.25), 4)),
    },
  };

  return presets;
});

// Auto description based on server RAM
const autoPresetDescription = computed(() => {
  const ram = serverRamGB.value;
  const v = recommendedValues.value.auto;
  return `${v.maxConnections} conn. / ${v.sharedBuffers} cache`;
});

// Apply preset when changed
function applyPerformancePreset(preset: PerformancePreset) {
  performancePreset.value = preset;
  if (preset === 'custom') return; // Don't change values for custom

  const values = recommendedValues.value[preset];
  config.value.advanced.performance.maxConnections = values.maxConnections;
  config.value.advanced.performance.sharedBuffers = values.sharedBuffers;
  config.value.advanced.performance.innodbBufferPoolSize = values.innodbBufferPoolSize;
  config.value.advanced.performance.maxMemory = values.maxMemory;
  config.value.advanced.performance.wiredTigerCacheSizeGB = values.wiredTigerCacheSizeGB;
}

// Current step
const currentStep = ref(0);

// Steps definition
const steps = [
  { id: 'selection', title: 'Type' },
  { id: 'server', title: 'Serveur' },
  { id: 'config', title: 'Configuration' },
  { id: 'security', title: 'Sécurité' },
  { id: 'advanced', title: 'Avancé' },
  { id: 'summary', title: 'Résumé' },
  { id: 'install', title: 'Installation' },
];

// Configuration
const config = ref({
  databaseType: 'postgresql' as 'postgresql' | 'mysql' | 'redis' | 'mongodb',
  serverId: '',
  basic: {
    databaseName: '',
    username: '',
    redisUsage: 'cache' as 'cache' | 'sessions' | 'queue' | 'general',
  },
  security: {
    enableTls: false,
    bindLocalhost: true, // Always true by default
    setRootPassword: true,
    removeAnonymousUsers: true,
    disableRemoteRoot: true,
    removeTestDb: true,
    configureHba: true,
    enableProtectedMode: true,
  },
  advanced: {
    backup: {
      enabled: true,
      schedule: 'daily' as 'daily' | 'weekly',
      retentionDays: 7,
      toolsToInstall: [] as string[],
    },
    performance: {
      maxConnections: 100,
      sharedBuffers: '256MB',
      innodbBufferPoolSize: '256M',
      maxMemory: '256mb',
      maxmemoryPolicy: 'allkeys-lru',
      wiredTigerCacheSizeGB: '1',
    },
    replication: {
      enabled: false,
      role: 'primary' as 'primary' | 'replica',
    },
  },
});

// Accordion state
const accordionOpen = ref({
  backup: false,
  performance: false,
  replication: false,
});

// Installation state
const installing = ref(false);
const installComplete = ref(false);
const connectionString = ref('');
const installationSteps = ref<
  Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    message?: string;
  }>
>([]);

// Logs container ref for auto-scroll
const logsContainer = ref<HTMLElement | null>(null);

// Computed
const availableServers = computed(() => props.servers.filter((s) => s.online));

const backupToolsStatus = computed(() => props.backupToolsStatus ?? {
  rsync: false,
  rclone: false,
  restic: false,
});

const selectedDatabaseName = computed(() => {
  const names: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL / MariaDB',
    redis: 'Redis',
    mongodb: 'MongoDB',
  };
  return names[config.value.databaseType] || '';
});

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0: // Database Selection
      return !!config.value.databaseType;
    case 1: // Server Selection
      return !!config.value.serverId;
    case 2: // Basic Config
      if (config.value.databaseType === 'redis') {
        return true; // Redis doesn't need a database name
      }
      return !!config.value.basic.databaseName;
    default:
      return true;
  }
});

// Methods
function toggleAccordion(section: 'backup' | 'performance' | 'replication') {
  accordionOpen.value[section] = !accordionOpen.value[section];
}

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++;
  }
}

function previousStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

function getDatabaseColorClass() {
  const colors: Record<string, string> = {
    postgresql: 'bg-blue-100 text-blue-600',
    mysql: 'bg-orange-100 text-orange-600',
    redis: 'bg-red-100 text-red-600',
    mongodb: 'bg-green-100 text-green-600',
  };
  return colors[config.value.databaseType] || 'bg-slate-100 text-slate-600';
}

function getDatabaseIcon() {
  const icons: Record<string, string> = {
    postgresql: 'PG',
    mysql: 'My',
    redis: 'Rd',
    mongodb: 'Mg',
  };
  return icons[config.value.databaseType] || 'DB';
}

function getServerName() {
  const server = props.servers.find((s) => s.id === config.value.serverId);
  return server ? (server.alias || server.hostname || server.ip) : '';
}

function getRedisUsageLabel() {
  const labels: Record<string, string> = {
    cache: t('database.wizard.config.usageCache'),
    sessions: t('database.wizard.config.usageSessions'),
    queue: t('database.wizard.config.usageQueue'),
    general: t('database.wizard.config.usageGeneral'),
  };
  return labels[config.value.basic.redisUsage] || '';
}

function copyConnectionString() {
  navigator.clipboard.writeText(connectionString.value);
}

async function startInstallation() {
  installing.value = true;

  // Build installation steps based on database type
  installationSteps.value = [
    { id: 'install', name: t('database.wizard.install.steps.installing'), status: 'running' },
    { id: 'security', name: t('database.wizard.install.steps.security'), status: 'pending' },
    { id: 'config', name: t('database.wizard.install.steps.configuring'), status: 'pending' },
    { id: 'start', name: t('database.wizard.install.steps.starting'), status: 'pending' },
  ];

  // Emit event to trigger installation via WebSocket
  emit('configureDatabaseStack', config.value.serverId, {
    type: config.value.databaseType,
    databaseName: config.value.basic.databaseName || 'app_db',
    username: config.value.basic.username || `${config.value.basic.databaseName || 'app'}_user`,
    redisUsage: config.value.basic.redisUsage,
    security: config.value.security,
    advanced: config.value.advanced,
  });
}

// Watcher for installation result
watch(
  () => props.installationResult,
  (result) => {
    if (result) {
      if (result.success) {
        installationSteps.value.forEach((step) => (step.status = 'complete'));
        installComplete.value = true;
        if (result.connectionString) {
          connectionString.value = result.connectionString;
        }
        emit('complete', config.value);
      } else {
        const runningStep = installationSteps.value.find((s) => s.status === 'running');
        if (runningStep) {
          runningStep.status = 'error';
          runningStep.message = result.error;
        }
        installing.value = false;
      }
    }
  },
);

// Watcher for auto-scroll logs
watch(
  () => props.installationLogs?.length,
  () => {
    nextTick(() => {
      if (logsContainer.value) {
        logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
      }
    });

    // Update installation steps based on logs
    if (props.installationLogs && props.installationLogs.length > 0) {
      const lastLogs = props.installationLogs.slice(-5);
      for (const log of lastLogs) {
        const msg = log.message;
        if (msg.includes('Installing') || msg.includes('apt-get install')) {
          updateStepStatus('install', 'running');
        } else if (msg.includes('Securing') || msg.includes('security')) {
          updateStepStatus('install', 'complete');
          updateStepStatus('security', 'running');
        } else if (msg.includes('Configuring') || msg.includes('configuration')) {
          updateStepStatus('security', 'complete');
          updateStepStatus('config', 'running');
        } else if (msg.includes('Starting') || msg.includes('systemctl start')) {
          updateStepStatus('config', 'complete');
          updateStepStatus('start', 'running');
        } else if (msg.includes('successfully') || msg.includes('complete')) {
          updateStepStatus('start', 'complete');
        }
      }
    }
  },
);

function updateStepStatus(stepId: string, status: 'pending' | 'running' | 'complete' | 'error') {
  const step = installationSteps.value.find((s) => s.id === stepId);
  if (step && step.status !== 'complete' && step.status !== 'error') {
    step.status = status;
  }
}
</script>
