# Story 7.7: Server Infrastructure Configuration (Dashboard-Driven)

**Epic:** 7 - Multi-Runtime & DevOps Automation
**Status:** READY FOR IMPLEMENTATION
**Priority:** High
**Effort:** 5-7 days

---

## 1. Problem Statement

### Current Situation
The agent (`execution.ts`) supports multiple runtimes (Python, Go, Rust, Ruby, Docker), but the server installation script (`install.sh`) only installs Node.js + basic tools.

### Gap Analysis

| Component | Agent Supports | install.sh Installs |
|-----------|---------------|---------------------|
| Node.js | Yes | Yes |
| Python | Yes | No |
| Go | Yes | No |
| Rust | Yes | No |
| Ruby | Yes | No |
| Docker | Yes | No |
| PostgreSQL | Future | No |
| MySQL | Future | No |
| Redis | Future | No |

### Impact
- First deployment of non-Node.js apps will **fail**
- User sees cryptic "command not found" errors
- Poor user experience

---

## 2. Solution: Dashboard-Driven Server Configuration

### Key Principles

1. **L'utilisateur ne doit JAMAIS utiliser bash** (après l'installation initiale)
2. **install.sh reste inchangé** - Installation de base uniquement
3. **Étape intermédiaire** - Entre connexion serveur et déploiement d'apps
4. **Pas de stockage de credentials** - Tout géré par l'agent (sécurité Ed25519)
5. **Auto-détection** - L'agent scanne et rapporte ce qui est installé
6. **Console live** - Tous les logs visibles en temps réel
7. **Tout en parallèle** - Runtimes, databases, backups configurables ensemble

### User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER JOURNEY                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CONNECT NODE (existing)                                      │
│     └── install.sh → Agent installed (Node.js only)             │
│                                                                  │
│  2. SERVER SETTINGS (NEW - this story)                          │
│     ├── Runtimes: Python, Go, Docker, Rust, Ruby                │
│     ├── Databases: PostgreSQL, MySQL, Redis                     │
│     ├── Backups: S3, Rsync                                      │
│     └── [Live Console Output]                                   │
│                                                                  │
│  3. APPS & DOMAINS (existing)                                   │
│     └── Deploy applications                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Difference with Story 6.1 (Assisted SSH Installation)

| Aspect | Story 6.1 | Story 7.7 |
|--------|-----------|-----------|
| **When** | First server connection | After connection, before apps |
| **Where** | "Connect Node" modal | Dedicated "Server Settings" page |
| **Purpose** | Install agent | Configure infrastructure |
| **SSH Needed** | Yes (temporary credentials) | No (via installed agent) |
| **Credentials** | SSH user/password | None stored (agent manages all) |

---

## 3. Technical Architecture

### Communication Flow

```
┌─────────────┐                    ┌─────────────────┐                    ┌────────────┐
│  Dashboard  │◄──── WebSocket ───►│  Control Plane  │◄──── WebSocket ───►│   Agent    │
│   (Vue.js)  │                    │     (Hono)      │                    │  (Server)  │
└─────────────┘                    └─────────────────┘                    └────────────┘
      │                                    │                                    │
      │ 1. Open Server Settings            │                                    │
      │───────────────────────────────────►│                                    │
      │                                    │ 2. GET_SERVER_STATUS                │
      │                                    │───────────────────────────────────►│
      │                                    │                                    │
      │                                    │ 3. Auto-detect installed software  │
      │                                    │    (node --version, python3 --v...)│
      │                                    │                                    │
      │ 4. SERVER_STATUS                   │◄───────────────────────────────────│
      │    {runtimes: [...], dbs: [...]}   │                                    │
      │◄───────────────────────────────────│                                    │
      │                                    │                                    │
      │ 5. Click "Install Python"          │                                    │
      │───────────────────────────────────►│                                    │
      │                                    │ 6. INSTALL_RUNTIME {type: python}  │
      │                                    │───────────────────────────────────►│
      │                                    │                                    │
      │ 7. LOG (live stream)               │◄───────────────────────────────────│
      │    "$ apt-get update..."           │                                    │
      │◄───────────────────────────────────│                                    │
      │                                    │                                    │
      │ 8. RUNTIME_INSTALLED               │◄───────────────────────────────────│
      │    {type: python, version: 3.11}   │                                    │
      │◄───────────────────────────────────│                                    │
```

### WebSocket Messages

