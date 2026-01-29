/**
 * @file apps/agent/src/infrastructure/installers/databases.ts
 * @description Configuration et gestion des bases de données.
 * Ce fichier contient les fonctions pour installer, configurer et supprimer
 * les bases de données supportées (PostgreSQL, MySQL/MariaDB, Redis, MongoDB).
 *
 * @security
 * - Les mots de passe sont générés avec crypto.randomBytes
 * - Les credentials root sont stockés de manière sécurisée
 * - Les connection strings ne sont JAMAIS loggés
 *
 * @fonctions_principales
 * - configurePostgresql() : Configure PostgreSQL avec sécurité
 * - configureMysql() : Configure MariaDB avec mysql_secure_installation
 * - configureRedis() : Configure Redis avec mot de passe
 * - removeDatabase() : Supprime une base de données
 * - reconfigureDatabase() : Recrée les credentials d'une database
 */

import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import type { LogFn, DatabaseType, DbSecurityOptions } from '../types.js';
import { runCommand, runCommandSilent, commandExists, sleep, runAsUser } from '../helpers.js';
import { storeDbCredentials, getDbCredentials, deleteDbCredentials } from '../credentials.js';

type DatabaseConfigurator = (dbName: string, opts: DbSecurityOptions, onLog: LogFn) => Promise<string>;

/**
 * Map des configurateurs de databases
 */
export const databaseConfigurators: Record<Exclude<DatabaseType, 'mongodb'>, DatabaseConfigurator> = {
    postgresql: configurePostgresql,
    mysql: configureMysql,
    redis: (_, opts, onLog) => configureRedis(opts, onLog)
};

// ============================================
// POSTGRESQL
// ============================================

/**
 * **configurePostgresql()** - Configure PostgreSQL avec sécurité
 *
 * Installe PostgreSQL si nécessaire, applique les options de sécurité,
 * crée un utilisateur et une base de données dédiés.
 *
 * @returns La connection string (sans la logger !)
 */
async function configurePostgresql(
    dbName: string,
    opts: DbSecurityOptions,
    onLog: LogFn
): Promise<string> {
    // Generate secure credentials
    const password = crypto.randomBytes(24).toString('base64url');
    const user = `${dbName}_user`;

    // Install if not present
    const isInstalled = await commandExists('psql');
    if (!isInstalled) {
        await runCommand('apt-get', ['update'], onLog);
        await runCommand('apt-get', ['install', '-y', 'postgresql', 'postgresql-contrib'], onLog);
        await runCommand('systemctl', ['enable', 'postgresql'], onLog);
        await runCommand('systemctl', ['start', 'postgresql'], onLog);
        // Wait for PostgreSQL to start
        await sleep(2000);
    }

    // Apply security options
    if (opts.bindLocalhost) {
        onLog(`🔒 Configuring PostgreSQL to listen only on localhost...\n`, 'stdout');
        await configurePostgresqlListenAddress(onLog);
    }

    if (opts.configureHba) {
        onLog(`🔒 Configuring pg_hba.conf for secure authentication...\n`, 'stdout');
        await configurePostgresqlHba(onLog);
    }

    // Create user and database
    onLog(`Creating user ${user}...\n`, 'stdout');
    const createUser = runAsUser('postgres', `psql -c "CREATE USER ${user} WITH PASSWORD '${password}';"`);
    await runCommandSilent(createUser.cmd, createUser.args);

    onLog(`Creating database ${dbName}...\n`, 'stdout');
    const createDb = runAsUser('postgres', `psql -c "CREATE DATABASE ${dbName} OWNER ${user};"`);
    await runCommandSilent(createDb.cmd, createDb.args);

    onLog(`Granting privileges...\n`, 'stdout');
    const grantPrivs = runAsUser('postgres', `psql -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${user};"`);
    await runCommandSilent(grantPrivs.cmd, grantPrivs.args);

    return `postgresql://${user}:${password}@localhost:5432/${dbName}`;
}

