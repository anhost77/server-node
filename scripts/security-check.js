#!/usr/bin/env node

/**
 * ServerFlow Security Check Script
 *
 * Validates code against security requirements defined in CONTRIBUTING.md
 * Run with: pnpm security:check
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m'
};

let errors = 0;
let warnings = 0;

function log(type, message) {
    const prefix = {
        error: `${COLORS.RED}❌ ERROR${COLORS.RESET}`,
        warn: `${COLORS.YELLOW}⚠️  WARN${COLORS.RESET}`,
        pass: `${COLORS.GREEN}✅ PASS${COLORS.RESET}`,
        info: `${COLORS.BLUE}ℹ️  INFO${COLORS.RESET}`
    };
    console.log(`${prefix[type]}: ${message}`);
}

function checkForbiddenPatterns(dir) {
    // Note: Patterns use character classes to avoid self-detection
    const forbiddenPatterns = [
        { pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/g, message: 'MD5 hash detected - use SHA-256 or better' },
        { pattern: /createHash\s*\(\s*['"]sha1['"]\s*\)/g, message: 'SHA-1 hash detected - use SHA-256 or better' },
        { pattern: /generateKeyPairSync\s*\(\s*['"]rsa['"]/g, message: 'RSA key generation - use Ed25519' },
        { pattern: /from\s+['"]bcrypt['"]/g, message: 'bcrypt import - use argon2 instead' },
        { pattern: /require\s*\(\s*['"]bcrypt['"]\s*\)/g, message: 'bcrypt require - use argon2 instead' },
        { pattern: /[R][S][A]-SHA256/g, message: 'RSA-SHA256 algorithm - use Ed25519' },
        { pattern: /[R][S][A]-SHA1(?![\d])/g, message: 'RSA-SHA1 algorithm - use Ed25519' },
    ];

    const secretPatterns = [
        { pattern: /ghp_[A-Za-z0-9]{36}/g, message: 'GitHub personal access token' },
        { pattern: /gho_[A-Za-z0-9]{36}/g, message: 'GitHub OAuth token' },
        { pattern: /sk_live_[A-Za-z0-9]{24,}/g, message: 'Stripe live secret key' },
        { pattern: /pk_live_[A-Za-z0-9]{24,}/g, message: 'Stripe live publishable key' },
        { pattern: /AKIA[0-9A-Z]{16}/g, message: 'AWS Access Key ID' },
        { pattern: /-----BEGIN (RSA )?PRIVATE KEY-----/g, message: 'Private key in source' },
    ];

    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                if (!['node_modules', '.git', 'dist', 'build', 'scripts'].includes(file)) {
                    walkDir(filePath);
                }
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                const content = fs.readFileSync(filePath, 'utf-8');

                // Check forbidden patterns
                for (const { pattern, message } of forbiddenPatterns) {
                    if (pattern.test(content)) {
                        log('error', `${message} in ${filePath}`);
                        errors++;
                    }
                }

                // Check secrets (warning level, might be false positives)
                for (const { pattern, message } of secretPatterns) {
                    if (pattern.test(content)) {
                        log('error', `Potential ${message} in ${filePath}`);
                        errors++;
                    }
                }
            }
        }
    }

    walkDir(dir);
}

function checkEd25519Usage(dir) {
    const cryptoFiles = [];

    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                if (!['node_modules', '.git', 'dist', 'build', 'scripts'].includes(file)) {
                    walkDir(filePath);
                }
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (content.includes('generateKeyPairSync') || content.includes('createSign') || content.includes('createVerify')) {
                    cryptoFiles.push({ path: filePath, content });
                }
            }
        }
    }

    walkDir(dir);

    for (const { path: filePath, content } of cryptoFiles) {
        if (content.includes("'ed25519'") || content.includes('"ed25519"')) {
            log('pass', `Ed25519 usage found in ${filePath}`);
        } else if (content.includes('generateKeyPairSync')) {
            log('warn', `Key generation in ${filePath} - verify Ed25519 is used`);
            warnings++;
        }
    }
}

function checkSensitiveLogging(dir) {
    const sensitivePatterns = [
        /console\.(log|info|debug|warn)\s*\([^)]*password/gi,
        /console\.(log|info|debug|warn)\s*\([^)]*token(?!ize)/gi,
        /console\.(log|info|debug|warn)\s*\([^)]*secret/gi,
        /console\.(log|info|debug|warn)\s*\([^)]*apiKey/gi,
        /console\.(log|info|debug|warn)\s*\([^)]*privateKey/gi,
    ];

    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                if (!['node_modules', '.git', 'dist', 'build', 'scripts'].includes(file)) {
                    walkDir(filePath);
                }
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                const content = fs.readFileSync(filePath, 'utf-8');
                for (const pattern of sensitivePatterns) {
                    if (pattern.test(content)) {
                        log('warn', `Potential sensitive data logging in ${filePath}`);
                        warnings++;
                        break;
                    }
                }
            }
        }
    }

    walkDir(dir);
}

function checkZodValidation(dir) {
    // Check that API routes use Zod validation
    const apiDirs = [
        path.join(dir, 'apps', 'control-plane', 'src'),
    ];

    for (const apiDir of apiDirs) {
        if (!fs.existsSync(apiDir)) continue;

        const indexPath = path.join(apiDir, 'index.ts');
        if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, 'utf-8');
            if (content.includes('fastify.post') || content.includes('fastify.put') || content.includes('fastify.patch')) {
                if (!content.includes('z.object') && !content.includes('Schema.parse')) {
                    log('warn', `API routes in ${indexPath} may not have Zod validation`);
                    warnings++;
                }
            }
        }
    }
}

// Run checks
console.log('\n🔒 ServerFlow Security Check\n');
console.log('═'.repeat(50));

console.log('\n📋 Checking for forbidden patterns...');
checkForbiddenPatterns(path.join(__dirname, '..'));

console.log('\n🔐 Checking Ed25519 usage...');
checkEd25519Usage(path.join(__dirname, '..'));

console.log('\n📝 Checking for sensitive logging...');
checkSensitiveLogging(path.join(__dirname, '..'));

console.log('\n✅ Checking Zod validation...');
checkZodValidation(path.join(__dirname, '..'));

console.log('\n' + '═'.repeat(50));
console.log(`\n📊 Results: ${COLORS.RED}${errors} errors${COLORS.RESET}, ${COLORS.YELLOW}${warnings} warnings${COLORS.RESET}\n`);

if (errors > 0) {
    console.log(`${COLORS.RED}❌ Security check failed! Fix the errors above.${COLORS.RESET}`);
    console.log(`   See CONTRIBUTING.md for security guidelines.\n`);
    process.exit(1);
} else if (warnings > 0) {
    console.log(`${COLORS.YELLOW}⚠️  Security check passed with warnings.${COLORS.RESET}`);
    console.log(`   Review the warnings above.\n`);
    process.exit(0);
} else {
    console.log(`${COLORS.GREEN}✅ All security checks passed!${COLORS.RESET}\n`);
    process.exit(0);
}