| Message | Direction | Payload |
|---------|-----------|---------|
| `GET_SERVER_STATUS` | CP → Agent | `{}` |
| `SERVER_STATUS` | Agent → CP | `{runtimes: RuntimeInfo[], databases: DatabaseInfo[], backups: BackupInfo[]}` |
| `INSTALL_RUNTIME` | CP → Agent | `{type: 'python' \| 'go' \| 'docker' \| 'rust' \| 'ruby'}` |
| `CONFIGURE_DATABASE` | CP → Agent | `{type: 'postgresql' \| 'mysql' \| 'redis', dbName: string, user: string}` |
| `CONFIGURE_BACKUP` | CP → Agent | `{provider: 's3' \| 'rsync', config: {...}}` |
| `INFRASTRUCTURE_LOG` | Agent → CP | `{message: string, stream: 'stdout' \| 'stderr'}` |
| `RUNTIME_INSTALLED` | Agent → CP | `{type: string, version: string, success: boolean}` |
| `DATABASE_CONFIGURED` | Agent → CP | `{type: string, connectionString: string, success: boolean}` |

### Security: No Credential Storage

All sensitive data (database passwords, API keys) is:
1. **Generated on the agent** (random secure passwords)
2. **Sent back to dashboard** for display (one-time view)
3. **Stored only on the server** (in config files, not in Control Plane DB)
4. **Signed with Ed25519** for all agent communications

```typescript
// Agent generates password, configures DB, returns connection string
// Control Plane NEVER stores the password
const result = await agent.send({
  type: 'CONFIGURE_DATABASE',
  payload: { type: 'postgresql', dbName: 'myapp' }
});
// result = { connectionString: 'postgresql://user:GENERATED_PWD@localhost/myapp' }
// User copies this, stores in their .env - we don't keep it
```

---

## 4. UI Design: Server Settings Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Server Settings - my-production-server                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🖥️ Server Info                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ IP: 192.168.1.100  |  Status: 🟢 Connected  |  Uptime: 5d 3h 12m  │ │
│  │ OS: Debian 12      |  CPU: 2 cores          |  RAM: 4GB           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  📦 RUNTIMES                                                             │
│  ┌────────────┬────────────┬────────────┬────────────┬────────────┐    │
│  │  Node.js   │   Python   │     Go     │   Docker   │    Rust    │    │
│  │  ✅ 20.11  │  ❌ --     │  ❌ --     │  ❌ --     │  ❌ --     │    │
│  │            │ [Install]  │ [Install]  │ [Install]  │ [Install]  │    │
│  │            │   ~200MB   │   ~500MB   │   ~500MB   │   ~1GB     │    │
│  └────────────┴────────────┴────────────┴────────────┴────────────┘    │
│                                                                          │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  🗄️ DATABASES                                                           │
│  ┌──────────────────┬──────────────────┬──────────────────┐            │
│  │    PostgreSQL    │      MySQL       │      Redis       │            │
│  │    ❌ Not Setup  │   ❌ Not Setup   │   ❌ Not Setup   │            │
│  │     [Setup]      │     [Setup]      │     [Setup]      │            │
│  └──────────────────┴──────────────────┴──────────────────┘            │
│                                                                          │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  💾 BACKUPS                                                              │
│  ○ Not configured  [Configure Backups...]                               │
│                                                                          │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  📋 INSTALLATION CONSOLE (live)                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ $ apt-get update                                                    │ │
│  │ Hit:1 http://deb.debian.org/debian bookworm InRelease              │ │
│  │ Reading package lists... Done                                       │ │
│  │ $ apt-get install -y python3 python3-pip python3-venv              │ │
│  │ Reading package lists... Done                                       │ │
│  │ Building dependency tree... Done                                    │ │
│  │ Setting up python3 (3.11.2-1+b1) ...                               │ │
│  │ ✅ Python 3.11.2 installed successfully                            │ │
│  │                                                                     │ │
│  │ [Clear]                                            [Copy to Clipboard]│
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  🤖 AI ASSISTANT (Future)                                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ "I detected an issue with the Python installation. The pip        │ │
│  │  package manager failed to install. Would you like me to:          │ │
│  │                                                                     │ │
│  │  [Retry Installation]  [Try Alternative Method]  [Skip for Now]   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Details

### 5.1 New Agent Module: `infrastructure.ts`

