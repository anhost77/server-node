<!--
  @file apps/dashboard/src/components/mail/MailServerWizard.vue
  @description Wizard de configuration pour installer une stack mail complète.
  Ce composant guide l'utilisateur à travers toutes les étapes nécessaires
  pour configurer un serveur mail : architecture, domaines, sécurité, DNS.

  @dependencies
  - Vue 3 : Framework frontend
  - Lucide Icons : Icônes pour l'interface

  @fonctions_principales
  - selectArchitecture() : Choix de l'architecture (mono/distribué/HA)
  - assignServerRoles() : Attribution des rôles aux serveurs
  - generateDnsRecords() : Génère les enregistrements DNS requis
  - startInstallation() : Lance l'installation sur les serveurs
-->
<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-orange-500 to-orange-600">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Mail class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">{{ t('mail.wizard.title') }}</h2>
            <p class="text-sm text-white/80">{{ t('mail.wizard.subtitle') }}</p>
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
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                ]"
              >
                <Check v-if="currentStep > index" class="w-4 h-4" />
                <span v-else>{{ index + 1 }}</span>
              </div>
              <span
                :class="[
                  'text-sm font-medium hidden sm:block',
                  currentStep >= index ? 'text-slate-900' : 'text-slate-400'
                ]"
              >
                {{ step.title }}
              </span>
            </div>
            <div
              v-if="index < steps.length - 1"
              :class="[
                'flex-1 h-0.5 mx-2',
                currentStep > index ? 'bg-green-500' : 'bg-slate-200'
              ]"
            />
          </template>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Step 1: Architecture -->
        <div v-if="currentStep === 0" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{{ t('mail.wizard.architecture.title') }}</h3>
            <p class="text-sm text-slate-600">{{ t('mail.wizard.architecture.description') }}</p>
          </div>

          <div class="grid gap-4">
            <!-- Single Server -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
                config.architecture === 'single'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300'
              ]"
            >
              <input
                type="radio"
                v-model="config.architecture"
                value="single"
                class="sr-only"
              />
              <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Server class="w-6 h-6 text-blue-600" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">{{ t('mail.wizard.architecture.single.title') }}</h4>
                  <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{{ t('mail.wizard.recommended') }}</span>
                </div>
                <p class="text-sm text-slate-600 mt-1">{{ t('mail.wizard.architecture.single.description') }}</p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">1 serveur</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Simple</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">PME</span>
                </div>
              </div>
              <div v-if="config.architecture === 'single'" class="absolute top-4 right-4">
                <CheckCircle2 class="w-5 h-5 text-orange-500" />
              </div>
            </label>

            <!-- Distributed -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
                config.architecture === 'distributed'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300'
              ]"
            >
              <input
                type="radio"
                v-model="config.architecture"
                value="distributed"
                class="sr-only"
              />
              <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Network class="w-6 h-6 text-purple-600" />
              </div>
              <div class="flex-1">
                <h4 class="font-semibold text-slate-900">{{ t('mail.wizard.architecture.distributed.title') }}</h4>
                <p class="text-sm text-slate-600 mt-1">{{ t('mail.wizard.architecture.distributed.description') }}</p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">2-5 serveurs</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Scalable</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Entreprise</span>
                </div>
              </div>
              <div v-if="config.architecture === 'distributed'" class="absolute top-4 right-4">
                <CheckCircle2 class="w-5 h-5 text-orange-500" />
              </div>
            </label>

            <!-- High Availability -->
            <label
              :class="[
                'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all opacity-60',
                config.architecture === 'ha-cluster'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200'
              ]"
            >
              <input
                type="radio"
                v-model="config.architecture"
                value="ha-cluster"
                class="sr-only"
                disabled
              />
              <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Database class="w-6 h-6 text-emerald-600" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-semibold text-slate-900">{{ t('mail.wizard.architecture.ha.title') }}</h4>
                  <span class="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">{{ t('mail.wizard.comingSoon') }}</span>
                </div>
                <p class="text-sm text-slate-600 mt-1">{{ t('mail.wizard.architecture.ha.description') }}</p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">3+ serveurs</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Réplication</span>
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Critique</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Step 2: Server Assignment -->
        <div v-if="currentStep === 1" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{{ t('mail.wizard.servers.title') }}</h3>
            <p class="text-sm text-slate-600">{{ t('mail.wizard.servers.description') }}</p>
          </div>

          <!-- Single Server Mode -->
          <div v-if="config.architecture === 'single'" class="space-y-4">
            <label class="block">
              <span class="text-sm font-medium text-slate-700">{{ t('mail.wizard.servers.selectServer') }}</span>
              <select
                v-model="config.servers[0].serverId"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">{{ t('mail.wizard.servers.choose') }}</option>
                <option v-for="server in availableServers" :key="server.id" :value="server.id">
                  {{ server.alias || server.hostname }} ({{ server.ip }})
                </option>
              </select>
            </label>

            <div v-if="config.servers[0].serverId" class="p-4 bg-blue-50 rounded-xl">
              <h4 class="font-medium text-blue-900 mb-2">{{ t('mail.wizard.servers.servicesInstalled') }}</h4>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="service in singleServerServices" :key="service.type" class="flex items-center gap-2">
                  <CheckCircle2 class="w-4 h-4 text-green-500" />
                  <span class="text-sm text-slate-700">{{ service.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Distributed Mode -->
          <div v-if="config.architecture === 'distributed'" class="space-y-4">
            <!-- MX Inbound -->
            <div class="p-4 border border-slate-200 rounded-xl">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ArrowDownToLine class="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 class="font-medium text-slate-900">MX Inbound (Réception)</h4>
                  <p class="text-xs text-slate-500">Postfix, Rspamd, ClamAV, SPF Policy</p>
                </div>
              </div>
              <select
                v-model="distributedConfig.mxInbound"
                class="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Sélectionner un serveur...</option>
                <option v-for="server in availableServers" :key="server.id" :value="server.id">
                  {{ server.alias || server.hostname }} ({{ server.ip }})
                </option>
              </select>
            </div>

            <!-- Mail Storage -->
            <div class="p-4 border border-slate-200 rounded-xl">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <HardDrive class="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 class="font-medium text-slate-900">Mail Storage (Stockage)</h4>
                  <p class="text-xs text-slate-500">Dovecot, Maildir</p>
                </div>
              </div>
              <select
                v-model="distributedConfig.mailStorage"
                class="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Sélectionner un serveur...</option>
                <option v-for="server in availableServers" :key="server.id" :value="server.id">
                  {{ server.alias || server.hostname }} ({{ server.ip }})
                </option>
              </select>
            </div>

            <!-- MX Outbound -->
            <div class="p-4 border border-slate-200 rounded-xl">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <ArrowUpFromLine class="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 class="font-medium text-slate-900">MX Outbound (Envoi)</h4>
                  <p class="text-xs text-slate-500">Postfix, OpenDKIM</p>
                </div>
              </div>
              <select
                v-model="distributedConfig.mxOutbound"
                class="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Sélectionner un serveur...</option>
                <option v-for="server in availableServers" :key="server.id" :value="server.id">
                  {{ server.alias || server.hostname }} ({{ server.ip }})
                </option>
              </select>
              <label class="flex items-center gap-2 mt-2 text-sm text-slate-600">
                <input type="checkbox" v-model="distributedConfig.sameAsInbound" class="rounded text-orange-500" />
                Utiliser le même serveur que MX Inbound
              </label>
            </div>
          </div>
        </div>

        <!-- Step 3: Domain Configuration -->
        <div v-if="currentStep === 2" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{{ t('mail.wizard.domain.title') }}</h3>
            <p class="text-sm text-slate-600">{{ t('mail.wizard.domain.description') }}</p>
          </div>

          <div class="space-y-4">
            <label class="block">
              <span class="text-sm font-medium text-slate-700">{{ t('mail.wizard.domain.primary') }} *</span>
              <input
                v-model="config.domain.primaryDomain"
                type="text"
                placeholder="example.com"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <p class="mt-1 text-xs text-slate-500">{{ t('mail.wizard.domain.primaryHint') }}</p>
            </label>

            <label class="block">
              <span class="text-sm font-medium text-slate-700">{{ t('mail.wizard.domain.hostname') }} *</span>
              <input
                v-model="config.domain.hostname"
                type="text"
                placeholder="mail.example.com"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <p class="mt-1 text-xs text-slate-500">{{ t('mail.wizard.domain.hostnameHint') }}</p>
            </label>

            <!-- Additional Domains -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-slate-700">{{ t('mail.wizard.domain.additional') }}</span>
                <button
                  @click="addDomain"
                  class="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
                >
                  <Plus class="w-4 h-4" />
                  {{ t('mail.wizard.domain.addDomain') }}
                </button>
              </div>
              <div v-for="(domain, index) in config.domain.additionalDomains" :key="index" class="flex gap-2 mb-2">
                <input
                  v-model="config.domain.additionalDomains[index]"
                  type="text"
                  placeholder="autre-domaine.com"
                  class="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                <button @click="removeDomain(index)" class="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Security Configuration -->
        <div v-if="currentStep === 3" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{{ t('mail.wizard.security.title') }}</h3>
            <p class="text-sm text-slate-600">{{ t('mail.wizard.security.description') }}</p>
          </div>

          <!-- TLS Configuration -->
          <div class="p-4 border border-slate-200 rounded-xl space-y-4">
            <div class="flex items-center gap-3">
              <Lock class="w-5 h-5 text-green-600" />
              <h4 class="font-medium text-slate-900">{{ t('mail.wizard.security.tls.title') }}</h4>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <label
                v-for="option in tlsOptions"
                :key="option.value"
                :class="[
                  'p-3 border-2 rounded-lg cursor-pointer transition-all text-center',
                  config.security.tls.provider === option.value
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                ]"
              >
                <input type="radio" v-model="config.security.tls.provider" :value="option.value" class="sr-only" />
                <span class="text-sm font-medium">{{ option.label }}</span>
              </label>
            </div>
          </div>

          <!-- DKIM Configuration -->
          <div class="p-4 border border-slate-200 rounded-xl space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Key class="w-5 h-5 text-blue-600" />
                <h4 class="font-medium text-slate-900">DKIM (Signature des emails)</h4>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="config.security.dkim.enabled" class="sr-only peer" />
                <div class="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
            <div v-if="config.security.dkim.enabled" class="grid grid-cols-2 gap-4">
              <label class="block">
                <span class="text-sm text-slate-600">Selector</span>
                <input
                  v-model="config.security.dkim.selector"
                  type="text"
                  placeholder="default"
                  class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </label>
              <label class="block">
                <span class="text-sm text-slate-600">Taille de clé</span>
                <select v-model="config.security.dkim.keySize" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option :value="2048">2048 bits (recommandé)</option>
                  <option :value="4096">4096 bits</option>
                </select>
              </label>
            </div>
          </div>

          <!-- SPF Configuration -->
          <div class="p-4 border border-slate-200 rounded-xl space-y-4">
            <div class="flex items-center gap-3">
              <Shield class="w-5 h-5 text-purple-600" />
              <h4 class="font-medium text-slate-900">SPF (Sender Policy Framework)</h4>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <label
                v-for="policy in spfPolicies"
                :key="policy.value"
                :class="[
                  'p-3 border-2 rounded-lg cursor-pointer transition-all',
                  config.security.spf.policy === policy.value
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                ]"
              >
                <input type="radio" v-model="config.security.spf.policy" :value="policy.value" class="sr-only" />
                <span class="text-sm font-medium block">{{ policy.label }}</span>
                <span class="text-xs text-slate-500">{{ policy.hint }}</span>
              </label>
            </div>
          </div>

          <!-- DMARC Configuration -->
          <div class="p-4 border border-slate-200 rounded-xl space-y-4">
            <div class="flex items-center gap-3">
              <ShieldCheck class="w-5 h-5 text-emerald-600" />
              <h4 class="font-medium text-slate-900">DMARC (Domain-based Message Authentication)</h4>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <label
                v-for="policy in dmarcPolicies"
                :key="policy.value"
                :class="[
                  'p-3 border-2 rounded-lg cursor-pointer transition-all',
                  config.security.dmarc.policy === policy.value
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                ]"
              >
                <input type="radio" v-model="config.security.dmarc.policy" :value="policy.value" class="sr-only" />
                <span class="text-sm font-medium block">{{ policy.label }}</span>
                <span class="text-xs text-slate-500">{{ policy.hint }}</span>
              </label>
            </div>
            <label class="block">
              <span class="text-sm text-slate-600">Email pour les rapports DMARC (optionnel)</span>
              <input
                v-model="config.security.dmarc.rua"
                type="email"
                placeholder="dmarc@example.com"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
          </div>
        </div>

        <!-- Step 5: Services Selection -->
        <div v-if="currentStep === 4" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{{ t('mail.wizard.services.title') }}</h3>
            <p class="text-sm text-slate-600">{{ t('mail.wizard.services.description') }}</p>
          </div>

          <div class="grid gap-4">
            <!-- Antispam -->
            <div class="p-4 border border-slate-200 rounded-xl">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <ShieldAlert class="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h4 class="font-medium text-slate-900">Antispam</h4>
                    <p class="text-xs text-slate-500">Filtrage des emails indésirables</p>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <label
                  :class="[
                    'p-3 border-2 rounded-lg cursor-pointer transition-all text-center',
                    config.services.antispam === 'rspamd'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  ]"
                >
                  <input type="radio" v-model="config.services.antispam" value="rspamd" class="sr-only" />
                  <span class="text-sm font-medium">Rspamd</span>
                  <span class="block text-xs text-green-600">Recommandé</span>
                </label>
                <label
                  :class="[
                    'p-3 border-2 rounded-lg cursor-pointer transition-all text-center',
                    config.services.antispam === 'none'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  ]"
                >
                  <input type="radio" v-model="config.services.antispam" value="none" class="sr-only" />
                  <span class="text-sm font-medium">Aucun</span>
                </label>
              </div>
            </div>

            <!-- Antivirus -->
            <div class="p-4 border border-slate-200 rounded-xl">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Bug class="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 class="font-medium text-slate-900">ClamAV (Antivirus)</h4>
                    <p class="text-xs text-slate-500">Scan des pièces jointes</p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="config.services.antivirus" class="sr-only peer" />
                  <div class="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
            </div>

            <!-- Webmail (Coming Soon) -->
            <div class="p-4 border border-slate-200 rounded-xl opacity-60">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Globe class="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 class="font-medium text-slate-900">Webmail (Roundcube)</h4>
                    <p class="text-xs text-slate-500">Interface web pour les emails</p>
                  </div>
                </div>
                <span class="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded-full">Bientôt</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 6: DNS Records -->
        <div v-if="currentStep === 5" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{{ t('mail.wizard.dns.title') }}</h3>
            <p class="text-sm text-slate-600">{{ t('mail.wizard.dns.description') }}</p>
          </div>

          <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div class="flex items-start gap-3">
              <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-amber-900">{{ t('mail.wizard.dns.important') }}</h4>
                <p class="text-sm text-amber-700 mt-1">{{ t('mail.wizard.dns.importantDesc') }}</p>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <div v-for="record in dnsRecords" :key="record.type + record.name" class="p-4 bg-slate-50 rounded-xl">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded">{{ record.type }}</span>
                  <span class="text-sm font-medium text-slate-900">{{ record.name }}</span>
                </div>
                <button
                  @click="copyToClipboard(record.value)"
                  class="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <Copy class="w-4 h-4" />
                </button>
              </div>
              <code class="block text-xs bg-slate-900 text-green-400 p-2 rounded overflow-x-auto">{{ record.value }}</code>
              <p class="text-xs text-slate-500 mt-2">{{ record.description }}</p>
            </div>
          </div>

          <button
            @click="copyAllDnsRecords"
            class="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Copy class="w-4 h-4" />
            {{ t('mail.wizard.dns.copyAll') }}
          </button>
        </div>

        <!-- Step 7: Installation -->
        <div v-if="currentStep === 6" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{{ t('mail.wizard.install.title') }}</h3>
            <p class="text-sm text-slate-600">{{ t('mail.wizard.install.description') }}</p>
          </div>

          <div v-if="!installing && !installComplete" class="space-y-4">
            <!-- Summary -->
            <div class="p-4 bg-slate-50 rounded-xl space-y-3">
              <h4 class="font-medium text-slate-900">{{ t('mail.wizard.install.summary') }}</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-slate-500">Architecture :</span>
                  <span class="ml-2 font-medium">{{ config.architecture === 'single' ? 'Monolithique' : 'Distribuée' }}</span>
                </div>
                <div>
                  <span class="text-slate-500">Domaine :</span>
                  <span class="ml-2 font-medium">{{ config.domain.primaryDomain }}</span>
                </div>
                <div>
                  <span class="text-slate-500">Hostname :</span>
                  <span class="ml-2 font-medium">{{ config.domain.hostname }}</span>
                </div>
                <div>
                  <span class="text-slate-500">Services :</span>
                  <span class="ml-2 font-medium">{{ servicesToInstall.length }} services</span>
                </div>
              </div>
            </div>

            <!-- Services to install -->
            <div class="p-4 border border-slate-200 rounded-xl">
              <h4 class="font-medium text-slate-900 mb-3">{{ t('mail.wizard.install.services') }}</h4>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="service in servicesToInstall" :key="service" class="flex items-center gap-2 text-sm">
                  <div class="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>{{ service }}</span>
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
                  step.status === 'complete' ? 'bg-green-100' :
                  step.status === 'running' ? 'bg-orange-100' :
                  step.status === 'error' ? 'bg-red-100' : 'bg-slate-100'
                ]"
              >
                <Check v-if="step.status === 'complete'" class="w-4 h-4 text-green-600" />
                <Loader2 v-else-if="step.status === 'running'" class="w-4 h-4 text-orange-600 animate-spin" />
                <X v-else-if="step.status === 'error'" class="w-4 h-4 text-red-600" />
                <div v-else class="w-2 h-2 bg-slate-300 rounded-full"></div>
              </div>
              <div class="flex-1">
                <span :class="['text-sm font-medium', step.status === 'running' ? 'text-orange-600' : 'text-slate-700']">
                  {{ step.name }}
                </span>
                <p v-if="step.message" class="text-xs text-slate-500">{{ step.message }}</p>
              </div>
            </div>
          </div>

          <!-- Installation Complete -->
          <div v-if="installComplete" class="text-center py-8">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 class="w-8 h-8 text-green-600" />
            </div>
            <h4 class="text-lg font-semibold text-slate-900 mb-2">{{ t('mail.wizard.install.complete') }}</h4>
            <p class="text-sm text-slate-600 mb-4">{{ t('mail.wizard.install.completeDesc') }}</p>
            <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
              <p class="text-sm text-amber-800">
                <strong>{{ t('mail.wizard.install.reminder') }}</strong> {{ t('mail.wizard.install.reminderDesc') }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
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
            class="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
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
            {{ t('mail.wizard.install.start') }}
          </button>
          <button
            v-else-if="installComplete"
            @click="$emit('close')"
            class="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
          >
            {{ t('common.done') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Mail, X, Check, CheckCircle2, Server, Network, Database,
  ArrowDownToLine, ArrowUpFromLine, HardDrive, Plus, Trash2,
  Lock, Key, Shield, ShieldCheck, ShieldAlert, Bug, Globe,
  AlertTriangle, Copy, ChevronLeft, ChevronRight, Play, Loader2
} from 'lucide-vue-next';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'complete', config: any): void;
}>();

