<!--
  @file apps/dashboard/src/components/databases/management/ServerSelect.vue

  @description Composant de sélection du serveur pour la gestion des BDD.

  Ce composant affiche une liste de serveurs disponibles sous forme de cartes
  cliquables. L'utilisateur choisit sur quel serveur il veut gérer les bases
  de données. Seuls les serveurs EN LIGNE sont affichés (les serveurs hors
  ligne ne peuvent pas être gérés à distance).

  C'est la première étape du wizard de gestion : on doit d'abord savoir
  SUR QUEL SERVEUR on veut travailler avant de voir les BDD installées.

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions français/anglais
  - Lucide Icons : Icônes (Server, ChevronRight)

  @fonctions_principales
  - availableServers : Filtre pour n'afficher que les serveurs en ligne
  - emit('select') : Signal envoyé au parent quand un serveur est choisi
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Server, ChevronRight } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **ServerInfo** - Informations d'un serveur
 *
 * Contient toutes les infos nécessaires pour afficher un serveur
 * dans la liste de sélection.
 */
interface ServerInfo {
  /** Identifiant unique du serveur */
  id: string
  /** Nom d'hôte (ex: "srv-prod-01") */
  hostname: string
  /** Adresse IP du serveur */
  ip: string
  /** Nom personnalisé donné par l'utilisateur (optionnel) */
  alias?: string
  /** Le serveur est-il actuellement en ligne ? */
  online: boolean
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS (données reçues du parent)
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Liste de tous les serveurs (en ligne et hors ligne) */
  servers: ServerInfo[]
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Émis quand l'utilisateur clique sur un serveur */
  select: [server: ServerInfo]
}>()

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPRIÉTÉS CALCULÉES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **availableServers** - Liste des serveurs disponibles (en ligne uniquement)
 *
 * On ne peut pas gérer les BDD d'un serveur qui est hors ligne !
 * Cette propriété filtre automatiquement pour ne garder que les serveurs
 * avec online = true.
 */
const availableServers = computed(() => props.servers.filter(s => s.online))
</script>

<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    CONTENU PRINCIPAL
    ═══════════════════════════════════════════════════════════════════════════
    Affiche le titre et la grille de serveurs cliquables.
  -->
  <div class="p-6">
    <!-- Titre de la section -->
    <h3 class="text-lg font-semibold text-slate-900 mb-4">
      {{ t('database.management.selectServer') }}
    </h3>

    <!-- Grille des serveurs disponibles -->
    <div class="grid gap-3">
      <!--
        CARTE SERVEUR
        Chaque serveur est affiché comme une carte cliquable.
        Au clic, on émet l'événement 'select' avec les infos du serveur.
      -->
      <button
        v-for="server in availableServers"
        :key="server.id"
        @click="emit('select', server)"
        class="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
      >
        <!-- Icône serveur dans un cercle vert -->
        <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Server class="w-5 h-5 text-emerald-600" />
        </div>

        <!-- Infos du serveur : nom + IP -->
        <div class="flex-1">
          <span class="font-medium text-slate-900">{{ server.alias || server.hostname }}</span>
          <p class="text-sm text-slate-500">{{ server.ip }}</p>
        </div>

        <!-- Flèche indiquant qu'on peut cliquer -->
        <ChevronRight class="w-5 h-5 text-slate-400" />
      </button>
    </div>
  </div>
</template>