```typescript
// apps/agent/src/infrastructure.ts

export type RuntimeType = 'python' | 'go' | 'docker' | 'rust' | 'ruby';
export type DatabaseType = 'postgresql' | 'mysql' | 'redis';
export type BackupProvider = 's3' | 'rsync';

export interface RuntimeInfo {
  type: RuntimeType;
  installed: boolean;
  version?: string;
  estimatedSize: string;
}

export interface DatabaseInfo {
  type: DatabaseType;
  installed: boolean;
  running: boolean;
  version?: string;
}

export interface ServerStatus {
  runtimes: RuntimeInfo[];
  databases: DatabaseInfo[];
  system: {
    os: string;
    cpu: number;
    ram: string;
    disk: string;
  };
}

export class InfrastructureManager {
  private onLog: (msg: string, stream: 'stdout' | 'stderr') => void;

  constructor(onLog: (msg: string, stream: 'stdout' | 'stderr') => void) {
    this.onLog = onLog;
  }

  // Auto-detect installed software
  async getServerStatus(): Promise<ServerStatus> {
    return {
      runtimes: await this.detectRuntimes(),
      databases: await this.detectDatabases(),
      system: await this.getSystemInfo()
    };
  }

  // Install a runtime
  async installRuntime(type: RuntimeType): Promise<{ success: boolean; version?: string }> {
    const installers: Record<RuntimeType, () => Promise<string>> = {
      python: this.installPython.bind(this),
      go: this.installGo.bind(this),
      docker: this.installDocker.bind(this),
      rust: this.installRust.bind(this),
      ruby: this.installRuby.bind(this)
    };

    try {
      const version = await installers[type]();
      return { success: true, version };
    } catch (err) {
      this.onLog(`❌ Failed to install ${type}: ${err}`, 'stderr');
      return { success: false };
    }
  }

  // Configure a database (returns connection string, password NOT stored)
  async configureDatabase(type: DatabaseType, dbName: string): Promise<{
    success: boolean;
    connectionString?: string;
  }> {
    // Generate secure random password (never stored in Control Plane)
    const password = crypto.randomBytes(24).toString('base64url');
    const user = `${dbName}_user`;

    // Install and configure (password only exists on server)
    // Return connection string for user to copy
  }

  // Private installation methods
  private async installPython(): Promise<string> {
    await this.runCommand('apt-get', ['update']);
    await this.runCommand('apt-get', ['install', '-y',
      'python3', 'python3-pip', 'python3-venv',
      'python3-dev', 'build-essential'
    ]);
    // Install common WSGI servers
    await this.runCommand('pip3', ['install', 'uvicorn', 'gunicorn']);
    return this.getVersion('python3', ['--version']);
  }

  private async installGo(): Promise<string> {
    // Download official Go tarball
    const GO_VERSION = '1.22.0';
    await this.runCommand('wget', [
      `https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz`,
      '-O', '/tmp/go.tar.gz'
    ]);
    await this.runCommand('tar', ['-C', '/usr/local', '-xzf', '/tmp/go.tar.gz']);
    // Add to PATH
    await this.runCommand('bash', ['-c',
      'echo "export PATH=$PATH:/usr/local/go/bin" >> /etc/profile.d/go.sh'
    ]);
    return GO_VERSION;
  }

  private async installDocker(): Promise<string> {
    await this.runCommand('apt-get', ['update']);
    await this.runCommand('apt-get', ['install', '-y',
      'docker.io', 'docker-compose'
    ]);
    await this.runCommand('systemctl', ['enable', 'docker']);
    await this.runCommand('systemctl', ['start', 'docker']);
    return this.getVersion('docker', ['--version']);
  }

  private async installRust(): Promise<string> {
    // Use rustup for Rust installation
    await this.runCommand('curl', [
      '--proto', '=https', '--tlsv1.2', '-sSf',
      'https://sh.rustup.rs', '-o', '/tmp/rustup.sh'
    ]);
    await this.runCommand('sh', ['/tmp/rustup.sh', '-y']);
    return this.getVersion('/root/.cargo/bin/rustc', ['--version']);
  }

  private async installRuby(): Promise<string> {
    await this.runCommand('apt-get', ['update']);
    await this.runCommand('apt-get', ['install', '-y',
      'ruby', 'ruby-dev', 'ruby-bundler'
    ]);
    // Install common Ruby gems
    await this.runCommand('gem', ['install', 'puma', 'bundler']);
    return this.getVersion('ruby', ['--version']);
  }
}
```

### 5.2 Agent Handler Updates: `index.ts`

New message handlers in the agent WebSocket connection:

```typescript
// apps/agent/src/index.ts

case 'GET_SERVER_STATUS':
  const status = await infrastructureManager.getServerStatus();
  ws.send(JSON.stringify({ type: 'SERVER_STATUS', payload: status }));
  break;

case 'INSTALL_RUNTIME':
  const { type } = msg.payload;
  const result = await infrastructureManager.installRuntime(type);
  ws.send(JSON.stringify({
    type: 'RUNTIME_INSTALLED',
    payload: { ...result, type }
  }));
  break;

case 'CONFIGURE_DATABASE':
  const { type: dbType, dbName } = msg.payload;
  const dbResult = await infrastructureManager.configureDatabase(dbType, dbName);
  ws.send(JSON.stringify({
    type: 'DATABASE_CONFIGURED',
    payload: { ...dbResult, type: dbType }
  }));
  break;
```

