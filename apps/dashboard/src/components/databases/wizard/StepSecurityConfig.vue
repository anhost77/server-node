<!--
  @file apps/dashboard/src/components/databases/wizard/StepSecurityConfig.vue

  @description Étape 4 du wizard : Configuration de sécurité automatique.

  Ce composant informe l'utilisateur des mesures de sécurité qui seront
  appliquées AUTOMATIQUEMENT lors de l'installation de la BDD.

  Il n'y a pas de formulaire ici - c'est une étape informative qui
  rassure l'utilisateur sur le fait que les bonnes pratiques de
  sécurité seront suivies.

  Les mesures varient selon le type de BDD :
  - PostgreSQL : Authentification SCRAM-SHA-256
  - MySQL : Suppression utilisateur anonyme, désactivation root distant
  - Redis : Mode protégé activé

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : ShieldCheck (bouclier), Check (coche)

  @fonctions_principales
  - Affichage conditionnel des mesures selon le type de BDD
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ShieldCheck, Check } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **DbType** - Types de bases de données supportés
 */
type DbType = 'postgresql' | 'mysql' | 'redis' | 'mongodb'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
defineProps<{
  /** Type de BDD sélectionné - détermine quelles mesures afficher */
  databaseType: DbType
}>()

const { t } = useI18n()
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
      Titre et description pour expliquer le but de cette étape
    -->
    <div>
      <h3 class="text-lg font-semibold text-slate-900 mb-2">
        {{ t('database.wizard.security.title') }}
      </h3>
      <p class="text-sm text-slate-600">{{ t('database.wizard.security.description') }}</p>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      LISTE DES MESURES DE SÉCURITÉ AUTOMATIQUES
      ═══════════════════════════════════════════════════════════════════════════
      Cette section montre toutes les mesures de sécurité qui seront appliquées
      automatiquement. Le fond vert rassure l'utilisateur sur le fait que
      la sécurité est prise au sérieux.
    -->
    <div class="p-4 bg-green-50 border border-green-200 rounded-xl">
      <!--
        EN-TÊTE AVEC ICÔNE BOUCLIER
        Montre clairement que c'est une section sécurité
      -->
      <div class="flex items-center gap-2 mb-3">
        <ShieldCheck class="w-5 h-5 text-green-600" />
        <h4 class="font-medium text-green-900">{{ t('database.wizard.security.autoConfig') }}</h4>
      </div>

      <!--
        LISTE DES MESURES
        Chaque mesure a une coche verte pour montrer qu'elle sera appliquée
      -->
      <div class="space-y-2">
        <!--
          MESURES COMMUNES À TOUTES LES BDD
          Ces mesures s'appliquent quel que soit le type de BDD
        -->

        <!--
          Bind localhost : La BDD n'écoute que sur 127.0.0.1
          Cela empêche les connexions depuis l'extérieur du serveur.
          C'est une mesure de sécurité fondamentale.
        -->
        <div class="flex items-center gap-2">
          <Check class="w-4 h-4 text-green-600" />
          <span class="text-sm text-green-800">{{ t('database.wizard.security.bindLocalhost') }}</span>
        </div>

        <!--
          Mot de passe fort : On génère un mot de passe aléatoire
          de 32 caractères avec lettres, chiffres et symboles.
        -->
        <div class="flex items-center gap-2">
          <Check class="w-4 h-4 text-green-600" />
          <span class="text-sm text-green-800">{{ t('database.wizard.security.strongPassword') }}</span>
        </div>

        <!--
          ═══════════════════════════════════════════════════════════════════════
          MESURES SPÉCIFIQUES À MYSQL
          ═══════════════════════════════════════════════════════════════════════
          MySQL a des mesures supplémentaires issues de mysql_secure_installation
        -->
        <template v-if="databaseType === 'mysql'">
          <!--
            Suppression utilisateur anonyme :
            Par défaut, MySQL a un utilisateur sans nom qui peut se connecter.
            C'est un risque de sécurité qu'on supprime.
          -->
          <div class="flex items-center gap-2">
            <Check class="w-4 h-4 text-green-600" />
            <span class="text-sm text-green-800">{{ t('database.wizard.security.removeAnonymous') }}</span>
          </div>

          <!--
            Désactivation root distant :
            L'utilisateur root ne peut se connecter qu'en local.
            Cela empêche les attaques brute-force depuis Internet.
          -->
          <div class="flex items-center gap-2">
            <Check class="w-4 h-4 text-green-600" />
            <span class="text-sm text-green-800">{{ t('database.wizard.security.disableRemoteRoot') }}</span>
          </div>
        </template>

        <!--
          ═══════════════════════════════════════════════════════════════════════
          MESURES SPÉCIFIQUES À POSTGRESQL
          ═══════════════════════════════════════════════════════════════════════
        -->
        <!--
          Authentification SCRAM-SHA-256 :
          C'est la méthode d'authentification la plus sécurisée de PostgreSQL.
          Elle remplace l'ancienne méthode MD5 moins sécurisée.
        -->
        <div v-if="databaseType === 'postgresql'" class="flex items-center gap-2">
          <Check class="w-4 h-4 text-green-600" />
          <span class="text-sm text-green-800">{{ t('database.wizard.security.scramAuth') }}</span>
        </div>

        <!--
          ═══════════════════════════════════════════════════════════════════════
          MESURES SPÉCIFIQUES À REDIS
          ═══════════════════════════════════════════════════════════════════════
        -->
        <!--
          Mode protégé :
          Redis refuse les connexions si aucun mot de passe n'est configuré
          et que le serveur est accessible depuis le réseau.
          C'est une protection contre les erreurs de configuration.
        -->
        <div v-if="databaseType === 'redis'" class="flex items-center gap-2">
          <Check class="w-4 h-4 text-green-600" />
          <span class="text-sm text-green-800">{{ t('database.wizard.security.protectedMode') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
