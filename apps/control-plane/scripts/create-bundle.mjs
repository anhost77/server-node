import { create } from 'tar';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

async function createBundle() {
    console.log('📦 Creating agent bundle...');

    const outputFile = path.join(__dirname, '../public/agent-bundle.tar.gz');

    try {
        await create(
            {
                gzip: true,
                file: outputFile,
                cwd: rootDir
            },
            [
                'apps/agent',
                'packages/shared',
                'pnpm-workspace.yaml',
                'package.json',
                'pnpm-lock.yaml'
            ]
        );

        console.log('✅ Bundle created successfully at:', outputFile);
    } catch (error) {
        console.error('❌ Failed to create bundle:', error);
        process.exit(1);
    }
}

createBundle();