const props = defineProps<{
  servers: Array<{
    id: string;
    hostname: string;
    ip: string;
    alias?: string;
    online: boolean;
  }>;
}>();

// Current step
const currentStep = ref(0);

// Steps definition
const steps = [
  { id: 'architecture', title: 'Architecture' },
  { id: 'servers', title: 'Serveurs' },
  { id: 'domain', title: 'Domaine' },
  { id: 'security', title: 'Sécurité' },
  { id: 'services', title: 'Services' },
  { id: 'dns', title: 'DNS' },
  { id: 'install', title: 'Installation' }
];

// Configuration
const config = ref({
  architecture: 'single' as 'single' | 'distributed' | 'ha-cluster',
  servers: [{ serverId: '', roles: ['all-in-one'] as string[] }],
  domain: {
    primaryDomain: '',
    hostname: '',
    additionalDomains: [] as string[]
  },
  security: {
    tls: {
      provider: 'letsencrypt' as 'letsencrypt' | 'custom' | 'selfsigned'
    },
    dkim: {
      enabled: true,
      selector: 'default',
      keySize: 2048 as 1024 | 2048 | 4096
    },
    spf: {
      policy: 'softfail' as 'strict' | 'softfail' | 'neutral'
    },
    dmarc: {
      policy: 'none' as 'none' | 'quarantine' | 'reject',
      rua: '',
      percentage: 100
    }
  },
  services: {
    antispam: 'rspamd' as 'rspamd' | 'none',
    antivirus: true,
    webmail: 'none' as 'roundcube' | 'none',
    adminPanel: 'none' as 'postfixadmin' | 'none'
  }
});

