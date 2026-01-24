import { execSync } from 'node:child_process';
import path from 'node:path';

const IGNORED_PATTERNS = [
    /\.md$/,
    /\.gitignore$/,
    /^docs\//,
    /^tests\//,
    /^LICENSE$/,
    /\.txt$/
];

export class DiffAnalyzer {
    static shouldSkipBuild(workDir: string, oldHash: string, newHash: string): boolean {
        try {
            // If no old hash, we must build (first deployment)
            if (!oldHash || oldHash === newHash) return false;

            const output = execSync(`git diff --name-only ${oldHash} ${newHash}`, { cwd: workDir }).toString();
            const changedFiles = output.split('\n').filter(f => f.trim().length > 0);

            if (changedFiles.length === 0) return true;

            const allIgnored = changedFiles.every(file => {
                return IGNORED_PATTERNS.some(pattern => pattern.test(file));
            });

            return allIgnored;
        } catch (err) {
            console.error('[DiffAnalyzer] Failed to analyze diff:', err);
            return false; // Safety first: build if analyzer fails
        }
    }
}
