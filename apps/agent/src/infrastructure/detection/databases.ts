/**
 * @file apps/agent/src/infrastructure/detection/databases.ts
 * @description Détection des bases de données installées sur le serveur.
 * Ce fichier scanne le système pour identifier les SGBD disponibles
 * (PostgreSQL, MySQL/MariaDB, Redis, MongoDB) et leur état.
 *
 * @fonctions_principales
 * - detectDatabases() : Détecte toutes les bases de données installées
 */

import type { DatabaseInfo } from '../types.js';
import { getCommandVersion, isServiceRunning } from '../helpers.js';

/**
 * **detectDatabases()** - Détecte les bases de données installées
 *
 * Vérifie la présence de PostgreSQL, MySQL, Redis et MongoDB,
 * récupère leurs versions et vérifie si les services sont actifs.
 *
 * @returns Liste des informations sur chaque base de données
 */
export async function detectDatabases(): Promise<DatabaseInfo[]> {
    const databases: DatabaseInfo[] = [
        { type: 'postgresql', installed: false, running: false },
        { type: 'mysql', installed: false, running: false },
        { type: 'redis', installed: false, running: false },
        { type: 'mongodb', installed: false, running: false }
    ];

    // Check PostgreSQL
    const pgVersion = await getCommandVersion('psql', ['--version']);
    if (pgVersion) {
        databases[0].installed = true;
        databases[0].version = pgVersion;
        databases[0].running = await isServiceRunning('postgresql');
    }

    // Check MySQL/MariaDB
    const mysqlVersion = await getCommandVersion('mysql', ['--version']);
    if (mysqlVersion) {
        databases[1].installed = true;
        databases[1].version = mysqlVersion;
        databases[1].running = await isServiceRunning('mysql');
    }

    // Check Redis
    const redisVersion = await getCommandVersion('redis-server', ['--version']);
    if (redisVersion) {
        databases[2].installed = true;
        databases[2].version = redisVersion;
        databases[2].running = await isServiceRunning('redis');
    }

    // Check MongoDB
    const mongoVersion = await getCommandVersion('mongod', ['--version']);
    if (mongoVersion) {
        databases[3].installed = true;
        databases[3].version = mongoVersion;
        databases[3].running = await isServiceRunning('mongod');
    }

    return databases;
}
