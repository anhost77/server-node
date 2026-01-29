<!--
  @file apps/dashboard/src/components/databases/management/ResetPasswordModal.vue

  @description Modal de réinitialisation du mot de passe d'une BDD.

  Ce modal s'ouvre quand l'utilisateur clique sur l'icône "clé" d'une instance.
  Il permet de :
  - Voir quelle BDD va être modifiée
  - Confirmer la réinitialisation

  Le mot de passe est TOUJOURS généré automatiquement de manière sécurisée.
  On ne permet PAS de saisir un mot de passe personnalisé pour des raisons de
  sécurité (éviter les mots de passe faibles, ne pas donner l'impression qu'on
  stocke les mots de passe).

  ATTENTION : Cette action change le mot de passe de la base de données.
  Les applications qui utilisent cette BDD devront être mises à jour !

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : X, Key, Loader2, AlertTriangle
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X, Key, Loader2, AlertTriangle } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **DatabaseInstance** - Infos de l'instance dont on change le mot de passe
 */
interface DatabaseInstance {
  /** Nom de la base de données */
  name: string
  /** Utilisateur propriétaire */
  user?: string
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Type de BDD (postgresql, mysql, redis, mongodb) */
  dbType: string
  /** Instance concernée */
  instance: DatabaseInstance | null
  /** Opération en cours ? */
  loading: boolean
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Fermer le modal */
  close: []
  /** Confirmer le reset (mot de passe toujours auto-généré) */
  confirm: []
}>()

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FONCTIONS D'AFFICHAGE
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **getColorClass()** - Couleur selon le type de BDD
 */
function getColorClass(type: string): string {
  const colors: Record<string, string> = {
    postgresql: 'bg-blue-100 text-blue-600',
    mysql: 'bg-orange-100 text-orange-600',
    redis: 'bg-red-100 text-red-600',
    mongodb: 'bg-green-100 text-green-600',
  }
  return colors[type] || 'bg-slate-100 text-slate-600'
}

/**
 * **getIcon()** - Abréviation du type de BDD
 */
function getIcon(type: string): string {
  const icons: Record<string, string> = {
    postgresql: 'PG',
    mysql: 'My',
    redis: 'Rd',
    mongodb: 'Mg',
  }
  return icons[type] || 'DB'
}

/**
 * **getName()** - Nom complet du type de BDD
 */
function getName(type: string): string {
  const names: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL / MariaDB',
    redis: 'Redis',
    mongodb: 'MongoDB',
  }
  return names[type] || type
}

/**
 * **handleConfirm()** - Confirme la réinitialisation
 *
 * Le mot de passe sera généré automatiquement côté serveur.
 */
function handleConfirm() {
  emit('confirm')
}
</script>

<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    OVERLAY DU MODAL
    ═══════════════════════════════════════════════════════════════════════════
  -->
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
      <!--
        EN-TÊTE
      -->
      <div class="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 class="font-semibold text-slate-900">{{ t('database.management.resetPasswordTitle') }}</h3>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!--
        CONTENU
      -->
      <div class="p-4 space-y-4">
        <!--
          APERÇU DE LA BDD CONCERNÉE
          Montre le type + nom de l'instance
        -->
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          <div :class="['w-8 h-8 rounded-lg flex items-center justify-center', getColorClass(dbType)]">
            <span class="text-xs font-bold">{{ getIcon(dbType) }}</span>
          </div>
          <div>
            <span class="font-medium text-slate-900">{{ instance?.name }}</span>
            <p class="text-xs text-slate-500">{{ getName(dbType) }}</p>
          </div>
        </div>

        <!--
          AVERTISSEMENT
          Prévient que les applications devront être mises à jour
        -->
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p class="text-sm text-amber-700">{{ t('database.management.resetPasswordWarning') }}</p>
          </div>
        </div>

        <!--
          INFO : Mot de passe auto-généré
          Rappelle que le password sera généré automatiquement
        -->
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div class="flex items-start gap-2">
            <Key class="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p class="text-sm text-emerald-700">{{ t('database.management.passwordAutoGenerated') }}</p>
          </div>
        </div>
      </div>

      <!--
        PIED DE PAGE
        Boutons Annuler et Réinitialiser
      -->
      <div class="p-4 border-t border-slate-200 flex justify-end gap-3">
        <button
          @click="emit('close')"
          class="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          @click="handleConfirm"
          :disabled="loading"
          class="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <!-- Spinner si en cours -->
          <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
          <Key v-else class="w-4 h-4" />
          {{ t('database.management.resetPassword') }}
        </button>
      </div>
    </div>
  </div>
</template>
