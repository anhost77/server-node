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

    // Basic secure configuration
    const mainCf = `
# Basic settings
myhostname = ${hostname}
mydomain = ${domain}
myorigin = $mydomain
mydestination = $myhostname, localhost.$mydomain, localhost
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128

# TLS parameters
smtpd_tls_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file=/etc/ssl/private/ssl-cert-snakeoil.key
smtpd_tls_security_level=may
smtp_tls_security_level=may

# SASL authentication
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes

# Restrictions
smtpd_recipient_restrictions =
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination,
    reject_rbl_client zen.spamhaus.org

# Mailbox
home_mailbox = Maildir/

# Size limits
message_size_limit = 52428800
mailbox_size_limit = 0

# Virtual domains (uncomment and configure as needed)
# virtual_mailbox_domains = /etc/postfix/virtual_domains
# virtual_mailbox_base = /var/mail/vhosts
# virtual_mailbox_maps = hash:/etc/postfix/vmailbox
# virtual_alias_maps = hash:/etc/postfix/virtual
`;
    fs.appendFileSync('/etc/postfix/main.cf', mainCf);

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

    // Configure Dovecot for Maildir format
    const dovecotLocal = `
# Mailbox location
mail_location = maildir:~/Maildir

# Authentication
auth_mechanisms = plain login

# SSL/TLS
ssl = yes
ssl_cert = </etc/ssl/certs/ssl-cert-snakeoil.pem
ssl_key = </etc/ssl/private/ssl-cert-snakeoil.key

# Protocols
protocols = imap pop3 lmtp

# LMTP socket for Postfix
service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

# Auth socket for Postfix SASL
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

# Logging
log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
`;
    fs.writeFileSync('/etc/dovecot/local.conf', dovecotLocal);

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

    // Basic configuration for Postfix integration
    const milterConfig = `# Rspamd milter for Postfix
milter = yes;
bind_socket = "/var/spool/postfix/rspamd/rspamd.sock mode=0666 owner=_rspamd";
`;
    if (!fs.existsSync('/etc/rspamd/local.d')) {
        fs.mkdirSync('/etc/rspamd/local.d', { recursive: true });
    }
    fs.writeFileSync('/etc/rspamd/local.d/worker-proxy.inc', milterConfig);

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

    // Configure OpenDKIM
    const opendkimConf = `
AutoRestart             Yes
AutoRestartRate         10/1h
Syslog                  yes
SyslogSuccess           Yes
LogWhy                  Yes

Canonicalization        relaxed/simple

ExternalIgnoreList      refile:/etc/opendkim/TrustedHosts
InternalHosts           refile:/etc/opendkim/TrustedHosts
KeyTable                refile:/etc/opendkim/KeyTable
SigningTable            refile:/etc/opendkim/SigningTable

Mode                    sv
PidFile                 /var/run/opendkim/opendkim.pid
SignatureAlgorithm      rsa-sha256

UserID                  opendkim:opendkim

Socket                  inet:12301@localhost
`;
    fs.writeFileSync('/etc/opendkim.conf', opendkimConf);

    // Trusted hosts
    const trustedHosts = `127.0.0.1
localhost
${hostname}
*.${domain}
`;
    fs.writeFileSync('/etc/opendkim/TrustedHosts', trustedHosts);

    // Key table
    const keyTable = `default._domainkey.${domain} ${domain}:default:${keysDir}/default.private\n`;
    fs.writeFileSync('/etc/opendkim/KeyTable', keyTable);

    // Signing table
    const signingTable = `*@${domain} default._domainkey.${domain}\n`;
    fs.writeFileSync('/etc/opendkim/SigningTable', signingTable);

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
 */
export async function installClamav(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing ClamAV antivirus...\n`, 'stdout');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'clamav', 'clamav-daemon', 'clamav-freshclam'], onLog);

    // Stop freshclam to update signatures manually first
    try {
        await runCommand('systemctl', ['stop', 'clamav-freshclam'], onLog);
    } catch { }

    // Update virus definitions
    onLog(`🦠 Updating virus definitions...\n`, 'stdout');
    try {
        await runCommand('freshclam', [], onLog);
    } catch {
        onLog(`⚠️ First freshclam run may fail, this is normal\n`, 'stderr');
    }

    // Configure ClamAV daemon
    const clamdConf = `
# ClamAV Configuration for Mail Server
LocalSocket /var/run/clamav/clamd.sock
LocalSocketGroup clamav
LocalSocketMode 666
FixStaleSocket true
User clamav
ScanMail true
ScanArchive true
MaxFileSize 25M
MaxScanSize 100M
StreamMaxLength 25M
LogFile /var/log/clamav/clamav.log
LogTime true
LogVerbose false
PidFile /var/run/clamav/clamd.pid
DatabaseDirectory /var/lib/clamav
`;
    fs.writeFileSync('/etc/clamav/clamd.conf', clamdConf);

    // Enable and start services
    await runCommand('systemctl', ['enable', 'clamav-freshclam'], onLog);
    await runCommand('systemctl', ['start', 'clamav-freshclam'], onLog);
    await runCommand('systemctl', ['enable', 'clamav-daemon'], onLog);
    await runCommand('systemctl', ['start', 'clamav-daemon'], onLog);

    // Configure Rspamd to use ClamAV (if rspamd is installed)
    const rspamdClamavConf = `
# ClamAV integration for Rspamd
clamav {
    scan_mime_parts = true;
    servers = "/var/run/clamav/clamd.sock";
    symbol = "CLAM_VIRUS";
    patterns {
        JUST_EICAR = "^Eicar-Test-Signature$";
    }
}
`;
    const rspamdClamavDir = '/etc/rspamd/local.d';
    if (fs.existsSync(rspamdClamavDir)) {
        fs.writeFileSync(`${rspamdClamavDir}/antivirus.conf`, rspamdClamavConf);
        try {
            await runCommand('systemctl', ['reload', 'rspamd'], onLog);
        } catch { }
    }

    onLog(`✅ ClamAV installed and configured!\n`, 'stdout');
    onLog(`📋 Virus definitions will be updated automatically via freshclam\n`, 'stdout');

    return 'installed';
}

/**
 * **installSpfPolicyd()** - Installe le SPF Policy Daemon
 */
export async function installSpfPolicyd(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing SPF Policy Daemon...\n`, 'stdout');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'postfix-policyd-spf-python'], onLog);

    // Configure Postfix to use SPF policy daemon
    const masterCfPath = '/etc/postfix/master.cf';
    if (fs.existsSync(masterCfPath)) {
        const masterCf = fs.readFileSync(masterCfPath, 'utf-8');

        // Check if SPF policy is already configured
        if (!masterCf.includes('policyd-spf')) {
            const spfService = `
# SPF Policy Daemon
policyd-spf  unix  -       n       n       -       0       spawn
    user=policyd-spf argv=/usr/bin/policyd-spf
`;
            fs.appendFileSync(masterCfPath, spfService);
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
