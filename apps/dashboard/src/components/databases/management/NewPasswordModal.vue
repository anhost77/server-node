<!--
  @file apps/dashboard/src/components/databases/management/NewPasswordModal.vue

  @description Modal affichant le nouveau mot de passe après reset/création.

  Ce modal s'affiche APRÈS une création de BDD ou un reset de mot de passe.
  Il montre le nouveau mot de passe généré avec un bouton pour le copier.

  TRÈS IMPORTANT : Ce mot de passe ne sera PLUS JAMAIS affiché après
  fermeture de ce modal ! L'utilisateur DOIT le noter ou le copier
  immédiatement.

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : X, Copy, CheckCircle2, AlertTriangle
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X, Copy, CheckCircle2, AlertTriangle } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
defineProps<{
  /** Le nouveau mot de passe à afficher */
  password: string
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Fermer le modal */
  close: []
  /** Copier le mot de passe dans le presse-papier */
  copy: [text: string]
}>()

const { t } = useI18n()
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
        EN-TÊTE SUCCÈS
        Icône verte + titre de succès
      -->
      <div class="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 class="font-semibold text-green-700 flex items-center gap-2">
          <CheckCircle2 class="w-5 h-5" />
          {{ t('database.management.passwordResetSuccess') }}
        </h3>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!--
        CONTENU
      -->
      <div class="p-4 space-y-4">
        <!--
          AFFICHAGE DU MOT DE PASSE
          En gros, avec bouton copier, et classe select-all pour faciliter la sélection
        -->
        <div class="p-4 bg-slate-100 rounded-lg">
          <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.newPassword') }}</label>
          <div class="flex items-center gap-2">
            <code class="flex-1 p-2 bg-white rounded text-lg font-mono text-slate-900 select-all">
              {{ password }}
            </code>
            <button
              @click="emit('copy', password)"
              class="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
            >
              <Copy class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!--
          AVERTISSEMENT CRITIQUE
          Fond rouge pour attirer l'attention : le password ne sera plus affiché !
        -->
        <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p class="text-sm text-red-700">{{ t('database.management.savePasswordWarning') }}</p>
          </div>
        </div>
      </div>

      <!--
        PIED DE PAGE
        Bouton "J'ai compris" pour fermer
      -->
      <div class="p-4 border-t border-slate-200 flex justify-end">
        <button
          @click="emit('close')"
          class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
        >
          {{ t('database.management.understood') }}
        </button>
      </div>
    </div>
  </div>
</template>
