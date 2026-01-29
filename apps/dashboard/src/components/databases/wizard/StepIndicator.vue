<!--
  @file apps/dashboard/src/components/databases/wizard/StepIndicator.vue

  @description Indicateur de progression pour les wizards multi-étapes.

  Ce composant affiche une barre de progression visuelle qui montre :
  - L'étape actuelle (cercle bleu)
  - Les étapes complétées (cercle vert avec une coche)
  - Les étapes à venir (cercle gris)
  - Des lignes de connexion entre les étapes (vertes si complétées)

  C'est un composant RÉUTILISABLE : il peut être utilisé par n'importe quel
  wizard, pas seulement celui des bases de données.

  @dependencies
  - Vue 3 : Framework frontend
  - Lucide Icons : Check (icône de coche)

  @fonctions_principales
  - Affichage visuel de la progression
  - Design responsive (titres cachés sur mobile)
-->
<script setup lang="ts">
import { Check } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **Step** - Définition d'une étape du wizard
 *
 * Chaque étape a :
 * - Un identifiant unique (id)
 * - Un titre affiché à l'utilisateur (title)
 */
interface Step {
  /** Identifiant unique de l'étape (ex: "type", "server", "config") */
  id: string
  /** Titre affiché à côté du cercle (ex: "Type de BDD", "Serveur") */
  title: string
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
defineProps<{
  /**
   * Liste des étapes du wizard
   * Exemple : [{ id: 'type', title: 'Type' }, { id: 'server', title: 'Serveur' }]
   */
  steps: Step[]

  /**
   * Index de l'étape actuelle (commence à 0)
   * - 0 = première étape
   * - steps.length - 1 = dernière étape
   */
  currentStep: number
}>()
</script>

<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    BARRE DE PROGRESSION
    ═══════════════════════════════════════════════════════════════════════════
    Conteneur avec fond légèrement gris et bordure en bas.
    Les étapes sont disposées horizontalement avec des lignes entre elles.
  -->
  <div class="px-6 py-4 bg-slate-50 border-b border-slate-200">
    <div class="flex items-center justify-between">
      <!--
        BOUCLE SUR CHAQUE ÉTAPE
        Pour chaque étape, on affiche :
        1. Le cercle avec le numéro ou la coche
        2. Le titre de l'étape
        3. Une ligne vers l'étape suivante (sauf pour la dernière)
      -->
      <template v-for="(step, index) in steps" :key="step.id">
        <div class="flex items-center gap-2">
          <!--
            CERCLE DE L'ÉTAPE
            La couleur change selon l'état :
            - Vert + coche : étape complétée (currentStep > index)
            - Bleu + numéro : étape en cours (currentStep === index)
            - Gris + numéro : étape à venir (currentStep < index)
          -->
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
            <!--
              CONTENU DU CERCLE
              - Coche (Check) si l'étape est complétée
              - Numéro de l'étape sinon (index + 1 car les index commencent à 0)
            -->
            <Check v-if="currentStep > index" class="w-4 h-4" />
            <span v-else>{{ index + 1 }}</span>
          </div>

          <!--
            TITRE DE L'ÉTAPE
            Affiché à côté du cercle, mais CACHÉ sur mobile (sm:block)
            pour gagner de la place sur les petits écrans.

            La couleur change :
            - Foncé (slate-900) si on est sur cette étape ou après
            - Clair (slate-400) si c'est une étape future
          -->
          <span
            :class="[
              'text-sm font-medium hidden sm:block',
              currentStep >= index ? 'text-slate-900' : 'text-slate-400',
            ]"
          >
            {{ step.title }}
          </span>
        </div>

        <!--
          LIGNE DE CONNEXION
          Une petite ligne horizontale qui relie une étape à la suivante.
          Elle est verte si l'étape est complétée, grise sinon.

          Note : On n'affiche pas de ligne après la dernière étape
          (index < steps.length - 1)
        -->
        <div
          v-if="index < steps.length - 1"
          :class="['flex-1 h-0.5 mx-2', currentStep > index ? 'bg-green-500' : 'bg-slate-200']"
        />
      </template>
    </div>
  </div>
</template>
