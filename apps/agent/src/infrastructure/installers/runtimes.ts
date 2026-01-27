/**
 * @file apps/agent/src/infrastructure/installers/runtimes.ts
 * @description Installation et mise à jour des runtimes.
 * Ce fichier contient toutes les fonctions pour installer et mettre à jour
 * les runtimes supportés (Python, Go, Docker, Rust, Ruby, PHP).
 *
 * @dependencies
 * - fs : Pour les opérations sur le système de fichiers
 * - os : Pour les informations système
 *
 * @fonctions_principales
 * - installPython() : Installe Python 3 avec pip et venv
 * - installGo() : Installe Go depuis go.dev
 * - installDocker() : Installe Docker et docker-compose
 * - installRust() : Installe Rust via rustup
 * - installRuby() : Installe Ruby avec bundler
 * - installPhp() : Installe PHP avec les extensions courantes
 * - updateNodejs() : Met à jour Node.js
 * - updatePython/Go/Docker/Rust/Ruby/Php() : Mises à jour respectives
 */

import fs from 'node:fs';
import os from 'node:os';
import type { LogFn, RuntimeType } from '../types.js';
import { runCommand, runCommandSilent, getCommandVersion, sleep } from '../helpers.js';
import { getLatestVersion } from '../detection/runtimes.js';

type RuntimeRunner = (onLog: LogFn) => Promise<string>;

/**
 * Map des installateurs de runtimes
 */
export const runtimeInstallers: Record<Exclude<RuntimeType, 'nodejs'>, RuntimeRunner> = {
    python: installPython,
    go: installGo,
    docker: installDocker,
    rust: installRust,
    ruby: installRuby,
    php: installPhp
};

/**
 * Map des updaters de runtimes
 */
export const runtimeUpdaters: Record<RuntimeType, RuntimeRunner> = {
    nodejs: updateNodejs,
    python: updatePython,
    go: updateGo,
    docker: updateDocker,
    rust: updateRust,
    ruby: updateRuby,
    php: updatePhp
};

// ============================================
// INSTALLATEURS
// ============================================

/**
 * **installPython()** - Installe Python 3 avec pip et venv
 */
async function installPython(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y',
        'python3', 'python3-pip', 'python3-venv',
        'python3-dev', 'build-essential'
    ], onLog);
    // Install common WSGI servers globally
    await runCommand('pip3', ['install', '--break-system-packages', 'uvicorn', 'gunicorn'], onLog);
    return await getCommandVersion('python3', ['--version']) || 'Unknown';
}

/**
 * **installGo()** - Installe Go depuis go.dev
 */
async function installGo(onLog: LogFn): Promise<string> {
    const GO_VERSION = '1.22.0';
    const ARCH = os.arch() === 'x64' ? 'amd64' : 'arm64';

    onLog(`📥 Downloading Go ${GO_VERSION}...\n`, 'stdout');

    // Download Go tarball
    await runCommand('wget', [
        '-q', '--show-progress',
        `https://go.dev/dl/go${GO_VERSION}.linux-${ARCH}.tar.gz`,
        '-O', '/tmp/go.tar.gz'
    ], onLog);

    // Remove old Go installation if exists
    await runCommandSilent('rm', ['-rf', '/usr/local/go']);

    // Extract
    onLog(`📦 Extracting...\n`, 'stdout');
    await runCommand('tar', ['-C', '/usr/local', '-xzf', '/tmp/go.tar.gz'], onLog);

    // Add to PATH
    const profileContent = 'export PATH=$PATH:/usr/local/go/bin\n';
    fs.writeFileSync('/etc/profile.d/go.sh', profileContent);

    // Clean up
    await runCommandSilent('rm', ['/tmp/go.tar.gz']);

    return GO_VERSION;
}

/**
 * **installDocker()** - Installe Docker et docker-compose
 */
async function installDocker(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y',
        'docker.io', 'docker-compose'
    ], onLog);
    await runCommand('systemctl', ['enable', 'docker'], onLog);
    await runCommand('systemctl', ['start', 'docker'], onLog);

    // Add current user to docker group
    const user = os.userInfo().username;
    if (user !== 'root') {
        await runCommandSilent('usermod', ['-aG', 'docker', user]);
    }

    return await getCommandVersion('docker', ['--version']) || 'Unknown';
}

/**
 * **installRust()** - Installe Rust via rustup
 */
async function installRust(onLog: LogFn): Promise<string> {
    onLog(`📥 Downloading rustup...\n`, 'stdout');

    // Download rustup installer
    await runCommand('curl', [
        '--proto', '=https', '--tlsv1.2', '-sSf',
        'https://sh.rustup.rs', '-o', '/tmp/rustup.sh'
    ], onLog);

    // Install Rust (non-interactive)
    await runCommand('sh', ['/tmp/rustup.sh', '-y', '--default-toolchain', 'stable'], onLog);

    // Add to PATH for current session
    const cargoPath = `${os.homedir()}/.cargo/bin`;
    process.env.PATH = `${cargoPath}:${process.env.PATH}`;

    // Clean up
    await runCommandSilent('rm', ['/tmp/rustup.sh']);

    return await getCommandVersion(`${cargoPath}/rustc`, ['--version']) || 'stable';
}

