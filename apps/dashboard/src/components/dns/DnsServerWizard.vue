<!--
  @file apps/dashboard/src/components/dns/DnsServerWizard.vue
  @description Wizard de configuration pour installer un serveur DNS BIND9.
  Ce composant guide l'utilisateur à travers toutes les étapes nécessaires
  pour configurer un serveur DNS : architecture, zones, sécurité, records.

  @dependencies
  - Vue 3 : Framework frontend
  - Lucide Icons : Icônes pour l'interface
  - vue-i18n : Internationalisation

  @fonctions_principales
  - selectArchitecture() : Choix de l'architecture (primaire/secondaire/cache/split)
  - configureZones() : Configuration des zones DNS
  - configureSecurity() : Options de sécurité (DNSSEC, TSIG, RRL)
  - startInstallation() : Lance l'installation sur le serveur
-->
<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div
      class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      <!-- Header -->
      <div
        class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-500 to-indigo-600"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Globe class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">{{ t('dns.wizard.title') }}</h2>
            <p class="text-sm text-white/80">{{ t('dns.wizard.subtitle') }}</p>
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
                      ? 'bg-indigo-500 text-white'
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
        <!-- Step 1: Architecture -->
        <div v-if="currentStep === 0" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('dns.wizard.architecture.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('dns.wizard.architecture.description') }}</p>
          </div>

          <div class="grid gap-4">
            <!-- Primary Authoritative (Recommended) -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
                config.architecture === 'primary'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input type="radio" v-model="config.architecture" value="primary" class="sr-only" />
              <div
                class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0"
              >
                <Server class="w-6 h-6 text-blue-600" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">
                    {{ t('dns.wizard.architecture.primary.title') }}
                  </h4>
                  <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{{
                    t('dns.wizard.recommended')
                  }}</span>
                </div>
                <p class="text-sm text-slate-600 mt-1">
                  {{ t('dns.wizard.architecture.primary.description') }}
                </p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">1 serveur</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Simple</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">PME</span>
                </div>
              </div>
              <div v-if="config.architecture === 'primary'" class="absolute top-4 right-4">
                <CheckCircle2 class="w-5 h-5 text-indigo-500" />
              </div>
            </label>

            <!-- Primary + Secondary -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl transition-all',
                availableServers.length < 2 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                config.architecture === 'primary-secondary'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input
                type="radio"
                v-model="config.architecture"
                value="primary-secondary"
                class="sr-only"
                :disabled="availableServers.length < 2"
              />
              <div
                class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0"
              >
                <Network class="w-6 h-6 text-purple-600" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">
                    {{ t('dns.wizard.architecture.primarySecondary.title') }}
                  </h4>
                  <span
                    v-if="availableServers.length < 2"
                    class="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full"
                  >
                    {{ t('dns.wizard.requires2Servers') }}
                  </span>
                </div>
                <p class="text-sm text-slate-600 mt-1">
                  {{ t('dns.wizard.architecture.primarySecondary.description') }}
                </p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">2 serveurs</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Redondance</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Entreprise</span>
                </div>
              </div>
              <div v-if="config.architecture === 'primary-secondary'" class="absolute top-4 right-4">
                <CheckCircle2 class="w-5 h-5 text-indigo-500" />
              </div>
            </label>

            <!-- Cache/Recursive -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
                config.architecture === 'cache'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input type="radio" v-model="config.architecture" value="cache" class="sr-only" />
              <div
                class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0"
              >
                <Database class="w-6 h-6 text-emerald-600" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">
                    {{ t('dns.wizard.architecture.cache.title') }}
                  </h4>
                </div>
                <p class="text-sm text-slate-600 mt-1">
                  {{ t('dns.wizard.architecture.cache.description') }}
                </p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">1 serveur</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Cache local</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Réseau interne</span>
                </div>
              </div>
              <div v-if="config.architecture === 'cache'" class="absolute top-4 right-4">
                <CheckCircle2 class="w-5 h-5 text-indigo-500" />
              </div>
            </label>

            <!-- Split-Horizon (Coming Soon) -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-not-allowed transition-all opacity-60',
                'border-slate-200',
              ]"
            >
              <input
                type="radio"
                v-model="config.architecture"
                value="split-horizon"
                class="sr-only"
                disabled
              />
              <div
                class="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0"
              >
                <Split class="w-6 h-6 text-amber-600" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">
                    {{ t('dns.wizard.architecture.splitHorizon.title') }}
                  </h4>
                  <span class="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">{{
                    t('dns.wizard.comingSoon')
                  }}</span>
                </div>
                <p class="text-sm text-slate-600 mt-1">
                  {{ t('dns.wizard.architecture.splitHorizon.description') }}
                </p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Multi-vues</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">MSP</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Avancé</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Step 2: Server Configuration -->
        <div v-if="currentStep === 1" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('dns.wizard.config.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('dns.wizard.config.description') }}</p>
          </div>

          <div class="space-y-4">
            <!-- Server Selection -->
            <label class="block">
              <span class="text-sm font-medium text-slate-700">{{
                t('dns.wizard.config.selectServer')
              }} *</span>
              <select
                v-model="config.serverId"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">{{ t('dns.wizard.config.choose') }}</option>
                <option v-for="server in availableServers" :key="server.id" :value="server.id">
                  {{ server.alias || server.hostname }} ({{ server.ip }})
                </option>
              </select>
            </label>

            <!-- Secondary Server (if primary-secondary) -->
            <label v-if="config.architecture === 'primary-secondary'" class="block">
              <span class="text-sm font-medium text-slate-700">{{
                t('dns.wizard.config.secondaryServer')
              }} *</span>
              <select
                v-model="config.secondaryServerId"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">{{ t('dns.wizard.config.choose') }}</option>
                <option
                  v-for="server in availableServers.filter((s) => s.id !== config.serverId)"
                  :key="server.id"
                  :value="server.id"
                >
                  {{ server.alias || server.hostname }} ({{ server.ip }})
                </option>
              </select>
            </label>

            <!-- Hostname DNS -->
            <label class="block">
              <span class="text-sm font-medium text-slate-700">{{
                t('dns.wizard.config.hostname')
              }} *</span>
              <input
                v-model="config.hostname"
                type="text"
                placeholder="ns1.example.com"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p class="mt-1 text-xs text-slate-500">{{ t('dns.wizard.config.hostnameHint') }}</p>
            </label>

            <!-- Forwarders (for cache mode) -->
            <div v-if="config.architecture === 'cache'" class="space-y-2">
              <span class="text-sm font-medium text-slate-700">{{
                t('dns.wizard.config.forwarders')
              }}</span>
              <p class="text-xs text-slate-500">{{ t('dns.wizard.config.forwardersHint') }}</p>
              <div class="grid grid-cols-2 gap-2">
                <label
                  v-for="forwarder in forwarderOptions"
                  :key="forwarder.value"
                  :class="[
                    'p-3 border-2 rounded-lg cursor-pointer transition-all flex items-center gap-2',
                    config.forwarders.includes(forwarder.value)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300',
                  ]"
                >
                  <input
                    type="checkbox"
                    :value="forwarder.value"
                    v-model="config.forwarders"
                    class="sr-only"
                  />
                  <CheckCircle2
                    v-if="config.forwarders.includes(forwarder.value)"
                    class="w-4 h-4 text-indigo-500"
                  />
                  <div
                    v-else
                    class="w-4 h-4 border-2 border-slate-300 rounded-full"
                  />
                  <div>
                    <span class="text-sm font-medium">{{ forwarder.label }}</span>
                    <span class="text-xs text-slate-500 ml-1">({{ forwarder.value }})</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Local Network (for cache mode) -->
            <label v-if="config.architecture === 'cache'" class="block">
              <span class="text-sm font-medium text-slate-700">{{
                t('dns.wizard.config.localNetwork')
              }}</span>
              <input
                v-model="config.localNetwork"
                type="text"
                placeholder="192.168.1.0/24"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p class="mt-1 text-xs text-slate-500">{{ t('dns.wizard.config.localNetworkHint') }}</p>
            </label>

            <!-- Server info preview -->
            <div v-if="config.serverId" class="p-4 bg-indigo-50 rounded-xl">
              <h4 class="font-medium text-indigo-900 mb-2">
                {{ t('dns.wizard.config.servicesInstalled') }}
              </h4>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center gap-2">
                  <CheckCircle2 class="w-4 h-4 text-green-500" />
                  <span class="text-sm text-slate-700">BIND9</span>
                </div>
                <div class="flex items-center gap-2">
                  <CheckCircle2 class="w-4 h-4 text-green-500" />
                  <span class="text-sm text-slate-700">dnsutils</span>
                </div>
                <div v-if="config.security.dnssec.enabled" class="flex items-center gap-2">
                  <CheckCircle2 class="w-4 h-4 text-green-500" />
                  <span class="text-sm text-slate-700">DNSSEC</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Zones DNS -->
        <div v-if="currentStep === 2" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('dns.wizard.zones.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('dns.wizard.zones.description') }}</p>
          </div>

          <!-- Skip zones for cache mode -->
          <div v-if="config.architecture === 'cache'" class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div class="flex items-start gap-3">
              <Info class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-emerald-900">{{ t('dns.wizard.zones.cacheMode') }}</h4>
                <p class="text-sm text-emerald-700 mt-1">{{ t('dns.wizard.zones.cacheModeDesc') }}</p>
              </div>
            </div>
          </div>

          <!-- Zones for primary/primary-secondary -->
          <div v-else class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-700">{{ t('dns.wizard.zones.list') }}</span>
              <button
                @click="addZone"
                class="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <Plus class="w-4 h-4" />
                {{ t('dns.wizard.zones.addZone') }}
              </button>
            </div>

            <div
              v-for="(zone, index) in config.zones"
              :key="index"
              class="p-4 border border-slate-200 rounded-xl space-y-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-slate-700">Zone {{ index + 1 }}</span>
                <button
                  v-if="config.zones.length > 1"
                  @click="removeZone(index)"
                  class="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <label class="block col-span-2">
                  <span class="text-sm text-slate-600">{{ t('dns.wizard.zones.zoneName') }} *</span>
                  <input
                    v-model="zone.name"
                    type="text"
                    placeholder="example.com"
                    class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </label>

                <label class="block">
                  <span class="text-sm text-slate-600">{{ t('dns.wizard.zones.zoneType') }}</span>
                  <select
                    v-model="zone.type"
                    class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="master">{{ t('dns.wizard.zones.master') }}</option>
                    <option value="forward">{{ t('dns.wizard.zones.forward') }}</option>
                  </select>
                </label>

                <label class="block">
                  <span class="text-sm text-slate-600">TTL ({{ t('common.optional') }})</span>
                  <input
                    v-model.number="zone.ttl"
                    type="number"
                    placeholder="3600"
                    class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </label>
              </div>
            </div>

            <!-- Reverse zone suggestion -->
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="config.createReverseZone"
                  class="mt-1 rounded text-indigo-500"
                />
                <div>
                  <span class="text-sm font-medium text-slate-700">{{
                    t('dns.wizard.zones.reverseZone')
                  }}</span>
                  <p class="text-xs text-slate-500 mt-0.5">
                    {{ t('dns.wizard.zones.reverseZoneHint') }}
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Step 4: Security -->
        <div v-if="currentStep === 3" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('dns.wizard.security.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('dns.wizard.security.description') }}</p>
          </div>

          <div class="space-y-4">
            <!-- DNSSEC -->
            <div class="p-4 border border-slate-200 rounded-xl space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Key class="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 class="font-medium text-slate-900">{{ t('dns.wizard.security.dnssec.title') }}</h4>
                    <p class="text-xs text-slate-500">{{ t('dns.wizard.security.dnssec.description') }}</p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="config.security.dnssec.enabled"
                    class="sr-only peer"
                    :disabled="config.architecture === 'cache'"
                  />
                  <div
                    class="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500 peer-disabled:opacity-50"
                  ></div>
                </label>
              </div>
              <div v-if="config.security.dnssec.enabled && config.architecture !== 'cache'" class="grid grid-cols-2 gap-4">
                <label class="block">
                  <span class="text-sm text-slate-600">{{ t('dns.wizard.security.dnssec.algorithm') }}</span>
                  <select
                    v-model="config.security.dnssec.algorithm"
                    class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="ECDSAP256SHA256">ECDSAP256SHA256 ({{ t('dns.wizard.recommended') }})</option>
                    <option value="ECDSAP384SHA384">ECDSAP384SHA384</option>
                    <option value="RSASHA256">RSASHA256</option>
                  </select>
                </label>
                <label class="block">
                  <span class="text-sm text-slate-600">{{ t('dns.wizard.security.dnssec.autoRotation') }}</span>
                  <div class="mt-2">
                    <label class="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        v-model="config.security.dnssec.autoRotate"
                        class="rounded text-indigo-500"
                      />
                      <span class="ml-2 text-sm text-slate-600">{{ t('common.yes') }}</span>
                    </label>
                  </div>
                </label>
              </div>
            </div>

            <!-- TSIG (for primary-secondary) -->
            <div
              v-if="config.architecture === 'primary-secondary'"
              class="p-4 border border-slate-200 rounded-xl space-y-4"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Lock class="w-5 h-5 text-purple-600" />
                  <div>
                    <h4 class="font-medium text-slate-900">{{ t('dns.wizard.security.tsig.title') }}</h4>
                    <p class="text-xs text-slate-500">{{ t('dns.wizard.security.tsig.description') }}</p>
                  </div>
                </div>
                <span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  {{ t('dns.wizard.required') }}
                </span>
              </div>
              <p class="text-sm text-slate-600">
                {{ t('dns.wizard.security.tsig.autoGenerated') }}
              </p>
            </div>

            <!-- Rate Limiting (RRL) -->
            <div class="p-4 border border-slate-200 rounded-xl space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Shield class="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 class="font-medium text-slate-900">{{ t('dns.wizard.security.rrl.title') }}</h4>
                    <p class="text-xs text-slate-500">{{ t('dns.wizard.security.rrl.description') }}</p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="config.security.rrl.enabled"
                    class="sr-only peer"
                  />
                  <div
                    class="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"
                  ></div>
                </label>
              </div>
              <div v-if="config.security.rrl.enabled" class="grid grid-cols-2 gap-4">
                <label class="block">
                  <span class="text-sm text-slate-600">{{ t('dns.wizard.security.rrl.responsesPerSec') }}</span>
                  <input
                    v-model.number="config.security.rrl.responsesPerSecond"
                    type="number"
                    min="1"
                    max="100"
                    class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </label>
                <label class="block">
                  <span class="text-sm text-slate-600">{{ t('dns.wizard.security.rrl.window') }}</span>
                  <input
                    v-model.number="config.security.rrl.window"
                    type="number"
                    min="1"
                    max="60"
                    class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </label>
              </div>
            </div>

            <!-- Query Logging -->
            <div class="p-4 border border-slate-200 rounded-xl">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <FileText class="w-5 h-5 text-slate-600" />
                  <div>
                    <h4 class="font-medium text-slate-900">{{ t('dns.wizard.security.logging.title') }}</h4>
                    <p class="text-xs text-slate-500">{{ t('dns.wizard.security.logging.description') }}</p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="config.security.logging"
                    class="sr-only peer"
                  />
                  <div
                    class="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"
                  ></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 5: DNS Records Preview -->
        <div v-if="currentStep === 4" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('dns.wizard.records.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('dns.wizard.records.description') }}</p>
          </div>

          <!-- Info for cache mode -->
          <div v-if="config.architecture === 'cache'" class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div class="flex items-start gap-3">
              <Info class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-emerald-900">{{ t('dns.wizard.records.cacheMode') }}</h4>
                <p class="text-sm text-emerald-700 mt-1">{{ t('dns.wizard.records.cacheModeDesc') }}</p>
              </div>
            </div>
          </div>

          <!-- Records preview for authoritative modes -->
          <div v-else class="space-y-4">
            <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 class="font-medium text-amber-900">{{ t('dns.wizard.records.important') }}</h4>
                  <p class="text-sm text-amber-700 mt-1">{{ t('dns.wizard.records.importantDesc') }}</p>
                </div>
              </div>
            </div>

            <!-- Records list -->
            <div class="space-y-3">
              <div
                v-for="record in previewRecords"
                :key="record.type + record.name"
                class="p-4 bg-slate-50 rounded-xl"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-mono rounded">{{
                      record.type
                    }}</span>
                    <span class="text-sm font-medium text-slate-900">{{ record.name }}</span>
                  </div>
                  <button
                    @click="copyToClipboard(record.value)"
                    class="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Copy class="w-4 h-4" />
                  </button>
                </div>
                <code class="block text-xs bg-slate-900 text-green-400 p-2 rounded overflow-x-auto">{{
                  record.value
                }}</code>
                <p class="text-xs text-slate-500 mt-2">{{ record.description }}</p>
              </div>
            </div>

            <button
              @click="copyAllRecords"
              class="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Copy class="w-4 h-4" />
              {{ t('dns.wizard.records.copyAll') }}
            </button>
          </div>
        </div>

        <!-- Step 6: Installation -->
        <div v-if="currentStep === 5" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">
              {{ t('dns.wizard.install.title') }}
            </h3>
            <p class="text-sm text-slate-600">{{ t('dns.wizard.install.description') }}</p>
          </div>

          <div v-if="!installing && !installComplete" class="space-y-4">
            <!-- Summary -->
            <div class="p-4 bg-slate-50 rounded-xl space-y-3">
              <h4 class="font-medium text-slate-900">{{ t('dns.wizard.install.summary') }}</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-slate-500">{{ t('dns.wizard.install.architecture') }} :</span>
                  <span class="ml-2 font-medium">{{ getArchitectureLabel(config.architecture) }}</span>
                </div>
                <div>
                  <span class="text-slate-500">{{ t('dns.wizard.install.hostname') }} :</span>
                  <span class="ml-2 font-medium">{{ config.hostname || '-' }}</span>
                </div>
                <div v-if="config.architecture !== 'cache'">
                  <span class="text-slate-500">{{ t('dns.wizard.install.zones') }} :</span>
                  <span class="ml-2 font-medium">{{ config.zones.length }} zone(s)</span>
                </div>
                <div>
                  <span class="text-slate-500">{{ t('dns.wizard.install.security') }} :</span>
                  <span class="ml-2 font-medium">{{ getSecuritySummary() }}</span>
                </div>
              </div>
            </div>

            <!-- Services to install -->
            <div class="p-4 border border-slate-200 rounded-xl">
              <h4 class="font-medium text-slate-900 mb-3">
                {{ t('dns.wizard.install.services') }}
              </h4>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center gap-2 text-sm">
                  <div class="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span>BIND9</span>
                </div>
                <div class="flex items-center gap-2 text-sm">
                  <div class="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span>dnsutils</span>
                </div>
                <div v-if="config.security.dnssec.enabled" class="flex items-center gap-2 text-sm">
                  <div class="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span>DNSSEC Keys</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Installation Progress -->
          <div v-if="installing" class="space-y-4">
            <div v-for="step in installationSteps" :key="step.id" class="flex items-center gap-3">
              <div
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  step.status === 'complete'
                    ? 'bg-green-100'
                    : step.status === 'running'
                      ? 'bg-indigo-100'
                      : step.status === 'error'
                        ? 'bg-red-100'
                        : 'bg-slate-100',
                ]"
              >
                <Check v-if="step.status === 'complete'" class="w-4 h-4 text-green-600" />
                <Loader2
                  v-else-if="step.status === 'running'"
                  class="w-4 h-4 text-indigo-600 animate-spin"
                />
                <X v-else-if="step.status === 'error'" class="w-4 h-4 text-red-600" />
                <div v-else class="w-2 h-2 bg-slate-300 rounded-full"></div>
              </div>
              <div class="flex-1">
                <span
                  :class="[
                    'text-sm font-medium',
                    step.status === 'running' ? 'text-indigo-600' : 'text-slate-700',
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
                  En attente des logs...
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
              {{ t('dns.wizard.install.complete') }}
            </h4>
            <p class="text-sm text-slate-600 mb-4">{{ t('dns.wizard.install.completeDesc') }}</p>
            <div v-if="config.architecture !== 'cache'" class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
              <p class="text-sm text-amber-800">
                <strong>{{ t('dns.wizard.install.reminder') }}</strong>
                {{ t('dns.wizard.install.reminderDesc') }}
              </p>
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
            class="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
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
            {{ t('dns.wizard.install.start') }}
          </button>
          <button
            v-else-if="installComplete"
            @click="$emit('close')"
            class="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
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
  Globe,
  X,
  Check,
  CheckCircle2,
  Server,
  Network,
  Database,
  Split,
  Plus,
  Trash2,
  Key,
  Lock,
  Shield,
  FileText,
  Info,
  AlertTriangle,
  Copy,
  ChevronLeft,
  ChevronRight,
  Play,
  Loader2,
} from 'lucide-vue-next';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'complete', config: any): void;
  (e: 'configureDnsStack', serverId: string, config: any): void;
}>();