// Distributed mode config
const distributedConfig = ref({
  mxInbound: '',
  mailStorage: '',
  mxOutbound: '',
  sameAsInbound: false
});

// Installation state
const installing = ref(false);
const installComplete = ref(false);
const installationSteps = ref<Array<{
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  message?: string;
}>>([]);

// Computed
const availableServers = computed(() => props.servers.filter(s => s.online));

const singleServerServices = [
  { type: 'postfix', name: 'Postfix (MTA)' },
  { type: 'dovecot', name: 'Dovecot (IMAP/POP3)' },
  { type: 'rspamd', name: 'Rspamd (Antispam)' },
  { type: 'opendkim', name: 'OpenDKIM (DKIM)' },
  { type: 'clamav', name: 'ClamAV (Antivirus)' },
  { type: 'spf-policyd', name: 'SPF Policy' }
];

const tlsOptions = [
  { value: 'letsencrypt', label: "Let's Encrypt" },
  { value: 'selfsigned', label: 'Auto-signé' },
  { value: 'custom', label: 'Personnalisé' }
];

const spfPolicies = [
  { value: 'strict', label: '-all (Strict)', hint: 'Rejette si non autorisé' },
  { value: 'softfail', label: '~all (Softfail)', hint: 'Marque comme suspect' },
  { value: 'neutral', label: '?all (Neutre)', hint: 'Pas de politique' }
];

