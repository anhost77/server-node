/**
 * @file apps/agent/src/infrastructure/template-manager.ts
 * @description Gestionnaire de templates pour les fichiers de configuration.
 * Ce fichier permet de centraliser et de gérer les templates de configuration
 * des services, facilitant leur maintenance et leur versionnement.
 *
 * Les templates sont stockés dans le répertoire `templates/` et sont chargés
 * dynamiquement. Chaque service a son propre sous-répertoire.
 *
 * Syntaxe des templates :
 * - Variables : {{ variableName }}
 * - Valeur par défaut : {{ variableName | default:valeur }}
 * - Conditions : {{#if variableName}}contenu{{/if}}
 * - Conditions négatives : {{#unless variableName}}contenu{{/unless}}
 * - Boucles : {{#each items}}{{ item }}{{/each}}
 *
 * @fonctions_principales
 * - loadTemplate() : Charge un template depuis le système de fichiers
 * - renderTemplate() : Rend un template avec des variables
 * - writeConfig() : Écrit un fichier de configuration depuis un template
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Variables disponibles pour les templates
 */
export interface TemplateVariables {
    [key: string]: string | number | boolean | string[] | TemplateVariables | undefined;
}

/**
 * Options pour l'écriture de fichiers de configuration
 */
export interface WriteConfigOptions {
    /** Mode du fichier (permissions Unix, ex: 0o644) */
    mode?: number;
    /** Ajouter au fichier existant au lieu de le remplacer */
    append?: boolean;
    /** Créer les répertoires parents si nécessaire */
    createDirs?: boolean;
    /** Propriétaire du fichier (user:group) */
    owner?: string;
}

/**
 * Mapping des noms logiques vers les fichiers de templates
 * Permet de garder la rétrocompatibilité avec les anciens noms
 */
const TEMPLATE_FILE_MAP: Record<string, string> = {
    // Fail2ban
    'fail2ban/jail.local': 'fail2ban/jail.local.conf',

    // UFW
    'ufw/rules': 'ufw/rules.conf',

    // BIND9 / DNS
    'bind9/named.conf.options': 'bind9/named.conf.options.conf',

    // Postfix
    'postfix/main.cf': 'postfix/main.cf.conf',
    'postfix/master.cf.spf': 'postfix/master.cf.spf.conf',

    // Dovecot
    'dovecot/local.conf': 'dovecot/local.conf',

    // Rspamd
    'rspamd/worker-proxy.inc': 'rspamd/worker-proxy.inc.conf',
    'rspamd/antivirus.conf': 'rspamd/antivirus.conf',

    // OpenDKIM
    'opendkim/opendkim.conf': 'opendkim/opendkim.conf',
    'opendkim/TrustedHosts': 'opendkim/TrustedHosts.conf',
    'opendkim/KeyTable': 'opendkim/KeyTable.conf',
    'opendkim/SigningTable': 'opendkim/SigningTable.conf',

    // ClamAV
    'clamav/clamd.conf': 'clamav/clamd.conf',

    // Nginx
    'nginx/server-block': 'nginx/server-block.conf',
    'nginx/proxy-pass': 'nginx/proxy-pass.conf',

    // Redis
    'redis/redis.conf.security': 'redis/redis.conf.security.conf',

    // HAProxy
    'haproxy/haproxy.cfg': 'haproxy/haproxy.cfg.conf',
};

/**
 * **TemplateManager** - Gestionnaire de templates de configuration
 *
 * Cette classe permet de :
 * - Charger des templates depuis le répertoire templates/
 * - Rendre des templates avec des variables
 * - Écrire des fichiers de configuration
 */
export class TemplateManager {
    private templatesDir: string;

    /**
     * @param templatesDir - Répertoire optionnel pour les templates personnalisés
     */
    constructor(templatesDir?: string) {
        // Déterminer le répertoire des templates
        // __dirname est défini au niveau du module via fileURLToPath(import.meta.url)
        this.templatesDir = templatesDir || path.join(__dirname, 'templates');
    }