async function configurePostgresqlListenAddress(onLog: LogFn): Promise<void> {
    const configPath = '/etc/postgresql';
    try {
        const versions = fs.readdirSync(configPath);
        for (const version of versions) {
            const confFile = `${configPath}/${version}/main/postgresql.conf`;
            if (fs.existsSync(confFile)) {
                let config = fs.readFileSync(confFile, 'utf-8');
                if (!config.includes("listen_addresses = 'localhost'")) {
                    config = config.replace(/^#?listen_addresses\s*=.*$/m, "listen_addresses = 'localhost'");
                    fs.writeFileSync(confFile, config);
                    onLog(`  Updated ${confFile}\n`, 'stdout');
                }
            }
        }
    } catch (e) {
        onLog(`  Warning: Could not update postgresql.conf\n`, 'stderr');
    }
}

async function configurePostgresqlHba(onLog: LogFn): Promise<void> {
    const configPath = '/etc/postgresql';
    try {
        const versions = fs.readdirSync(configPath);
        for (const version of versions) {
            const hbaFile = `${configPath}/${version}/main/pg_hba.conf`;
            if (fs.existsSync(hbaFile)) {
                let hba = fs.readFileSync(hbaFile, 'utf-8');
                if (hba.includes('trust') && !hba.includes('# trust disabled')) {
                    hba = hba.replace(/local\s+all\s+all\s+trust/g, 'local   all             all                                     scram-sha-256');
                    hba = hba.replace(/host\s+all\s+all\s+127\.0\.0\.1\/32\s+trust/g, 'host    all             all             127.0.0.1/32            scram-sha-256');
                    hba = hba.replace(/host\s+all\s+all\s+::1\/128\s+trust/g, 'host    all             all             ::1/128                 scram-sha-256');
                    fs.writeFileSync(hbaFile, hba);
                    onLog(`  Updated ${hbaFile}\n`, 'stdout');
                }
            }
        }
        await runCommand('systemctl', ['reload', 'postgresql'], onLog);
    } catch (e) {
        onLog(`  Warning: Could not update pg_hba.conf\n`, 'stderr');
    }
}

// ============================================
// MYSQL/MARIADB
// ============================================

/**
 * **configureMysql()** - Configure MariaDB avec sécurité
 *
 * Installe MariaDB si nécessaire, applique mysql_secure_installation,
 * crée un utilisateur et une base de données dédiés.
 *
 * @returns La connection string (sans la logger !)
 */
async function configureMysql(
    dbName: string,
    opts: DbSecurityOptions,
    onLog: LogFn
): Promise<string> {
    const password = crypto.randomBytes(24).toString('base64url');
    const user = `${dbName}_user`;

    // Check if MySQL is already secured
    let storedCreds = getDbCredentials('mysql');

    // Install if not present
    const isInstalled = await commandExists('mysql');
    if (!isInstalled) {
        onLog(`📥 Installing MariaDB (MySQL-compatible)...\n`, 'stdout');
        await runCommand('apt-get', ['update'], onLog);
        await runCommand('apt-get', ['install', '-y', 'default-mysql-server', 'default-mysql-client'], onLog);
        await runCommand('systemctl', ['enable', 'mariadb'], onLog);
        await runCommand('systemctl', ['start', 'mariadb'], onLog);
        await sleep(2000);

        // Apply security options
        storedCreds = await applyMysqlSecurity(opts, onLog);
    } else if (!storedCreds) {
        // MySQL est installé mais pas de credentials stockées
        // Cela peut arriver après une désinstallation/réinstallation
        // On applique la sécurité pour définir un nouveau mot de passe root
        onLog(`🔐 MySQL déjà installé mais pas de credentials. Application de la sécurité...\n`, 'stdout');
        storedCreds = await applyMysqlSecurity(opts, onLog);
    }

    // Use stored root credentials for operations
    const mysqlAuth = storedCreds ? ['-u', 'root', `-p${storedCreds.rootPassword}`] : ['-u', 'root'];

    // Create user and database
    onLog(`Creating database ${dbName}...\n`, 'stdout');
    await runCommand('mysql', [...mysqlAuth, '-e', `CREATE DATABASE IF NOT EXISTS ${dbName};`], onLog);

    onLog(`Creating user ${user}...\n`, 'stdout');
    await runCommand('mysql', [...mysqlAuth, '-e', `CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${password}';`], onLog);

    onLog(`Granting privileges...\n`, 'stdout');
    await runCommand('mysql', [...mysqlAuth, '-e', `GRANT ALL PRIVILEGES ON ${dbName}.* TO '${user}'@'localhost';`], onLog);
    await runCommand('mysql', [...mysqlAuth, '-e', 'FLUSH PRIVILEGES;'], onLog);

    return `mysql://${user}:${password}@localhost:3306/${dbName}`;
}

async function applyMysqlSecurity(
    opts: DbSecurityOptions,
    onLog: LogFn
): Promise<{ rootPassword: string; createdAt: string } | null> {
    const rootPassword = opts.setRootPassword ? crypto.randomBytes(24).toString('base64url') : '';

    if (opts.setRootPassword) {
        onLog(`🔒 Setting root password...\n`, 'stdout');
        await runCommand('mariadb-admin', ['-u', 'root', 'password', rootPassword], onLog);
    }

    const mysqlAuthInit = opts.setRootPassword ? ['-u', 'root', `-p${rootPassword}`] : ['-u', 'root'];

    if (opts.removeAnonymousUsers) {
        onLog(`🔒 Removing anonymous users...\n`, 'stdout');
        await runCommand('mysql', [...mysqlAuthInit, '-e', `DELETE FROM mysql.user WHERE User='';`], onLog);
    }

    if (opts.disableRemoteRoot) {
        onLog(`🔒 Disabling remote root login...\n`, 'stdout');
        await runCommand('mysql', [...mysqlAuthInit, '-e', `DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');`], onLog);
    }

    if (opts.removeTestDb) {
        onLog(`🔒 Removing test database...\n`, 'stdout');
        await runCommand('mysql', [...mysqlAuthInit, '-e', `DROP DATABASE IF EXISTS test;`], onLog);
        await runCommand('mysql', [...mysqlAuthInit, '-e', `DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';`], onLog);
    }

    if (opts.bindLocalhost) {
        onLog(`🔒 Configuring MySQL to listen only on localhost...\n`, 'stdout');
        const configPaths = ['/etc/mysql/mariadb.conf.d/50-server.cnf', '/etc/mysql/my.cnf'];
        for (const configPath of configPaths) {
            if (fs.existsSync(configPath)) {
                let config = fs.readFileSync(configPath, 'utf-8');
                if (!config.includes('bind-address = 127.0.0.1')) {
                    config = config.replace(/^#?bind-address\s*=.*$/m, 'bind-address = 127.0.0.1');
                    fs.writeFileSync(configPath, config);
                    onLog(`  Updated ${configPath}\n`, 'stdout');
                }
                break;
            }
        }
    }

    await runCommand('mysql', [...mysqlAuthInit, '-e', 'FLUSH PRIVILEGES;'], onLog);

    // Store credentials securely if root password was set
    if (opts.setRootPassword) {
        const creds = { rootPassword, createdAt: new Date().toISOString() };
        storeDbCredentials('mysql', creds);
        onLog(`✅ MySQL secured. Root credentials stored in ~/.server-flow/credentials/\n`, 'stdout');

        // Restart MySQL to apply bind-address change
        if (opts.bindLocalhost) {
            await runCommand('systemctl', ['restart', 'mariadb'], onLog);
            await sleep(2000);
        }

        return creds;
    }

    return null;
}

// ============================================
// REDIS
// ============================================

/**
 * **configureRedis()** - Configure Redis avec mot de passe
 *
 * Installe Redis si nécessaire, configure un mot de passe
 * et applique les options de sécurité.
 *
 * @returns La connection string (sans la logger !)
 */
async function configureRedis(opts: DbSecurityOptions, onLog: LogFn): Promise<string> {
    const password = crypto.randomBytes(24).toString('base64url');

    // Install if not present
    const isInstalled = await commandExists('redis-server');
    if (!isInstalled) {
        onLog(`📥 Installing Redis...\n`, 'stdout');
        await runCommand('apt-get', ['update'], onLog);
        await runCommand('apt-get', ['install', '-y', 'redis-server'], onLog);
        await runCommand('systemctl', ['enable', 'redis-server'], onLog);
    }

    // Configure Redis security options
    const configPath = '/etc/redis/redis.conf';
    if (fs.existsSync(configPath)) {
        let config = fs.readFileSync(configPath, 'utf-8');

        // Set password (requirepass)
        onLog(`🔒 Setting Redis password...\n`, 'stdout');
        config = config.replace(/^#?requirepass\s+.*$/m, '');
        config += `\nrequirepass ${password}\n`;

        if (opts.bindLocalhost) {
            onLog(`🔒 Configuring Redis to listen only on localhost...\n`, 'stdout');
            config = config.replace(/^#?bind\s+.*$/m, 'bind 127.0.0.1 ::1');
        }

        if (opts.enableProtectedMode) {
            onLog(`🔒 Enabling Redis protected mode...\n`, 'stdout');
            config = config.replace(/^#?protected-mode\s+.*$/m, 'protected-mode yes');
        }

        fs.writeFileSync(configPath, config);
        onLog(`  Updated ${configPath}\n`, 'stdout');
    }

    await runCommand('systemctl', ['restart', 'redis-server'], onLog);

    return `redis://:${password}@localhost:6379`;
}

// ============================================
// REMOVE DATABASE
// ============================================

/**
 * **removeDatabase()** - Supprime une base de données
 *
 * @param type - Type de base de données
 * @param purge - Si true, supprime aussi les fichiers de configuration
 * @param removeData - Si true, supprime les données (IRREVERSIBLE !)
 * @param onLog - Fonction de log
 */
export async function removeDatabase(
    type: DatabaseType,
    purge: boolean,
    removeData: boolean,
    onLog: LogFn
): Promise<void> {
    if (removeData) {
        onLog(`⚠️ WARNING: Data directory will be PERMANENTLY deleted!\n`, 'stderr');
    }

    const removeCmd = purge ? 'purge' : 'remove';

    switch (type) {
        case 'postgresql':
            await runCommand('systemctl', ['stop', 'postgresql'], onLog);
            await runCommand('apt-get', [removeCmd, '-y',
                'postgresql', 'postgresql-contrib', 'postgresql-common',
                'postgresql-client-common', 'postgresql-*'], onLog);
            if (removeData && fs.existsSync('/var/lib/postgresql')) {
                onLog(`Deleting /var/lib/postgresql...\n`, 'stderr');
                await runCommand('rm', ['-rf', '/var/lib/postgresql'], onLog);
            }
            // Supprimer les credentials stockés pour éviter les problèmes lors d'une réinstallation
            if (deleteDbCredentials('postgresql')) {
                onLog(`🗑️ Credentials PostgreSQL supprimés\n`, 'stdout');
            }
            break;

        case 'mysql':
            await runCommand('systemctl', ['stop', 'mariadb'], onLog);
            await runCommand('apt-get', [removeCmd, '-y',
                'default-mysql-server', 'default-mysql-client',
                'mariadb-server', 'mariadb-client', 'mariadb-common',
                'mysql-common', 'mysql-*', 'mariadb-*'], onLog);
            if (removeData && fs.existsSync('/var/lib/mysql')) {
                onLog(`Deleting /var/lib/mysql...\n`, 'stderr');
                await runCommand('rm', ['-rf', '/var/lib/mysql'], onLog);
            }
            // Supprimer les credentials stockés pour éviter les problèmes lors d'une réinstallation
            if (deleteDbCredentials('mysql')) {
                onLog(`🗑️ Credentials MySQL supprimés\n`, 'stdout');
            }
            break;

        case 'redis':
            await runCommand('systemctl', ['stop', 'redis-server'], onLog);
            await runCommand('apt-get', [removeCmd, '-y', 'redis-server'], onLog);
            if (removeData && fs.existsSync('/var/lib/redis')) {
                onLog(`Deleting /var/lib/redis...\n`, 'stderr');
                await runCommand('rm', ['-rf', '/var/lib/redis'], onLog);
            }
            // Supprimer les credentials stockés pour éviter les problèmes lors d'une réinstallation
            if (deleteDbCredentials('redis')) {
                onLog(`🗑️ Credentials Redis supprimés\n`, 'stdout');
            }
            break;

        default:
            throw new Error(`Unknown database: ${type}`);
    }

    // Clean up unused packages
    await runCommand('apt-get', ['autoremove', '-y'], onLog);
}

// ============================================
// RECONFIGURE DATABASE
// ============================================

/**
 * **reconfigureDatabase()** - Reconfigure une base de données
 *
 * Permet de changer le mot de passe ou créer une nouvelle database/user.
 *
 * @param type - Type de base de données
 * @param dbName - Nom de la database/user
 * @param resetPassword - Si true, change seulement le mot de passe
 * @param onLog - Fonction de log
 * @returns La nouvelle connection string
 */
export async function reconfigureDatabase(
    type: DatabaseType,
    dbName: string,
    resetPassword: boolean,
    onLog: LogFn
): Promise<string> {
    const password = crypto.randomBytes(24).toString('base64url');
    const user = `${dbName}_user`;

    switch (type) {
        case 'postgresql':
            if (resetPassword) {
                onLog(`Resetting password for user ${user}...\n`, 'stdout');
                const alterUser = runAsUser('postgres', `psql -c "ALTER USER ${user} WITH PASSWORD '${password}';"`);
                await runCommand(alterUser.cmd, alterUser.args, onLog);
            } else {
                onLog(`Creating user ${user}...\n`, 'stdout');
                const createUser = runAsUser('postgres', `psql -c "CREATE USER ${user} WITH PASSWORD '${password}';"`);
                await runCommand(createUser.cmd, createUser.args, onLog);

                onLog(`Creating database ${dbName}...\n`, 'stdout');
                const createDb = runAsUser('postgres', `psql -c "CREATE DATABASE ${dbName} OWNER ${user};"`);
                await runCommand(createDb.cmd, createDb.args, onLog);

                onLog(`Granting privileges...\n`, 'stdout');
                const grantPrivs = runAsUser('postgres', `psql -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${user};"`);
                await runCommand(grantPrivs.cmd, grantPrivs.args, onLog);
            }
            return `postgresql://${user}:${password}@localhost:5432/${dbName}`;

        case 'mysql':
            if (resetPassword) {
                onLog(`Resetting password for user ${user}...\n`, 'stdout');
                await runCommand('mysql', ['-e',
                    `ALTER USER '${user}'@'localhost' IDENTIFIED BY '${password}'; FLUSH PRIVILEGES;`
                ], onLog);
            } else {
                onLog(`Creating database ${dbName}...\n`, 'stdout');
                await runCommand('mysql', ['-e', `CREATE DATABASE IF NOT EXISTS ${dbName};`], onLog);

                onLog(`Creating user ${user}...\n`, 'stdout');
                await runCommand('mysql', ['-e',
                    `CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${password}';`
                ], onLog);

                onLog(`Granting privileges...\n`, 'stdout');
                await runCommand('mysql', ['-e',
                    `GRANT ALL PRIVILEGES ON ${dbName}.* TO '${user}'@'localhost'; FLUSH PRIVILEGES;`
                ], onLog);
            }
            return `mysql://${user}:${password}@localhost:3306/${dbName}`;

        case 'redis':
            // Redis only has password reset (no multiple databases)
            const configPath = '/etc/redis/redis.conf';
            if (fs.existsSync(configPath)) {
                let config = fs.readFileSync(configPath, 'utf-8');
                config = config.replace(/^requirepass .+$/m, '');
                config += `\nrequirepass ${password}\n`;
                fs.writeFileSync(configPath, config);
            }
            await runCommand('systemctl', ['restart', 'redis-server'], onLog);
            return `redis://:${password}@localhost:6379`;

        default:
            throw new Error(`Unknown database: ${type}`);
    }
}
