/**
 * @file apps/agent/src/infrastructure/installers/services/mail.ts
 * @description Installation des services de messagerie.
 * Ce fichier contient les fonctions pour installer la stack mail complète :
 * Postfix (MTA), Dovecot (IMAP/POP3), Rspamd (antispam), OpenDKIM, ClamAV.
 *
 * @fonctions_principales
 * - installPostfix() : Installe le serveur SMTP Postfix
 * - installDovecot() : Installe le serveur IMAP/POP3 Dovecot
 * - installRspamd() : Installe l'antispam Rspamd
 * - installOpendkim() : Installe OpenDKIM pour la signature des emails
 * - installClamav() : Installe l'antivirus ClamAV
 * - installSpfPolicyd() : Installe le SPF Policy Daemon
 */

import fs from 'node:fs';
import os from 'node:os';
import type { LogFn } from '../../types.js';
import { runCommand, runCommandSilent, getCommandVersion } from '../../helpers.js';
import { writeConfig } from '../../template-manager.js';

/**
 * **installPostfix()** - Installe le serveur SMTP Postfix
 */
export async function installPostfix(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing Postfix MTA...\n`, 'stdout');

    const hostname = os.hostname();
    const domain = hostname.includes('.') ? hostname.split('.').slice(1).join('.') : hostname;

    // Pre-configure postfix to avoid interactive prompts
    const debconfSelections = `postfix postfix/main_mailer_type select Internet Site
postfix postfix/mailname string ${hostname}
postfix postfix/destinations string ${hostname}, localhost.localdomain, localhost
`;
    fs.writeFileSync('/tmp/postfix-debconf', debconfSelections);
    await runCommand('bash', ['-c', 'debconf-set-selections < /tmp/postfix-debconf'], onLog);
    await runCommandSilent('rm', ['/tmp/postfix-debconf']);

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'postfix', 'postfix-policyd-spf-python', 'libsasl2-modules'], onLog);

    // Basic secure configuration using template
    writeConfig('postfix/main.cf', '/etc/postfix/main.cf', {
        hostname,
        domain
    }, { append: true });

    await runCommand('systemctl', ['enable', 'postfix'], onLog);
    await runCommand('systemctl', ['restart', 'postfix'], onLog);

    onLog(`✅ Postfix installed. Configure TLS certificates for production use.\n`, 'stdout');
    const version = await getCommandVersion('postconf', ['mail_version']);
    return version?.replace('mail_version = ', '').trim() || 'installed';
}

/**
 * **installDovecot()** - Installe le serveur IMAP/POP3 Dovecot
 */
export async function installDovecot(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing Dovecot IMAP/POP3 Server...\n`, 'stdout');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'dovecot-core', 'dovecot-imapd', 'dovecot-pop3d', 'dovecot-lmtpd', 'dovecot-sieve'], onLog);

    // Configure Dovecot for Maildir format using template
    writeConfig('dovecot/local.conf', '/etc/dovecot/local.conf', {});

    await runCommand('systemctl', ['enable', 'dovecot'], onLog);
    await runCommand('systemctl', ['restart', 'dovecot'], onLog);

    onLog(`✅ Dovecot installed. IMAP on port 143/993, POP3 on 110/995\n`, 'stdout');
    return await getCommandVersion('dovecot', ['--version']) || 'installed';
}

/**
 * **installRspamd()** - Installe l'antispam Rspamd
 */