    /**
     * **resolveTemplatePath()** - Résout le chemin d'un template
     *
     * Utilise le mapping pour convertir les noms logiques en fichiers réels.
     *
     * @param name - Nom logique du template
     * @returns Le chemin complet vers le fichier template
     */
    private resolveTemplatePath(name: string): string {
        // Chercher dans le mapping d'abord
        const mappedName = TEMPLATE_FILE_MAP[name] || name;

        // Construire le chemin complet
        let templatePath = path.join(this.templatesDir, mappedName);

        // Si le fichier n'existe pas, essayer avec l'extension .conf
        if (!fs.existsSync(templatePath) && !mappedName.endsWith('.conf')) {
            const withConf = templatePath + '.conf';
            if (fs.existsSync(withConf)) {
                templatePath = withConf;
            }
        }

        return templatePath;
    }

    /**
     * **loadTemplate()** - Charge un template depuis le système de fichiers
     *
     * @param name - Nom du template (ex: 'postfix/main.cf')
     * @returns Le contenu du template
     * @throws Error si le template n'existe pas
     */
    loadTemplate(name: string): string {
        const templatePath = this.resolveTemplatePath(name);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${name} (looked in ${templatePath})`);
        }

        return fs.readFileSync(templatePath, 'utf-8');
    }

    /**
     * **hasTemplate()** - Vérifie si un template existe
     */
    hasTemplate(name: string): boolean {
        const templatePath = this.resolveTemplatePath(name);
        return fs.existsSync(templatePath);
    }

    /**
     * **listTemplates()** - Liste tous les templates disponibles
     */
    listTemplates(): string[] {
        const templates: string[] = [];

        if (fs.existsSync(this.templatesDir)) {
            this.listFilesRecursive(this.templatesDir, '').forEach(t => templates.push(t));
        }

        return templates.sort();
    }

    private listFilesRecursive(dir: string, prefix: string): string[] {
        const files: string[] = [];
        if (!fs.existsSync(dir)) return files;

        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                files.push(...this.listFilesRecursive(fullPath, relativePath));
            } else {
                files.push(relativePath);
            }
        }
        return files;
    }

    /**
     * **renderTemplate()** - Rend un template avec des variables
     *
     * Syntaxe supportée :
     * - {{ variable }} : Remplace par la valeur de la variable
     * - {{ variable | default:valeur }} : Utilise la valeur par défaut si la variable n'existe pas
     * - {{#if variable}}...{{/if}} : Condition
     * - {{#unless variable}}...{{/unless}} : Condition négative
     * - {{#each items}}...{{ item }}...{{/each}} : Boucle
     *
     * @param template - Contenu du template
     * @param variables - Variables à substituer
     * @returns Le template rendu
     */
    renderTemplate(template: string, variables: TemplateVariables): string {
        let result = template;

        // 1. Traiter les conditions {{#if variable}}...{{/if}}
        result = this.processConditions(result, variables);

        // 2. Traiter les conditions négatives {{#unless variable}}...{{/unless}}
        result = this.processUnless(result, variables);

        // 3. Traiter les boucles {{#each items}}...{{/each}}
        result = this.processLoops(result, variables);

        // 4. Traiter les variables {{ variable | default:value }}
        result = this.processVariables(result, variables);

        return result;
    }

    private processConditions(template: string, variables: TemplateVariables): string {
        // Regex pour {{#if variable}}...{{/if}} (non-greedy)
        const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

        return template.replace(ifRegex, (_, varName, content) => {
            const value = this.getNestedValue(variables, varName);
            // Considère truthy : existe et n'est pas false, '', 0, null, undefined
            if (value && value !== 'false' && value !== '0') {
                return content;
            }
            return '';
        });
    }

    private processUnless(template: string, variables: TemplateVariables): string {
        // Regex pour {{#unless variable}}...{{/unless}}
        const unlessRegex = /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;

        return template.replace(unlessRegex, (_, varName, content) => {
            const value = this.getNestedValue(variables, varName);
            // Inverse de if
            if (!value || value === 'false' || value === '0') {
                return content;
            }
            return '';
        });
    }

    private processLoops(template: string, variables: TemplateVariables): string {
        // Regex pour {{#each items}}...{{/each}}
        const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

        return template.replace(eachRegex, (_, varName, content) => {
            const items = this.getNestedValue(variables, varName);

            if (!Array.isArray(items)) {
                return '';
            }

            return items.map((item, index) => {
                // Créer un contexte pour chaque itération
                let itemContent = content;

                if (typeof item === 'object' && item !== null) {
                    // Si l'item est un objet, remplacer {{ prop }} par les propriétés
                    for (const [key, val] of Object.entries(item)) {
                        const propRegex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
                        itemContent = itemContent.replace(propRegex, String(val ?? ''));
                    }
                } else {
                    // Si l'item est une valeur simple, remplacer {{ item }}
                    itemContent = itemContent.replace(/\{\{\s*item\s*\}\}/g, String(item));
                }

                // Ajouter l'index
                itemContent = itemContent.replace(/\{\{\s*@index\s*\}\}/g, String(index));

                return itemContent;
            }).join('');
        });
    }

    private processVariables(template: string, variables: TemplateVariables): string {
        // Regex pour {{ variable }} et {{ variable | default:value }}
        const varRegex = /\{\{\s*(\w+(?:\.\w+)*)\s*(?:\|\s*default:([^}]+))?\s*\}\}/g;

        return template.replace(varRegex, (_, varPath, defaultValue) => {
            const value = this.getNestedValue(variables, varPath);

            if (value !== undefined && value !== null && value !== '') {
                return String(value);
            }

            if (defaultValue !== undefined) {
                return defaultValue.trim();
            }

            return '';
        });
    }

    private getNestedValue(obj: TemplateVariables, path: string): any {
        const parts = path.split('.');
        let current: any = obj;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * **render()** - Raccourci pour charger et rendre un template
     *
     * @param templateName - Nom du template
     * @param variables - Variables à substituer
     * @returns Le template rendu
     */
    render(templateName: string, variables: TemplateVariables): string {
        const template = this.loadTemplate(templateName);
        return this.renderTemplate(template, variables);
    }

    /**
     * **writeConfig()** - Écrit un fichier de configuration depuis un template
     *
     * @param templateName - Nom du template
     * @param targetPath - Chemin du fichier de destination
     * @param variables - Variables à substituer
     * @param options - Options d'écriture
     */
    writeConfig(
        templateName: string,
        targetPath: string,
        variables: TemplateVariables,
        options: WriteConfigOptions = {}
    ): void {
        let content = this.render(templateName, variables);

        // IMPORTANT: Toujours convertir en format Unix (LF) pour éviter les problèmes
        // Les fichiers avec CRLF (Windows) cassent les scripts Linux !
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '');

        // Créer les répertoires parents si nécessaire
        if (options.createDirs !== false) {
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // Écrire le fichier
        if (options.append) {
            fs.appendFileSync(targetPath, content, { mode: options.mode });
        } else {
            fs.writeFileSync(targetPath, content, { mode: options.mode });
        }

        // Changer le propriétaire si spécifié (Linux uniquement)
        if (options.owner && process.platform !== 'win32') {
            const [user, group] = options.owner.split(':');
            try {
                const { execSync } = require('child_process');
                execSync(`chown ${user}:${group || user} "${targetPath}"`);
            } catch {
                // Ignorer si on n'a pas les permissions
            }
        }
    }

    /**
     * **renderToString()** - Rend un template et retourne le résultat sans écrire de fichier
     *
     * Utile pour prévisualiser le résultat ou pour des cas où on veut
     * manipuler le contenu avant de l'écrire.
     */
    renderToString(templateName: string, variables: TemplateVariables): string {
        return this.render(templateName, variables);
    }
}

/**
 * Instance globale du gestionnaire de templates
 */
export const templateManager = new TemplateManager();

/**
 * Fonction utilitaire pour rendre un template rapidement
 */
export function renderConfig(templateName: string, variables: TemplateVariables): string {
    return templateManager.render(templateName, variables);
}

/**
 * Fonction utilitaire pour écrire une configuration rapidement
 */
export function writeConfig(
    templateName: string,
    targetPath: string,
    variables: TemplateVariables,
    options?: WriteConfigOptions
): void {
    templateManager.writeConfig(templateName, targetPath, variables, options);
}