const props = defineProps<{
  servers: Array<{
    id: string;
    hostname: string;
    ip: string;
    alias?: string;
    online: boolean;
  }>;
  installationLogs?: Array<{ message: string; stream: 'stdout' | 'stderr' }>;
  installationResult?: { success: boolean; error?: string } | null;
}>();

// Current step
const currentStep = ref(0);

// Steps definition
const steps = [
  { id: 'architecture', title: 'Architecture' },
  { id: 'config', title: 'Configuration' },
  { id: 'zones', title: 'Zones' },
  { id: 'security', title: 'Sécurité' },
  { id: 'records', title: 'Records' },
  { id: 'install', title: 'Installation' },
];

// Configuration
const config = ref({
  architecture: 'primary' as 'primary' | 'primary-secondary' | 'cache' | 'split-horizon',
  serverId: '',
  secondaryServerId: '',
  hostname: '',
  forwarders: ['8.8.8.8', '1.1.1.1'] as string[],
  localNetwork: '192.168.1.0/24',
  zones: [{ name: '', type: 'master' as 'master' | 'slave' | 'forward', ttl: 3600 }],
  createReverseZone: true,
  security: {
    dnssec: {
      enabled: false,
      algorithm: 'ECDSAP256SHA256',
      autoRotate: true,
    },
    tsig: {
      enabled: true,
    },
    rrl: {
      enabled: true,
      responsesPerSecond: 5,
      window: 15,
    },
    logging: false,
  },
});