const dmarcPolicies = [
  { value: 'none', label: 'none', hint: 'Surveillance seulement' },
  { value: 'quarantine', label: 'quarantine', hint: 'Mise en spam' },
  { value: 'reject', label: 'reject', hint: 'Rejet total' }
];

const servicesToInstall = computed(() => {
  const services = ['Postfix', 'Dovecot', 'OpenDKIM', 'SPF Policy'];
  if (config.value.services.antispam === 'rspamd') services.push('Rspamd');
  if (config.value.services.antivirus) services.push('ClamAV');
  return services;
});

const dnsRecords = computed(() => {
  const domain = config.value.domain.primaryDomain || 'example.com';
  const hostname = config.value.domain.hostname || `mail.${domain}`;
  const spfPolicy = config.value.security.spf.policy === 'strict' ? '-all'
    : config.value.security.spf.policy === 'softfail' ? '~all' : '?all';

  const records = [
    {
      type: 'MX',
      name: domain,
      value: `10 ${hostname}.`,
      description: 'Enregistrement MX principal - pointe vers votre serveur mail'
    },
    {
      type: 'A',
      name: hostname,
      value: 'VOTRE_IP_SERVEUR',
      description: 'Adresse IP de votre serveur mail'
    },
    {
      type: 'TXT',
      name: domain,
      value: `v=spf1 mx a ${spfPolicy}`,
      description: 'SPF - Autorise les serveurs MX et A à envoyer des emails'
    }
  ];

  if (config.value.security.dkim.enabled) {
    records.push({
      type: 'TXT',
      name: `${config.value.security.dkim.selector}._domainkey.${domain}`,
      value: 'v=DKIM1; k=rsa; p=VOTRE_CLE_PUBLIQUE',
      description: 'DKIM - Clé publique générée lors de l\'installation'
    });
  }

  records.push({
    type: 'TXT',
    name: `_dmarc.${domain}`,
    value: `v=DMARC1; p=${config.value.security.dmarc.policy}; ${config.value.security.dmarc.rua ? `rua=mailto:${config.value.security.dmarc.rua}` : ''}`,
    description: 'DMARC - Politique de gestion des emails non conformes'
  });

  return records;
});

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0: // Architecture
      return !!config.value.architecture && config.value.architecture !== 'ha-cluster';
    case 1: // Servers
      if (config.value.architecture === 'single') {
        return !!config.value.servers[0]?.serverId;
      }
      return !!distributedConfig.value.mxInbound && !!distributedConfig.value.mailStorage;
    case 2: // Domain
      return !!config.value.domain.primaryDomain && !!config.value.domain.hostname;
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