### 5.3 Control Plane Proxy

The Control Plane acts as a WebSocket proxy between Dashboard and Agent:

```typescript
// apps/control-plane/src/index.ts

// Forward infrastructure messages to agent
case 'GET_SERVER_STATUS':
case 'INSTALL_RUNTIME':
case 'CONFIGURE_DATABASE':
case 'CONFIGURE_BACKUP':
  const agentWs = connectedNodes.get(msg.nodeId);
  if (agentWs) {
    agentWs.send(JSON.stringify(msg));
  }
  break;

// Forward logs from agent to dashboard
case 'INFRASTRUCTURE_LOG':
case 'SERVER_STATUS':
case 'RUNTIME_INSTALLED':
case 'DATABASE_CONFIGURED':
  const dashboardWs = dashboardConnections.get(msg.userId);
  if (dashboardWs) {
    dashboardWs.send(JSON.stringify(msg));
  }
  break;
```

### 5.4 Dashboard Components

```
apps/dashboard/src/
├── views/
│   └── ServerSettings.vue      # Main server settings page
├── components/
│   ├── RuntimeCard.vue         # Runtime install/status card
│   ├── DatabaseCard.vue        # Database setup card
│   ├── BackupConfig.vue        # Backup configuration
│   ├── LiveConsole.vue         # Real-time log output
│   └── AiAssistant.vue         # Future: AI helper (disabled for now)
```

---

## 6. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `apps/agent/src/infrastructure.ts` | CREATE | Infrastructure management module |
| `apps/agent/src/index.ts` | MODIFY | Add message handlers |
| `apps/control-plane/src/index.ts` | MODIFY | Add proxy logic for infrastructure |
| `apps/dashboard/src/views/ServerSettings.vue` | CREATE | Server settings page |
| `apps/dashboard/src/components/RuntimeCard.vue` | CREATE | Runtime card component |
| `apps/dashboard/src/components/DatabaseCard.vue` | CREATE | Database card component |
| `apps/dashboard/src/components/LiveConsole.vue` | CREATE | Live console component |
| `apps/dashboard/src/App.vue` | MODIFY | Add route to Server Settings |
| `packages/shared/src/index.ts` | MODIFY | Add infrastructure types |

---

## 7. Implementation Phases

### Phase 1: Agent Infrastructure Module (Day 1-2)
- [ ] Create `infrastructure.ts` with auto-detection
- [ ] Implement runtime installers (Python, Go, Docker, Rust, Ruby)
- [ ] Add WebSocket handlers in `index.ts`
- [ ] Test on local Debian VM

### Phase 2: Control Plane Proxy (Day 2)
- [ ] Add message routing for infrastructure commands
- [ ] Forward logs from agent to dashboard
- [ ] Add shared types in `packages/shared`

### Phase 3: Dashboard UI (Day 3-4)
- [ ] Create Server Settings page
- [ ] Build RuntimeCard, DatabaseCard components
- [ ] Implement LiveConsole with auto-scroll
- [ ] Add navigation from node list

### Phase 4: Database Configuration (Day 5)
- [ ] Implement PostgreSQL setup (apt + createdb + createuser)
- [ ] Implement MySQL setup
- [ ] Implement Redis setup
- [ ] Return connection strings (no storage)

### Phase 5: Testing & Polish (Day 6-7)
- [ ] End-to-end testing on real VPS
- [ ] Error handling and retry logic
- [ ] Translations (i18n)
- [ ] Documentation

### Future: Phase 6 (Post-MVP)
- [ ] AI Assistant for error resolution
- [ ] Backup configuration (S3, Rsync)
- [ ] Monitoring integration

---

## 8. Acceptance Criteria

- [ ] User can see installed runtimes on Server Settings page
- [ ] User can install Python/Go/Docker/Rust/Ruby with one click
- [ ] User can configure PostgreSQL/MySQL/Redis databases
- [ ] All installation logs are visible in live console
- [ ] Connection strings are displayed for user to copy (not stored)
- [ ] Auto-detection shows current state on page load
- [ ] Works on Debian 11/12 and Ubuntu 20.04/22.04

---

## 9. Out of Scope (Future Stories)

- AI Assistant for problem resolution (Story 7.8)
- Backup to S3/Rsync (Story 7.9)
- Monitoring & Alerting (Story 7.10)
- Non-Debian OS support (RHEL, Alpine)

---

## 10. Dependencies

### NPM Packages (already in project)
- No new packages required for agent
- Dashboard: No new packages (using existing Vue + WebSocket)

### System Requirements on Target Server
- Debian 11/12 or Ubuntu 20.04/22.04
- Root/sudo access (agent runs as systemd service)
- Internet access for package downloads
