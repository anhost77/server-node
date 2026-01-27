/**
 * @file apps/agent/src/infrastructure/installers/services/index.ts
 * @description Point d'entrée pour les installateurs de services.
 * Exporte une map des installateurs par type de service.
 */

import type { LogFn, ServiceType } from '../../types.js';

// Import all service installers
import { installNginx, installHaproxy, installKeepalived, installCertbot, installFail2ban, installUfw, installWireguard } from './network.js';
import { installPostfix, installDovecot, installRspamd, installOpendkim, installClamav, installSpfPolicyd } from './mail.js';
import { installPm2, installNetdata, installLoki } from './monitoring.js';
import { installRsync, installRclone, installRestic } from './backup.js';
import { installVsftpd, installProftpd } from './ftp.js';
import { configureSsh, configureCron, installNfs, installBind9 } from './system.js';

type ServiceInstaller = (onLog: LogFn) => Promise<string>;

/**
 * Map de tous les installateurs de services
 */
export const serviceInstallers: Record<ServiceType, ServiceInstaller> = {
    // Network & Proxy
    nginx: installNginx,
    haproxy: installHaproxy,
    keepalived: installKeepalived,
    certbot: installCertbot,
    // Security
    fail2ban: installFail2ban,
    ufw: installUfw,
    wireguard: installWireguard,
    // Monitoring
    pm2: installPm2,
    netdata: installNetdata,
    loki: installLoki,
    // DNS
    bind9: installBind9,
    // Mail Stack
    postfix: installPostfix,
    dovecot: installDovecot,
    rspamd: installRspamd,
    opendkim: installOpendkim,
    clamav: installClamav,
    'spf-policyd': installSpfPolicyd,
    // Backup Tools
    rsync: installRsync,
    rclone: installRclone,
    restic: installRestic,
    // System Services
    ssh: configureSsh,
    cron: configureCron,
    // FTP Servers
    vsftpd: installVsftpd,
    proftpd: installProftpd,
    // Storage Services
    nfs: installNfs
};

// Re-export individual installers for direct use
export { installNginx, installHaproxy, installKeepalived, installCertbot, installFail2ban, installUfw, installWireguard } from './network.js';
export { installPostfix, installDovecot, installRspamd, installOpendkim, installClamav, installSpfPolicyd } from './mail.js';
export { installPm2, installNetdata, installLoki } from './monitoring.js';
export { installRsync, installRclone, installRestic } from './backup.js';
export { installVsftpd, installProftpd } from './ftp.js';
export { configureSsh, configureCron, installNfs, installBind9 } from './system.js';
