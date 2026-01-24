import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../..');

async function createBundle() {
    console.log('📦 Creating agent bundle...');

    const outputPath = path.join(__dirname, '../public/agent-bundle.tar.gz');

    // Files to include in the bundle
    const files = [
        'apps/agent',
        'packages/shared',
        'pnpm-workspace.yaml',
        'package.json',
        'pnpm-lock.yaml'
    ];

    try {
        // Use tar command (works on Linux, macOS, and Windows with Git Bash)
        const tarCmd = `tar -czf "${outputPath}" -C "${rootDir}" ${files.join(' ')}`;

        console.log('Running:', tarCmd);
        await execAsync(tarCmd);

        console.log('✅ Bundle created successfully at:', outputPath);
    } catch (error) {
        console.error('❌ Failed to create bundle:', error.message);
        console.log('\n💡 Alternative: Manually create the bundle on Linux/macOS:');
        console.log(`   cd ${rootDir}`);
        console.log(`   tar -czf apps/control-plane/public/agent-bundle.tar.gz ${files.join(' ')}`);
        process.exit(1);
    }
}

createBundle();
