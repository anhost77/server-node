/**
 * @file apps/agent/src/infrastructure.ts
 * @description Point d'entrée rétrocompatible pour le module infrastructure.
 * Ce fichier réexporte tout depuis le nouveau module refactorisé.
 *
 * Le module a été refactorisé en plusieurs fichiers pour améliorer la maintenabilité :
 * - infrastructure/types.ts : Types et interfaces
 * - infrastructure/helpers.ts : Fonctions utilitaires
 * - infrastructure/credentials.ts : Gestion des credentials
 * - infrastructure/detection/ : Détection des composants installés
 * - infrastructure/installers/ : Installation des composants
 *
 * @see apps/agent/src/infrastructure/index.ts pour l'implémentation principale
 */

// Re-export everything from the refactored module
export * from './infrastructure/index.js';