// Installation state
const installing = ref(false);
const installComplete = ref(false);
const installationSteps = ref<
  Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    message?: string;
  }>
>([]);

// Forwarder options
const forwarderOptions = [
  { value: '8.8.8.8', label: 'Google DNS' },
  { value: '1.1.1.1', label: 'Cloudflare' },
  { value: '9.9.9.9', label: 'Quad9' },
  { value: '208.67.222.222', label: 'OpenDNS' },
];

// Computed
const availableServers = computed(() => {
  return props.servers.filter((s) => s.online);
});

const previewRecords = computed(() => {
  const records: Array<{ type: string; name: string; value: string; description: string }> = [];
  const serverIp = props.servers.find((s) => s.id === config.value.serverId)?.ip || 'YOUR_SERVER_IP';

  // SOA record
  if (config.value.zones[0]?.name) {
    const zone = config.value.zones[0].name;
    records.push({
      type: 'SOA',
      name: zone,
      value: `${config.value.hostname}. admin.${zone}. 1 3600 1800 604800 86400`,
      description: 'Start of Authority - Informations de la zone',
    });

    // NS records
    records.push({
      type: 'NS',
      name: zone,
      value: `${config.value.hostname}.`,
      description: 'Serveur de noms principal',
    });

    if (config.value.architecture === 'primary-secondary') {
      const secondaryHostname = config.value.hostname.replace('ns1', 'ns2');
      records.push({
        type: 'NS',
        name: zone,
        value: `${secondaryHostname}.`,
        description: 'Serveur de noms secondaire',
      });
    }

    // A record for NS
    records.push({
      type: 'A',
      name: config.value.hostname,
      value: serverIp,
      description: 'Adresse IP du serveur DNS',
    });
  }

  return records;
});

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0: // Architecture
      return !!config.value.architecture && config.value.architecture !== 'split-horizon';
    case 1: // Config
      if (!config.value.serverId || !config.value.hostname) return false;
      if (config.value.architecture === 'primary-secondary' && !config.value.secondaryServerId) return false;
      return true;
    case 2: // Zones
      if (config.value.architecture === 'cache') return true;
      return config.value.zones.length > 0 && config.value.zones.every((z) => z.name.trim() !== '');
    default:
      return true;
  }
});