/**
 * **installRuby()** - Installe Ruby avec bundler
 */
async function installRuby(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    // Include build-essential for compiling native gems like puma
    await runCommand('apt-get', ['install', '-y',
        'ruby', 'ruby-dev', 'ruby-bundler', 'build-essential'
    ], onLog);
    // Install common Ruby gems
    await runCommand('gem', ['install', 'puma', 'bundler', '--no-document'], onLog);

    return await getCommandVersion('ruby', ['--version']) || 'Unknown';
}

/**
 * **installPhp()** - Installe PHP avec les extensions courantes
 */
async function installPhp(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    // Install PHP with common extensions for web development
    await runCommand('apt-get', ['install', '-y',
        'php', 'php-fpm', 'php-cli', 'php-common',
        'php-mysql', 'php-pgsql', 'php-sqlite3',
        'php-curl', 'php-gd', 'php-mbstring',
        'php-xml', 'php-zip', 'php-bcmath',
        'php-intl', 'php-json'
    ], onLog);
    // Install Composer (PHP package manager)
    await runCommand('curl', ['-sS', 'https://getcomposer.org/installer', '-o', '/tmp/composer-setup.php'], onLog);
    await runCommand('php', ['/tmp/composer-setup.php', '--install-dir=/usr/local/bin', '--filename=composer'], onLog);
    await runCommand('rm', ['/tmp/composer-setup.php'], onLog);

    return await getCommandVersion('php', ['--version']) || 'Unknown';
}

// ============================================
// UPDATERS
// ============================================

/**
 * **updateNodejs()** - Met à jour Node.js via nvm ou NodeSource
 */
async function updateNodejs(onLog: LogFn): Promise<string> {
    onLog(`📥 Updating Node.js via nvm...\n`, 'stdout');

    // Check if nvm is installed
    const nvmDir = `${os.homedir()}/.nvm`;
    if (fs.existsSync(nvmDir)) {
        // Source nvm and install latest LTS
        await runCommand('bash', ['-c',
            `. ${nvmDir}/nvm.sh && nvm install --lts && nvm use --lts && nvm alias default lts/*`
        ], onLog);
    } else {
        // Fallback to NodeSource repo update
        onLog(`Installing via NodeSource (nvm not found)...\n`, 'stdout');
        await runCommand('curl', ['-fsSL', 'https://deb.nodesource.com/setup_lts.x', '-o', '/tmp/nodesource_setup.sh'], onLog);
        await runCommand('bash', ['/tmp/nodesource_setup.sh'], onLog);
        await runCommand('apt-get', ['install', '-y', 'nodejs'], onLog);
        await runCommandSilent('rm', ['/tmp/nodesource_setup.sh']);
    }

    return await getCommandVersion('node', ['--version']) || 'Unknown';
}

/**
 * **updatePython()** - Met à jour Python via apt
 */
async function updatePython(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['upgrade', '-y', 'python3', 'python3-pip'], onLog);
    return await getCommandVersion('python3', ['--version']) || 'Unknown';
}

/**
 * **updateGo()** - Met à jour Go vers la dernière version
 */
async function updateGo(onLog: LogFn): Promise<string> {
    // Fetch latest version
    const latestVersion = await getLatestVersion('go') || '1.22.0';
    const ARCH = os.arch() === 'x64' ? 'amd64' : 'arm64';

    onLog(`📥 Downloading Go ${latestVersion}...\n`, 'stdout');

    // Download latest Go tarball
    await runCommand('wget', [
        '-q', '--show-progress',
        `https://go.dev/dl/go${latestVersion}.linux-${ARCH}.tar.gz`,
        '-O', '/tmp/go.tar.gz'
    ], onLog);

    // Remove old Go installation
    await runCommandSilent('rm', ['-rf', '/usr/local/go']);

    // Extract new version
    onLog(`📦 Extracting...\n`, 'stdout');
    await runCommand('tar', ['-C', '/usr/local', '-xzf', '/tmp/go.tar.gz'], onLog);

    // Clean up
    await runCommandSilent('rm', ['/tmp/go.tar.gz']);

    return latestVersion;
}

/**
 * **updateDocker()** - Met à jour Docker via apt
 */
async function updateDocker(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['upgrade', '-y', 'docker.io', 'docker-compose'], onLog);
    await runCommand('systemctl', ['restart', 'docker'], onLog);
    return await getCommandVersion('docker', ['--version']) || 'Unknown';
}

