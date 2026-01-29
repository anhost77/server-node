<!--
  @file apps/dashboard/src/components/databases/wizard/StepServerSelection.vue

  @description Étape 2 du wizard : Sélection du serveur cible.

  Ce composant permet à l'utilisateur de choisir sur quel serveur
  la base de données sera installée.

  Il affiche :
  - Un menu déroulant avec tous les serveurs disponibles (en ligne)
  - Un résumé de ce qui sera installé une fois le serveur sélectionné

  IMPORTANT : Seuls les serveurs ONLINE sont affichés. Les serveurs
  hors ligne ne peuvent pas recevoir d'installation.

  @dependencies
  - Vue 3 : Framework frontend avec computed()
  - vue-i18n : Traductions
  - Lucide Icons : CheckCircle2 (icône de validation)

  @fonctions_principales
  - availableServers : Liste filtrée des serveurs en ligne
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckCircle2 } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **ServerInfo** - Informations sur un serveur
 *
 * Représente un serveur connecté à la plateforme.
 * Seuls les serveurs avec online=true peuvent être sélectionnés.
 */
interface ServerInfo {
  /** Identifiant unique du serveur */
  id: string
  /** Nom d'hôte (ex: "srv-prod-01") */
  hostname: string
  /** Adresse IP (ex: "192.168.1.100") */
  ip: string
  /** Alias optionnel donné par l'utilisateur (ex: "Serveur Production") */
  alias?: string
  /** Le serveur est-il actuellement en ligne ? */
  online: boolean
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Liste de tous les serveurs (en ligne et hors ligne) */
  servers: ServerInfo[]

  /**
   * ID du serveur actuellement sélectionné.
   * Vide si aucun serveur n'est sélectionné.
   * Ce composant utilise v-model.
   */
  modelValue: string

  /**
   * Nom de la base de données sélectionnée à l'étape précédente.
   * Utilisé pour afficher le résumé (ex: "PostgreSQL Server")
   */
  databaseName: string
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /**
   * Émis quand l'utilisateur sélectionne un serveur dans le menu déroulant.
   * Le parent reçoit l'ID du serveur sélectionné.
   */
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPRIÉTÉS CALCULÉES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **availableServers** - Liste des serveurs disponibles pour l'installation
 *
 * Filtre la liste des serveurs pour ne garder que ceux qui sont EN LIGNE.
 * On ne peut pas installer une BDD sur un serveur hors ligne !
 */
const availableServers = computed(() => props.servers.filter(s => s.online))
</script>

<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    CONTENEUR PRINCIPAL
    ═══════════════════════════════════════════════════════════════════════════
  -->
  <div class="space-y-6">
    <!--
      EN-TÊTE DE L'ÉTAPE
      Titre et description pour guider l'utilisateur
    -->
    <div>
      <h3 class="text-lg font-semibold text-slate-900 mb-2">
        {{ t('database.wizard.server.title') }}
      </h3>
      <p class="text-sm text-slate-600">{{ t('database.wizard.server.description') }}</p>
    </div>

    <!--
      MENU DÉROULANT DE SÉLECTION
      Affiche tous les serveurs en ligne avec leur alias/hostname et IP
    -->
    <label class="block">
      <span class="text-sm font-medium text-slate-700">{{ t('database.wizard.server.selectServer') }}</span>
      <select
        :value="modelValue"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
        class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <!-- Option par défaut "Choisir un serveur" -->
        <option value="">{{ t('database.wizard.server.choose') }}</option>

        <!--
          LISTE DES SERVEURS
          On affiche l'alias s'il existe, sinon le hostname.
          L'IP est toujours affichée entre parenthèses pour identification.
        -->
        <option v-for="server in availableServers" :key="server.id" :value="server.id">
          {{ server.alias || server.hostname }} ({{ server.ip }})
        </option>
      </select>
    </label>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      RÉSUMÉ DE L'INSTALLATION
      ═══════════════════════════════════════════════════════════════════════════
      Ce bloc n'apparaît QUE si un serveur est sélectionné.
      Il montre à l'utilisateur ce qui sera installé sur le serveur.
    -->
    <div v-if="modelValue" class="p-4 bg-blue-50 rounded-xl">
      <h4 class="font-medium text-blue-900 mb-2">
        {{ t('database.wizard.server.whatWillBeInstalled') }}
      </h4>

      <!--
        LISTE DE CE QUI SERA INSTALLÉ
        Chaque élément a une coche verte pour rassurer l'utilisateur
      -->
      <div class="space-y-2">
        <!-- Le serveur de BDD lui-même (ex: "PostgreSQL Server") -->
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-green-500" />
          <span class="text-sm text-slate-700">{{ databaseName }} Server</span>
        </div>

        <!-- Les outils client (pour se connecter à la BDD) -->
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-green-500" />
          <span class="text-sm text-slate-700">{{ t('database.wizard.server.clientTools') }}</span>
        </div>

        <!-- Configuration de sécurité (pare-feu, authentification...) -->
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-green-500" />
          <span class="text-sm text-slate-700">{{ t('database.wizard.server.securityConfig') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