export async function installRspamd(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing Rspamd Antispam...\n`, 'stdout');

    await runCommand('apt-get', ['install', '-y', 'lsb-release', 'wget', 'gpg'], onLog);

    const codename = await runCommandSilent('lsb_release', ['-cs']);

    await runCommand('wget', ['-qO', '/tmp/rspamd.gpg.key', 'https://rspamd.com/apt-stable/gpg.key'], onLog);
    await runCommand('gpg', ['--batch', '--yes', '--dearmor', '-o', '/usr/share/keyrings/rspamd.gpg', '/tmp/rspamd.gpg.key'], onLog);

    const repoLine = `deb [signed-by=/usr/share/keyrings/rspamd.gpg] https://rspamd.com/apt-stable/ ${codename.trim()} main`;
    fs.writeFileSync('/etc/apt/sources.list.d/rspamd.list', repoLine + '\n');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'rspamd', 'redis-server'], onLog);

    // Basic configuration for Postfix integration using template
    writeConfig('rspamd/worker-proxy.inc', '/etc/rspamd/local.d/worker-proxy.inc', {
        socket_path: '/var/spool/postfix/rspamd/rspamd.sock',
        socket_mode: '0666',
        socket_owner: '_rspamd'
    }, { createDirs: true });

    // Create socket directory
    if (!fs.existsSync('/var/spool/postfix/rspamd')) {
        fs.mkdirSync('/var/spool/postfix/rspamd', { recursive: true });
    }
    await runCommand('chown', ['_rspamd:_rspamd', '/var/spool/postfix/rspamd'], onLog);

    // Configure Postfix to use Rspamd
    await runCommand('postconf', ['-e', 'smtpd_milters = unix:/rspamd/rspamd.sock'], onLog);
    await runCommand('postconf', ['-e', 'non_smtpd_milters = unix:/rspamd/rspamd.sock'], onLog);
    await runCommand('postconf', ['-e', 'milter_default_action = accept'], onLog);

    await runCommand('systemctl', ['enable', 'rspamd'], onLog);
    await runCommand('systemctl', ['enable', 'redis-server'], onLog);
    await runCommand('systemctl', ['start', 'redis-server'], onLog);
    await runCommand('systemctl', ['start', 'rspamd'], onLog);

    onLog(`✅ Rspamd installed. Web UI at http://localhost:11334\n`, 'stdout');
    onLog(`⚠️ Set password: rspamadm pw --encrypt\n`, 'stdout');
    return await getCommandVersion('rspamd', ['--version']) || 'installed';
}

/**
 * **installOpendkim()** - Installe OpenDKIM pour la signature des emails
 */