function addDomain() {
  config.value.domain.additionalDomains.push('');
}

function removeDomain(index: number) {
  config.value.domain.additionalDomains.splice(index, 1);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function copyAllDnsRecords() {
  const text = dnsRecords.value.map(r => `${r.type}\t${r.name}\t${r.value}`).join('\n');
  navigator.clipboard.writeText(text);
}

async function startInstallation() {
  installing.value = true;

  // Build installation steps
  installationSteps.value = [
    { id: 'postfix', name: 'Installation de Postfix', status: 'pending' },
    { id: 'dovecot', name: 'Installation de Dovecot', status: 'pending' },
    { id: 'opendkim', name: 'Installation d\'OpenDKIM', status: 'pending' },
    { id: 'spf', name: 'Configuration SPF Policy', status: 'pending' }
  ];

  if (config.value.services.antispam === 'rspamd') {
    installationSteps.value.push({ id: 'rspamd', name: 'Installation de Rspamd', status: 'pending' });
  }
  if (config.value.services.antivirus) {
    installationSteps.value.push({ id: 'clamav', name: 'Installation de ClamAV', status: 'pending' });
  }
  installationSteps.value.push({ id: 'config', name: 'Configuration finale', status: 'pending' });
  installationSteps.value.push({ id: 'verify', name: 'Vérification', status: 'pending' });

  // TODO: Implement actual installation via WebSocket
  // For now, simulate installation
  for (let i = 0; i < installationSteps.value.length; i++) {
    installationSteps.value[i].status = 'running';
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    installationSteps.value[i].status = 'complete';
  }

  installComplete.value = true;
  emit('complete', config.value);
}

// Watch for hostname auto-generation
watch(() => config.value.domain.primaryDomain, (newDomain) => {
  if (newDomain && !config.value.domain.hostname) {
    config.value.domain.hostname = `mail.${newDomain}`;
  }
});
</script>