/**
 * **updateRust()** - Met à jour Rust via rustup
 */
async function updateRust(onLog: LogFn): Promise<string> {
    const cargoPath = `${os.homedir()}/.cargo/bin`;
    const rustupPath = `${cargoPath}/rustup`;

    if (fs.existsSync(rustupPath)) {
        // Use rustup to update
        await runCommand(rustupPath, ['update', 'stable'], onLog);
    } else {
        // Reinstall if rustup not available
        onLog(`Rustup not found, reinstalling...\n`, 'stdout');
        await runCommand('curl', [
            '--proto', '=https', '--tlsv1.2', '-sSf',
            'https://sh.rustup.rs', '-o', '/tmp/rustup.sh'
        ], onLog);
        await runCommand('sh', ['/tmp/rustup.sh', '-y', '--default-toolchain', 'stable'], onLog);
        await runCommandSilent('rm', ['/tmp/rustup.sh']);
    }

    process.env.PATH = `${cargoPath}:${process.env.PATH}`;
    return await getCommandVersion(`${cargoPath}/rustc`, ['--version']) || 'Unknown';
}

/**
 * **updateRuby()** - Met à jour Ruby via apt
 */
async function updateRuby(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['upgrade', '-y', 'ruby', 'ruby-dev'], onLog);
    await runCommand('gem', ['update', '--system'], onLog);
    return await getCommandVersion('ruby', ['--version']) || 'Unknown';
}

/**
 * **updatePhp()** - Met à jour PHP via apt
 */
async function updatePhp(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['upgrade', '-y', 'php', 'php-fpm', 'php-cli', 'php-common'], onLog);
    // Update Composer
    await runCommand('composer', ['self-update'], onLog);
    return await getCommandVersion('php', ['--version']) || 'Unknown';
}

// ============================================
// UNINSTALL
// ============================================

/**
 * **uninstallRuntime()** - Désinstalle un runtime
 *
 * @param type - Type de runtime à désinstaller
 * @param purge - Si true, supprime aussi les fichiers de configuration
 * @param onLog - Fonction de log
 */
export async function uninstallRuntime(
    type: RuntimeType,
    purge: boolean,
    onLog: LogFn
): Promise<void> {
    const removeCmd = purge ? 'purge' : 'remove';

    switch (type) {
        case 'python':
            await runCommand('apt-get', [removeCmd, '-y', 'python3', 'python3-pip', 'python3-venv'], onLog);
            break;

        case 'go':
            // Go is installed manually, remove from /usr/local
            if (fs.existsSync('/usr/local/go')) {
                await runCommand('rm', ['-rf', '/usr/local/go'], onLog);
            }
            if (fs.existsSync('/etc/profile.d/go.sh')) {
                await runCommandSilent('rm', ['/etc/profile.d/go.sh']);
            }
            onLog(`Removed Go from /usr/local/go\n`, 'stdout');
            break;

        case 'docker':
            // Stop all containers first
            try {
                const containers = await runCommandSilent('docker', ['ps', '-aq']);
                if (containers.trim()) {
                    onLog(`Stopping all containers...\n`, 'stdout');
                    await runCommand('docker', ['stop', ...containers.trim().split('\n')], onLog);
                }
            } catch {
                // Ignore if no containers
            }
            await runCommand('systemctl', ['stop', 'docker'], onLog);
            await runCommand('apt-get', [removeCmd, '-y', 'docker.io', 'docker-compose'], onLog);
            break;

        case 'rust':
            // Rust uses rustup, remove via rustup or manually
            const rustupPath = `${os.homedir()}/.cargo/bin/rustup`;
            if (fs.existsSync(rustupPath)) {
                await runCommand(rustupPath, ['self', 'uninstall', '-y'], onLog);
            } else {
                // Manual removal
                const cargoDir = `${os.homedir()}/.cargo`;
                const rustupDir = `${os.homedir()}/.rustup`;
                if (fs.existsSync(cargoDir)) {
                    await runCommand('rm', ['-rf', cargoDir], onLog);
                }
                if (fs.existsSync(rustupDir)) {
                    await runCommand('rm', ['-rf', rustupDir], onLog);
                }
            }
            break;

        case 'ruby':
            await runCommand('apt-get', [removeCmd, '-y', 'ruby', 'ruby-dev', 'ruby-bundler'], onLog);
            break;

        case 'php':
            await runCommand('apt-get', [removeCmd, '-y', 'php', 'php-fpm', 'php-cli', 'php-common', 'php-mysql', 'php-pgsql', 'php-curl', 'php-gd', 'php-mbstring', 'php-xml', 'php-zip'], onLog);
            break;

        default:
            throw new Error(`Unknown runtime: ${type}`);
    }

    // Clean up unused packages
    await runCommand('apt-get', ['autoremove', '-y'], onLog);
}
