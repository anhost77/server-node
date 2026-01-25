# ServerFlow Deployment System

## Overview

ServerFlow provides automated deployments with intelligent project type detection, build optimization, health checking, and automatic rollback capabilities.

## Deployment Flow

### High-Level Process

```
1. User initiates deployment (Dashboard / MCP / API)
         |
         v
2. Control Plane validates request
   - Check user permissions
   - Verify usage limits
   - Find target server
         |
         v
3. Control Plane creates SIGNED DEPLOY command
         |
         v
4. Agent receives and verifies command
         |
         v
5. Agent executes deployment pipeline:
   a. Git clone/pull
   b. Detect project type
   c. Install dependencies
   d. Build (if applicable)
   e. Start application (PM2)
   f. Health check
   g. Rollback if failed
         |
         v
6. Status updates streamed to Control Plane
         |
         v
7. Dashboard reflects real-time progress
```

## Deployment Command

### Command Structure

```typescript
interface DeployCommand {
    type: 'DEPLOY';
    appId: string;               // Unique application ID
    repoUrl: string;             // Git repository URL
    commitHash?: string;         // Specific commit (optional)
    branch?: string;             // Branch name (default: main)
    port?: number;               // Main application port
    ports?: Array<{              // Multiple port configuration
        port: number;
        name: string;
        isMain: boolean;
    }>;
    env?: Record<string, string>; // Environment variables
}
```

### Example

```json
{
    "type": "DEPLOY",
    "appId": "abc123",
    "repoUrl": "https://github.com/user/my-app.git",
    "branch": "main",
    "port": 3000,
    "env": {
        "NODE_ENV": "production",
        "DATABASE_URL": "postgres://..."
    }
}
```

## Project Type Detection

The agent automatically detects project types based on files present in the repository.

### Current Detection Logic

```typescript
function detectProjectType(workDir: string, port: number): ProjectInfo {
    const pkgPath = path.join(workDir, 'package.json');

    if (fs.existsSync(pkgPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const hasStart = Boolean(pkgJson.scripts?.start);
        return {
            type: 'nodejs',
            hasStartScript: hasStart,
            startScript: hasStart ? 'npm start' : `npx serve -s . -l ${port}`
        };
    }

    // No package.json = static site
    return {
        type: 'static',
        hasStartScript: false,
        startScript: `npx serve -s . -l ${port}`
    };
}
```

### Project Types

| Type | Detection | Install | Build | Start |
|------|-----------|---------|-------|-------|
| **Node.js** | `package.json` exists | `pnpm install` | `npm run build` (if exists) | `npm start` or `npx serve` |
| **Static** | No `package.json` | None | None | `npx serve -s . -l {port}` |

## Deployment Pipeline

### Step 1: Version Control

```typescript
// Clone or update repository
if (!fs.existsSync(path.join(workDir, '.git'))) {
    // Fresh clone
    await runCommand('git', ['clone', repoUrl, '.'], workDir);
} else {
    // Update existing
    await runCommand('git', ['fetch', '--all'], workDir);
}

// Checkout target (commit, branch, or default to 'main')
const target = commitHash || branch || 'main';
await runCommand('git', ['checkout', '-f', target], workDir);
```

### Step 2: Hot-Path Analysis

Before building, the agent analyzes changes to determine if a full rebuild is necessary:

```typescript
const isNoRelevantChange = DiffAnalyzer.shouldSkipBuild(
    workDir,
    oldHash,
    newHash
);

if (isNoRelevantChange && oldHash !== '') {
    // Skip build - only docs, tests, or config changed
    onLog('Hot-Path Triggered. Skipping Build.\n', 'stdout');
    buildSkipped = true;
}
```

### Step 3: Dependency Installation

For Node.js projects:

```typescript
if (hasPackageJson) {
    await runCommand('pnpm', ['install', '--frozen-lockfile'], workDir);
}
```

**Notes:**
- Uses `pnpm` for faster, more efficient installs
- `--frozen-lockfile` ensures reproducible builds
- Falls back to `npm` if pnpm is unavailable

### Step 4: Build

The build step only runs if a `build` script exists:

```typescript
const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

if (pkgJson.scripts?.build) {
    const buildCode = await runCommand('npm', ['run', 'build'], workDir, env);
    if (buildCode !== 0) {
        return { success: false, error: 'Build failed' };
    }
} else {
    onLog('No build script found, skipping build step\n', 'stdout');
}
```

### Step 5: Start Application

Applications are managed by PM2:

```typescript
await processManager.startApp(repoName, workDir, env, startScript);
```

PM2 provides:
- Process monitoring and auto-restart
- Log management
- Cluster mode support
- Zero-downtime reloads

### Step 6: Health Check

After starting, the agent verifies the application is responding:

```typescript
async function verifyAppHealth(port: number, timeoutMs = 15000): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const connected = await new Promise<boolean>((resolve) => {
            const socket = net.connect(port, 'localhost');
            socket.on('connect', () => { socket.end(); resolve(true); });
            socket.on('error', () => resolve(false));
        });

        if (connected) return true;
        await sleep(1000);
    }
    return false;
}
```

**Health check behavior:**
- Attempts TCP connection to application port
- Retries every second for 15 seconds
- Considers app healthy if it accepts connections

### Step 7: Automatic Rollback

If health check fails, the agent automatically rolls back:

```typescript
if (!isHealthy) {
    onLog('HEALTH CHECK FAILED. Initiating Rollback...\n', 'stderr');

    if (oldHash) {
        // Revert to previous commit
        await runCommand('git', ['checkout', '-f', oldHash], workDir);

        // Reinstall and rebuild
        await runCommand('pnpm', ['install'], workDir);
        if (pkgJson.scripts?.build) {
            await runCommand('npm', ['run', 'build'], workDir);
        }

        // Restart with old version
        await processManager.startApp(repoName, workDir, env, startScript);
        onLog('Rollback Successful.\n', 'stdout');
    } else {
        // No previous version - stop the app
        await processManager.stopApp(repoName);
    }
}
```

## Status Updates

The agent reports status throughout the deployment:

| Status | Description |
|--------|-------------|
| `cloning` | Git clone/fetch in progress |
| `installing` | Running dependency installation |
| `building` | Running build script |
| `starting` | Starting application via PM2 |
| `success` | Deployment completed successfully |
| `build_skipped` | Hot-path triggered, skipped build |
| `failure` | Deployment failed |
| `rollback` | Health check failed, rolled back |

## Log Streaming

Real-time logs are streamed to the Control Plane:

```typescript
// Agent sends log messages
ws.send(JSON.stringify({
    type: 'LOG_STREAM',
    data: 'Installing dependencies...\n',
    stream: 'stdout',
    repoUrl: context.repoUrl
}));
```

Log streams:
- `stdout` - Normal output
- `stderr` - Error output

## Application Management

### Lifecycle Actions

```typescript
interface AppActionCommand {
    type: 'APP_ACTION';
    appId: string;
    action: 'START' | 'STOP' | 'RESTART' | 'DELETE';
    repoUrl: string;
}
```

| Action | PM2 Command | Description |
|--------|-------------|-------------|
| `START` | `pm2 start` | Start stopped application |
| `STOP` | `pm2 stop` | Stop running application |
| `RESTART` | `pm2 restart` | Restart application |
| `DELETE` | `pm2 delete` | Remove from PM2 |

### Port Detection

After successful deployment, the agent detects actual listening ports:

```typescript
setTimeout(async () => {
    const detectedPorts = await processManager.getAppPorts(appName);
    if (detectedPorts.length > 0) {
        ws.send(JSON.stringify({
            type: 'DETECTED_PORTS',
            appId: msg.appId,
            repoUrl: msg.repoUrl,
            ports: detectedPorts
        }));
    }
}, 3000);
```

## Nginx Reverse Proxy

### Domain Provisioning

```typescript
interface ProvisionDomainCommand {
    type: 'PROVISION_DOMAIN';
    domain: string;
    port: number;
    repoUrl: string;
    appId?: string;
}
```

### Generated Nginx Configuration

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL Provisioning

If Certbot is installed, SSL is automatically configured:

```bash
certbot --nginx -d example.com --non-interactive --agree-tos -m admin@example.com
```

### Proxy Deletion

```typescript
interface DeleteProxyCommand {
    type: 'DELETE_PROXY';
    serverId: string;
    domain: string;
}
```

Removes both:
- `/etc/nginx/sites-available/{domain}`
- `/etc/nginx/sites-enabled/{domain}`

## Directory Structure

Applications are deployed to:

```
~/.server-flow/
└── apps/
    └── my-app/           # Repository name
        ├── .git/
        ├── package.json
        ├── node_modules/
        └── dist/         # Build output
```

## Build Output Detection

Common build output directories that may be served:

| Directory | Framework |
|-----------|-----------|
| `dist/` | Vite, Vue CLI, generic |
| `build/` | Create React App |
| `.next/` | Next.js |
| `out/` | Next.js static export |
| `public/` | Static assets |

## Environment Variables

Environment variables are passed to both build and runtime:

```typescript
const proc = spawn(exe, args, {
    cwd: workDir,
    shell: false,
    env: {
        ...process.env,
        ...customEnv,
        NODE_ENV: 'production'
    }
});
```

**Note**: `NODE_ENV` is always set to `production` for deployments.

## Error Handling

### Build Failures

```typescript
const buildCode = await runCommand('npm', ['run', 'build'], workDir, env);
if (buildCode !== 0) {
    onLog(`Build failed with exit code ${buildCode}\n`, 'stderr');
    return { success: false, buildSkipped, healthCheckFailed: false };
}
```

### Process Errors

```typescript
proc.on('error', (err) => {
    onLog(`Process Error (${cmd}): ${err.message}\n`, 'stderr');
    resolve(1);
});
```

### Critical Errors

```typescript
try {
    // Deployment logic
} catch (err: any) {
    onLog(`Critical Deployment Error: ${err.message}\n`, 'stderr');
    return { success: false, buildSkipped, healthCheckFailed: false };
}
```

## Best Practices

### For Application Developers

1. **Define `start` script**: Without it, static server is used
2. **Optional `build` script**: Only runs if defined
3. **Use `pnpm-lock.yaml`**: Faster, more reliable installs
4. **Health endpoint**: Add `/health` for better checks
5. **Graceful shutdown**: Handle SIGTERM for zero-downtime

### For Operators

1. **Monitor logs**: Watch for deployment failures
2. **Set resource limits**: Configure PM2 cluster mode
3. **Backup before deploy**: For critical applications
4. **Use staging**: Test deployments before production

## Performance Optimizations

### Hot-Path Deployment

Skips build when only non-code files changed:
- Documentation (`*.md`, `docs/`)
- Tests (`*.test.ts`, `__tests__/`)
- Configuration that doesn't affect build

### Dependency Caching

- `pnpm` uses content-addressable storage
- `--frozen-lockfile` enables caching
- `node_modules/` persists between deployments

### Parallel Operations

The Control Plane can dispatch multiple deployments simultaneously to different agents.