export async function installOpendkim(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing OpenDKIM...\n`, 'stdout');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'opendkim', 'opendkim-tools'], onLog);

    const hostname = os.hostname();
    const domain = hostname.includes('.') ? hostname.split('.').slice(1).join('.') : hostname;

    // Create directories
    const keysDir = `/etc/opendkim/keys/${domain}`;
    if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
    }

    // Generate DKIM keys
    onLog(`🔐 Generating DKIM keys for ${domain}...\n`, 'stdout');
    await runCommand('opendkim-genkey', ['-b', '2048', '-d', domain, '-D', keysDir, '-s', 'default', '-v'], onLog);
    await runCommand('chown', ['-R', 'opendkim:opendkim', '/etc/opendkim'], onLog);
    await runCommand('chmod', ['600', `${keysDir}/default.private`], onLog);

    // Configure OpenDKIM using templates
    const templateVars = { hostname, domain, keys_dir: keysDir };

    writeConfig('opendkim/opendkim.conf', '/etc/opendkim.conf', templateVars);
    writeConfig('opendkim/TrustedHosts', '/etc/opendkim/TrustedHosts', templateVars);
    writeConfig('opendkim/KeyTable', '/etc/opendkim/KeyTable', templateVars);
    writeConfig('opendkim/SigningTable', '/etc/opendkim/SigningTable', templateVars);

    // Configure Postfix to use OpenDKIM
    await runCommand('postconf', ['-e', 'milter_protocol = 6'], onLog);
    await runCommand('postconf', ['-e', 'milter_default_action = accept'], onLog);
    await runCommand('postconf', ['-e', 'smtpd_milters = inet:localhost:12301'], onLog);
    await runCommand('postconf', ['-e', 'non_smtpd_milters = inet:localhost:12301'], onLog);

    await runCommand('systemctl', ['enable', 'opendkim'], onLog);
    await runCommand('systemctl', ['start', 'opendkim'], onLog);

    // Show the DNS record
    const dkimPublicKey = fs.readFileSync(`${keysDir}/default.txt`, 'utf-8');
    onLog(`\n📋 Add this DNS TXT record for DKIM:\n${dkimPublicKey}\n`, 'stdout');

    return 'installed';
}

/**
 * **installClamav()** - Installe l'antivirus ClamAV
 *
 * Cette fonction gère intelligemment les cas suivants :
 * - Réinstallation après une désinstallation (nettoie les fichiers corrompus)
 * - Rate-limiting du CDN ClamAV (erreur 429)
 * - Absence de définitions de virus (main.cvd, daily.cvd)
 * - Service rspamd masqué ou absent
 */
export async function installClamav(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing ClamAV antivirus...\n`, 'stdout');

    // ============================================
    // ÉTAPE 1 : Nettoyage pré-installation
    // ============================================
    // Supprime les fichiers qui peuvent causer des problèmes lors de réinstallation
    const clamavDataDir = '/var/lib/clamav';
    const mirrorsFile = `${clamavDataDir}/mirrors.dat`;

    // Supprimer le fichier mirrors.dat qui contient l'état du rate-limiting
    // Cela permet de "reset" le cool-down si l'utilisateur a attendu
    if (fs.existsSync(mirrorsFile)) {
        onLog(`🧹 Nettoyage du fichier mirrors.dat (reset rate-limiting)...\n`, 'stdout');
        try {
            fs.unlinkSync(mirrorsFile);
        } catch {
            // Ignorer si on ne peut pas supprimer
        }
    }

    // ============================================
    // ÉTAPE 2 : Installation des packages
    // ============================================
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'clamav', 'clamav-daemon', 'clamav-freshclam'], onLog);

    // ============================================
    // ÉTAPE 3 : Mise à jour des définitions de virus
    // ============================================
    // Stop freshclam (le service) pour pouvoir lancer freshclam manuellement
    try {
        await runCommandSilent('systemctl', ['stop', 'clamav-freshclam']);
    } catch { }

    onLog(`🦠 Mise à jour des définitions de virus...\n`, 'stdout');

    let freshclamSuccess = false;
    let rateLimited = false;

    try {
        // Lancer freshclam et capturer la sortie
        await runCommand('freshclam', [], onLog);
        freshclamSuccess = true;
    } catch (err: any) {
        // Vérifier si c'est un rate-limiting (erreur 429)
        const errorMsg = err.message || '';
        if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('cool-down')) {
            rateLimited = true;
            onLog(`⚠️ Rate-limiting ClamAV CDN détecté.\n`, 'stderr');
            onLog(`   Le serveur ClamAV limite les téléchargements trop fréquents.\n`, 'stderr');
            onLog(`   Les définitions seront téléchargées automatiquement plus tard.\n`, 'stderr');
        } else {
            onLog(`⚠️ Échec de freshclam: ${errorMsg}\n`, 'stderr');
        }
    }

    // ============================================
    // ÉTAPE 4 : Vérification des définitions
    // ============================================
    // ClamAV daemon ne peut pas démarrer sans au moins main.cvd ou daily.cvd
    const mainCvd = `${clamavDataDir}/main.cvd`;
    const dailyCvd = `${clamavDataDir}/daily.cvd`;
    const hasDefinitions = fs.existsSync(mainCvd) || fs.existsSync(dailyCvd);

    if (!hasDefinitions) {
        onLog(`⚠️ Aucune définition de virus disponible.\n`, 'stderr');
        if (rateLimited) {
            onLog(`   Le daemon ClamAV ne pourra pas démarrer tant que les définitions\n`, 'stderr');
            onLog(`   ne seront pas téléchargées. Réessayez dans quelques heures.\n`, 'stderr');
        }
    }

    // ============================================
    // ÉTAPE 5 : Configuration du daemon
    // ============================================
    writeConfig('clamav/clamd.conf', '/etc/clamav/clamd.conf', {});

    // Créer le répertoire de socket s'il n'existe pas
    const socketDir = '/var/run/clamav';
    if (!fs.existsSync(socketDir)) {
        fs.mkdirSync(socketDir, { recursive: true });
        await runCommandSilent('chown', ['clamav:clamav', socketDir]);
    }

    // ============================================
    // ÉTAPE 6 : Activation des services
    // ============================================
    await runCommand('systemctl', ['enable', 'clamav-freshclam'], onLog);
    await runCommand('systemctl', ['start', 'clamav-freshclam'], onLog);

    await runCommand('systemctl', ['enable', 'clamav-daemon'], onLog);

    // Tenter de démarrer le daemon uniquement si on a des définitions
    let daemonStarted = false;
    if (hasDefinitions) {
        try {
            await runCommand('systemctl', ['start', 'clamav-daemon'], onLog);

            // Attendre un peu et vérifier si le daemon est vraiment démarré
            await new Promise(resolve => setTimeout(resolve, 2000));
            const status = await runCommandSilent('systemctl', ['is-active', 'clamav-daemon']);
            daemonStarted = status.trim() === 'active';
        } catch {
            daemonStarted = false;
        }
    } else {
        onLog(`⏭️ Démarrage du daemon ClamAV différé (pas de définitions)\n`, 'stdout');
    }

    // ============================================
    // ÉTAPE 7 : Intégration Rspamd (si disponible)
    // ============================================
    const rspamdClamavDir = '/etc/rspamd/local.d';
    if (fs.existsSync(rspamdClamavDir)) {
        writeConfig('rspamd/antivirus.conf', `${rspamdClamavDir}/antivirus.conf`, {});

        // Vérifier si rspamd est actif (pas masqué) avant de recharger
        try {
            const rspamdStatus = await runCommandSilent('systemctl', ['is-enabled', 'rspamd']);
            if (rspamdStatus.trim() === 'enabled') {
                await runCommand('systemctl', ['reload', 'rspamd'], onLog);
            }
        } catch {
            // rspamd n'est pas disponible, on ignore silencieusement
        }
    }

    // ============================================
    // ÉTAPE 8 : Résumé de l'installation
    // ============================================
    onLog(`\n`, 'stdout');
    if (daemonStarted) {
        onLog(`✅ ClamAV installé et opérationnel!\n`, 'stdout');
    } else if (hasDefinitions) {
        onLog(`⚠️ ClamAV installé mais le daemon n'a pas démarré.\n`, 'stdout');
        onLog(`   Vérifiez les logs: journalctl -u clamav-daemon\n`, 'stdout');
    } else if (rateLimited) {
        onLog(`⚠️ ClamAV installé mais en attente de définitions (rate-limiting).\n`, 'stdout');
        onLog(`   Le daemon démarrera automatiquement après téléchargement.\n`, 'stdout');
    } else {
        onLog(`⚠️ ClamAV installé mais sans définitions de virus.\n`, 'stdout');
    }
    onLog(`📋 Les définitions seront mises à jour automatiquement via freshclam.\n`, 'stdout');

    // Retourner un statut approprié
    if (daemonStarted) {
        return 'installed';
    } else if (hasDefinitions) {
        return 'installed (daemon not running)';
    } else {
        return 'installed (no definitions)';
    }
}