// Methods
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

function addZone() {
  config.value.zones.push({ name: '', type: 'master', ttl: 3600 });
}

function removeZone(index: number) {
  config.value.zones.splice(index, 1);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function copyAllRecords() {
  const text = previewRecords.value.map((r) => `${r.type}\t${r.name}\t${r.value}`).join('\n');
  navigator.clipboard.writeText(text);
}

function getArchitectureLabel(arch: string): string {
  const labels: Record<string, string> = {
    primary: t('dns.wizard.architecture.primary.title'),
    'primary-secondary': t('dns.wizard.architecture.primarySecondary.title'),
    cache: t('dns.wizard.architecture.cache.title'),
    'split-horizon': t('dns.wizard.architecture.splitHorizon.title'),
  };
  return labels[arch] || arch;
}

function getSecuritySummary(): string {
  const features: string[] = [];
  if (config.value.security.dnssec.enabled) features.push('DNSSEC');
  if (config.value.security.rrl.enabled) features.push('RRL');
  if (config.value.security.logging) features.push('Logs');
  return features.length > 0 ? features.join(', ') : '-';
}

async function startInstallation() {
  installing.value = true;

  installationSteps.value = [
    { id: 'install', name: 'Installation de BIND9', status: 'running' },
    { id: 'config', name: 'Configuration des zones', status: 'pending' },
    { id: 'security', name: 'Configuration de la sécurité', status: 'pending' },
    { id: 'restart', name: 'Redémarrage du service', status: 'pending' },
  ];

  const serverId = config.value.serverId;
  if (!serverId) {
    installationSteps.value[0].status = 'error';
    installationSteps.value[0].message = 'Aucun serveur sélectionné';
    installing.value = false;
    return;
  }

  emit('configureDnsStack', serverId, {
    architecture: config.value.architecture,
    hostname: config.value.hostname,
    zones: config.value.architecture === 'cache' ? [] : config.value.zones.filter((z) => z.name.trim() !== ''),
    forwarders: config.value.architecture === 'cache' ? config.value.forwarders : [],
    localNetwork: config.value.localNetwork,
    createReverseZone: config.value.createReverseZone,
    secondaryServerId: config.value.secondaryServerId,
    security: {
      dnssec: config.value.security.dnssec,
      tsig: config.value.architecture === 'primary-secondary' ? { enabled: true } : { enabled: false },
      rrl: config.value.security.rrl,
      logging: config.value.security.logging,
    },
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

// Ref for logs container (autoscroll)
const logsContainer = ref<HTMLElement | null>(null);

// Watcher for autoscroll logs
watch(
  () => props.installationLogs?.length,
  () => {
    nextTick(() => {
      if (logsContainer.value) {
        logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
      }
    });

    if (props.installationLogs && props.installationLogs.length > 0) {
      const lastLogs = props.installationLogs.slice(-5);
      for (const log of lastLogs) {
        const msg = log.message;
        if (msg.includes('Installing BIND9') || msg.includes('Step 1')) {
          updateStepStatus('install', 'running');
        } else if (msg.includes('Configuring zones') || msg.includes('Step 2')) {
          updateStepStatus('install', 'complete');
          updateStepStatus('config', 'running');
        } else if (msg.includes('Configuring security') || msg.includes('Step 3')) {
          updateStepStatus('config', 'complete');
          updateStepStatus('security', 'running');
        } else if (msg.includes('Restarting') || msg.includes('Step 4')) {
          updateStepStatus('security', 'complete');
          updateStepStatus('restart', 'running');
        } else if (msg.includes('DNS configured successfully') || msg.includes('✅')) {
          updateStepStatus('restart', 'complete');
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

// Auto-generate hostname from first zone
watch(
  () => config.value.zones[0]?.name,
  (zoneName) => {
    if (zoneName && !config.value.hostname) {
      config.value.hostname = `ns1.${zoneName}`;
    }
  },
);
</script>
