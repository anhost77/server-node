import { create } from 'tar';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

async function createBundle() {
    console.log('📦 Creating agent bundle...');

    const outputFile = path.join(__dirname, '../public/agent-bundle.tar.gz');
    const stagingDir = path.join(__dirname, '../.bundle-staging');

    try {
        // Clean up staging directory if exists
        if (fs.existsSync(stagingDir)) {
            fs.rmSync(stagingDir, { recursive: true });
        }
        fs.mkdirSync(stagingDir, { recursive: true });

        // Copy files to staging
        const filesToCopy = [
            'apps/agent',
            'packages/shared',
            'pnpm-workspace.yaml',
            'package.json',
            'pnpm-lock.yaml'
        ];

        for (const file of filesToCopy) {
            const src = path.join(rootDir, file);
            const dest = path.join(stagingDir, file);

            if (fs.existsSync(src)) {
                const destDir = path.dirname(dest);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }

                if (fs.statSync(src).isDirectory()) {
                    copyDirSync(src, dest);
                } else {
                    fs.copyFileSync(src, dest);
                }
            }
        }

        // Fix workspace:* references in agent's package.json
        const agentPkgPath = path.join(stagingDir, 'apps/agent/package.json');
        if (fs.existsSync(agentPkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(agentPkgPath, 'utf-8'));

            // Replace workspace:* with file: reference
            if (pkg.dependencies) {
                for (const [dep, version] of Object.entries(pkg.dependencies)) {
                    if (version === 'workspace:*') {
                        // Calculate relative path from apps/agent to packages/shared
                        pkg.dependencies[dep] = 'file:../../packages/shared';
                        console.log(`  ✏️ Fixed ${dep}: workspace:* → file:../../packages/shared`);
                    }
                }
            }

            fs.writeFileSync(agentPkgPath, JSON.stringify(pkg, null, 4));
        }

        // Create tarball from staging directory
        await create(
            {
                gzip: true,
                file: outputFile,
                cwd: stagingDir
            },
            fs.readdirSync(stagingDir)
        );

        // Clean up staging
        fs.rmSync(stagingDir, { recursive: true });

        console.log('✅ Bundle created successfully at:', outputFile);
    } catch (error) {
        console.error('❌ Failed to create bundle:', error);
        // Clean up on error
        if (fs.existsSync(stagingDir)) {
            fs.rmSync(stagingDir, { recursive: true });
        }
        process.exit(1);
    }
}

// Helper to recursively copy directories
function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Skip node_modules directory only (dist is needed for compiled code)
        if (entry.name === 'node_modules') {
            continue;
        }

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

createBundle();