/**
 * **installSpfPolicyd()** - Installe le SPF Policy Daemon
 */
export async function installSpfPolicyd(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing SPF Policy Daemon...\n`, 'stdout');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'postfix-policyd-spf-python'], onLog);

    // Configure Postfix to use SPF policy daemon using template
    const masterCfPath = '/etc/postfix/master.cf';
    if (fs.existsSync(masterCfPath)) {
        const masterCf = fs.readFileSync(masterCfPath, 'utf-8');

        // Check if SPF policy is already configured
        if (!masterCf.includes('policyd-spf')) {
            writeConfig('postfix/master.cf.spf', masterCfPath, {}, { append: true });
            onLog(`✅ Added SPF policy daemon to master.cf\n`, 'stdout');
        }
    }

    // Configure main.cf to use SPF check
    await runCommand('postconf', ['-e', 'policyd-spf_time_limit = 3600'], onLog);

    // Get current smtpd_recipient_restrictions and add SPF check
    try {
        const currentRestrictions = await runCommandSilent('postconf', ['smtpd_recipient_restrictions']);
        const restrictionsValue = currentRestrictions.split('=')[1]?.trim() || '';

        if (!restrictionsValue.includes('check_policy_service unix:private/policyd-spf')) {
            let newRestrictions = restrictionsValue;
            if (restrictionsValue) {
                newRestrictions = `${restrictionsValue}, check_policy_service unix:private/policyd-spf`;
            } else {
                newRestrictions = 'permit_sasl_authenticated, permit_mynetworks, reject_unauth_destination, check_policy_service unix:private/policyd-spf';
            }
            await runCommand('postconf', ['-e', `smtpd_recipient_restrictions = ${newRestrictions}`], onLog);
        }
    } catch {
        await runCommand('postconf', ['-e', 'smtpd_recipient_restrictions = permit_sasl_authenticated, permit_mynetworks, reject_unauth_destination, check_policy_service unix:private/policyd-spf'], onLog);
    }

    await runCommand('systemctl', ['reload', 'postfix'], onLog);

    onLog(`✅ SPF Policy Daemon installed and configured!\n`, 'stdout');
    onLog(`📋 SPF checks are now enabled for incoming emails\n`, 'stdout');
    onLog(`💡 Make sure you have a valid SPF record in your DNS:\n`, 'stdout');
    onLog(`   TXT record: v=spf1 mx a ~all\n`, 'stdout');

    return 'installed';
}
