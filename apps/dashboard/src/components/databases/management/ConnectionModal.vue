<!--
  @file apps/dashboard/src/components/databases/management/ConnectionModal.vue

  @description Modal affichant les informations de connexion à une BDD.

  Ce modal s'ouvre quand l'utilisateur clique sur l'icône "œil" d'une base
  de données. Il affiche toutes les infos nécessaires pour se connecter :
  - L'URL de connexion complète (connection string)
  - Le host (localhost)
  - Le port (5432 pour PostgreSQL, 3306 pour MySQL, etc.)
  - Le nom de la base de données
  - Le nom d'utilisateur

  IMPORTANT : Le mot de passe n'est PAS affiché ici pour des raisons de
  sécurité. Il est remplacé par "***" dans l'URL de connexion.

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : X, Copy, AlertTriangle
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X, Copy, AlertTriangle } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
defineProps<{
  /** URL de connexion complète (ex: postgresql://user:***@localhost:5432/db) */
  connectionString: string
  /** Port de la base de données */
  port: string
  /** Nom de la base de données */
  database: string
  /** Nom d'utilisateur */
  username: string
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Fermer le modal */
  close: []
  /** Copier un texte dans le presse-papier */
  copy: [text: string]
}>()

const { t } = useI18n()
</script>

<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    OVERLAY DU MODAL
    ═══════════════════════════════════════════════════════════════════════════
    Fond noir semi-transparent + centrage du contenu
  -->
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg">
      <!--
        EN-TÊTE
        Titre + bouton fermer (X)
      -->
      <div class="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 class="font-semibold text-slate-900">{{ t('database.management.connectionInfo') }}</h3>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!--
        CONTENU
        URL de connexion + détails séparés + avertissement
      -->
      <div class="p-4 space-y-4">
        <!--
          URL DE CONNEXION COMPLÈTE
          Avec bouton pour copier dans le presse-papier
        -->
        <div>
          <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.connectionString') }}</label>
          <div class="flex items-center gap-2">
            <code class="flex-1 p-2 bg-slate-100 rounded text-sm text-slate-700 break-all">
              {{ connectionString }}
            </code>
            <button
              @click="emit('copy', connectionString)"
              class="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
            >
              <Copy class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!--
          DÉTAILS SÉPARÉS
          Host, port, nom de la BDD, username
        -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.host') }}</label>
            <span class="text-slate-900">localhost</span>
          </div>
          <div>
            <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.port') }}</label>
            <span class="text-slate-900">{{ port }}</span>
          </div>
          <div>
            <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.database') }}</label>
            <span class="text-slate-900">{{ database }}</span>
          </div>
          <div>
            <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.username') }}</label>
            <span class="text-slate-900">{{ username }}</span>
          </div>
        </div>

        <!--
          AVERTISSEMENT SÉCURITÉ
          Rappelle que le mot de passe n'est pas affiché
        -->
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p class="text-sm text-amber-700">{{ t('database.management.connectionWarning') }}</p>
          </div>
        </div>
      </div>

      <!--
        PIED DE PAGE
        Bouton fermer
      -->
      <div class="p-4 border-t border-slate-200 flex justify-end">
        <button
          @click="emit('close')"
          class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
        >
          {{ t('common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>
