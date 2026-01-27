/**
 * @file apps/agent/src/infrastructure/detection/index.ts
 * @description Point d'entrée pour les fonctions de détection.
 * Exporte toutes les fonctions de détection des runtimes, databases, services et système.
 */

export { detectRuntimes, getLatestVersion } from './runtimes.js';
export { detectDatabases } from './databases.js';
export { detectServices } from './services.js';
export { getSystemInfo } from './system.js';
