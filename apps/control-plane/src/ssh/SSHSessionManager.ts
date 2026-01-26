import { Client, ClientChannel } from 'ssh2';
import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';

export interface SSHCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface SSHSession {
  id: string;
  client: Client;
  shell?: ClientChannel;
  socket: WebSocket;
  createdAt: number;
  verboseMode: boolean;
  status: 'connecting' | 'preflight' | 'installing' | 'complete' | 'error';
  step: number;
}

const INSTALL_STEPS = [
  { step: 1, name: 'connect', label: 'Connecting to server' },
  { step: 2, name: 'preflight', label: 'Running pre-flight checks' },
  { step: 3, name: 'deps', label: 'Installing dependencies' },
  { step: 4, name: 'agent', label: 'Configuring agent' },
  { step: 5, name: 'service', label: 'Starting service' },
];

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max
const MAX_SESSIONS_PER_USER = 3;

// Pre-flight check script (embedded for security - not fetched)
const PREFLIGHT_SCRIPT = `#!/bin/bash
set -e

# Check 1: Debian/Ubuntu
if [ ! -f /etc/debian_version ]; then
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "ERROR:UNSUPPORTED_OS:$NAME"
    else
        echo "ERROR:UNSUPPORTED_OS:Unknown"
    fi
    exit 1
fi

# Get OS info
. /etc/os-release
echo "STATUS:OS_DETECTED:$PRETTY_NAME"

# Check 2: curl
if ! command -v curl &>/dev/null; then
    echo "STATUS:INSTALLING_CURL"
    apt-get update -qq && apt-get install -y -qq curl || {
        echo "ERROR:CURL_INSTALL_FAILED"
        exit 1
    }
fi
echo "STATUS:CURL_OK"

# Check 3: sudo/root
if [ "$(id -u)" -ne 0 ]; then
    if ! sudo -n true 2>/dev/null; then
        echo "ERROR:NO_SUDO"
        exit 1
    fi
    echo "STATUS:SUDO_OK"
else
    echo "STATUS:ROOT_OK"
fi

echo "STATUS:PREFLIGHT_OK"
`;

export class SSHSessionManager {
  private sessions = new Map<string, SSHSession>();
  private userSessionCounts = new Map<string, number>();
  private cleanupIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Create a new SSH session
   */
  async createSession(
    userId: string,
    credentials: SSHCredentials,
    socket: WebSocket,
    verboseMode: boolean = false
  ): Promise<string> {
    // Rate limit: max sessions per user
    const userCount = this.userSessionCounts.get(userId) || 0;
    if (userCount >= MAX_SESSIONS_PER_USER) {
      throw new Error('MAX_SESSIONS_EXCEEDED');
    }

    const sessionId = randomUUID();
    const client = new Client();

    const session: SSHSession = {
      id: sessionId,
      client,
      socket,
      createdAt: Date.now(),
      verboseMode,
      status: 'connecting',
      step: 1,
    };

    this.sessions.set(sessionId, session);
    this.userSessionCounts.set(userId, userCount + 1);

    // Setup session timeout
    const timeout = setTimeout(() => {
      this.endSession(sessionId, userId);
      this.sendToSocket(socket, { type: 'ERROR', code: 'TIMEOUT', message: 'Session timed out after 10 minutes' });
    }, SESSION_TIMEOUT_MS);
    this.cleanupIntervals.set(sessionId, timeout);

    // Connect to SSH
    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        this.sendStatus(session, 1, 'Connected to server');
        resolve(sessionId);
      });

      client.on('error', (err) => {
        this.handleSSHError(session, err);
        this.endSession(sessionId, userId);
        reject(err);
      });

      client.on('close', () => {
        if (session.status !== 'complete') {
          this.sendToSocket(socket, { type: 'ERROR', code: 'SSH_DISCONNECT', message: 'Connection closed unexpectedly' });
        }
        this.endSession(sessionId, userId);
      });

      // Handle keyboard-interactive authentication (used by many SSH servers instead of password)
      client.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
        console.log('[SSH Debug] keyboard-interactive:', { name, instructions, prompts: prompts.map(p => p.prompt) });
        // Respond with password for all prompts (typically just one: "Password:")
        const responses = prompts.map(() => credentials.password || '');
        finish(responses);
      });

      // Connect with credentials
      const connectConfig: any = {
        host: credentials.host,
        port: credentials.port || 22,
        username: credentials.username,
        readyTimeout: 30000,
        // Auto-accept host keys (like StrictHostKeyChecking=no in OpenSSH)
        // This is safe for our use case: installing agents on new servers
        hostVerifier: () => true,
        // Debug: log SSH negotiation details
        debug: (msg: string) => {
          if (msg.includes('Auth') || msg.includes('password') || msg.includes('keyboard')) {
            console.log('[SSH Debug]', msg);
          }
        },
      };

      if (credentials.privateKey) {
        connectConfig.privateKey = credentials.privateKey;
      } else if (credentials.password) {
        connectConfig.password = credentials.password;
        // Enable keyboard-interactive auth (many servers use this instead of password)
        connectConfig.tryKeyboard = true;
      }

      client.connect(connectConfig);
    });
  }

  /**
   * Run pre-flight checks on the remote server
   */
  async runPreflightChecks(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('SESSION_NOT_FOUND');

    session.status = 'preflight';
    this.sendStatus(session, 2, 'Running pre-flight checks');

    return new Promise((resolve) => {
      session.client.exec(PREFLIGHT_SCRIPT, (err, stream) => {
        if (err) {
          this.sendToSocket(session.socket, { type: 'ERROR', code: 'EXEC_FAILED', message: err.message });
          resolve(false);
          return;
        }

        let output = '';

        stream.on('data', (data: Buffer) => {
          const text = data.toString();
          output += text;

          // Parse status messages
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('STATUS:')) {
              const status = line.substring(7);
              if (session.verboseMode) {
                this.sendOutput(session, `[Preflight] ${status}`);
              }
              if (status === 'PREFLIGHT_OK') {
                this.sendStatus(session, 2, 'Pre-flight checks passed');
              }
            } else if (line.startsWith('ERROR:')) {
              const [code, ...details] = line.substring(6).split(':');
              this.sendToSocket(session.socket, {
                type: 'ERROR',
                code,
                message: this.getErrorMessage(code, details.join(':')),
              });
            }
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          if (session.verboseMode) {
            this.sendOutput(session, data.toString(), true);
          }
        });

        stream.on('close', (code: number) => {
          resolve(code === 0);
        });
      });
    });
  }

  /**
   * Run the installation script
   */
  async runInstallation(sessionId: string, controlPlaneUrl: string, registrationToken: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('SESSION_NOT_FOUND');

    session.status = 'installing';
    this.sendStatus(session, 3, 'Installing dependencies');

    // Use proper flags format for install.sh: --token, --url, and --extras to install monitoring tools
    const installCommand = `curl -sSL ${controlPlaneUrl}/install.sh | bash -s -- --token ${registrationToken} --url ${controlPlaneUrl} --extras`;
    console.log('[SSH] Running install command:', installCommand);

    return new Promise((resolve) => {
      session.client.exec(installCommand, { pty: true }, (err, stream) => {
        if (err) {
          this.sendToSocket(session.socket, { type: 'ERROR', code: 'INSTALL_FAILED', message: err.message });
          resolve(false);
          return;
        }

        stream.on('data', (data: Buffer) => {
          const text = data.toString();

          // Always send output for installation progress
          this.sendOutput(session, text);

          // Parse install progress - match script output more precisely
          if (text.includes('[1/4]') || text.includes('Installing git')) {
            this.sendStatus(session, 3, 'Installing system dependencies');
          } else if (text.includes('[2/4]') || text.includes('Installing Node.js')) {
            this.sendStatus(session, 3, 'Installing Node.js');
          } else if (text.includes('[3/4]') || text.includes('Installing pnpm')) {
            this.sendStatus(session, 3, 'Installing pnpm');
          } else if (text.includes('[4/4]') || text.includes('Preparing workspace')) {
            this.sendStatus(session, 4, 'Preparing workspace');
          } else if (text.includes('Installing Deps') || text.includes('Initializing workspace')) {
            this.sendStatus(session, 4, 'Installing agent dependencies');
          } else if (text.includes('Configuring background service') || text.includes('systemd')) {
            this.sendStatus(session, 5, 'Configuring service');
          } else if (text.includes('optional monitoring') || text.includes('Installing optional')) {
            this.sendStatus(session, 5, 'Installing monitoring tools');
          }

          // Success detection - multiple patterns for robustness
          if (text.includes('Installation Success') ||
              text.includes('Agent is now running') ||
              text.includes('Check your Dashboard')) {
            session.status = 'complete';
            this.sendStatus(session, 5, 'Installation complete');
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          // Filter out common non-error stderr output
          if (!text.includes('% Total') && !text.includes('Dload')) {
            this.sendOutput(session, text, true);
          }
        });

        stream.on('close', (code: number) => {
          if (code === 0) {
            // Ensure we send the final status update before COMPLETE
            session.status = 'complete';
            this.sendStatus(session, 5, 'Installation complete');
            // Small delay to ensure status is processed before COMPLETE
            setTimeout(() => {
              this.sendToSocket(session.socket, { type: 'COMPLETE' });
              resolve(true);
            }, 100);
          } else {
            this.sendToSocket(session.socket, {
              type: 'ERROR',
              code: 'INSTALL_EXIT_CODE',
              message: `Installation exited with code ${code}`,
            });
            resolve(false);
          }
        });
      });
    });
  }

  /**
   * Run agent update (for servers with old agent that don't support UPDATE_AGENT)
   */
  async runUpdate(sessionId: string, controlPlaneUrl: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('SESSION_NOT_FOUND');

    session.status = 'installing';
    this.sendStatus(session, 1, 'Starting agent update');

    // Simple update script - downloads bundle, extracts, restarts service
    const updateScript = `
      set -e
      INSTALL_DIR="$HOME/.server-flow/agent-bundle"
      echo "📦 Downloading latest agent bundle..."
      curl -L --progress-bar "${controlPlaneUrl}/agent-bundle.tar.gz" -o /tmp/agent-bundle-update.tar.gz
      echo "📂 Backing up current bundle..."
      if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$HOME/.server-flow/agent-bundle-backup" 2>/dev/null || true
        mv "$INSTALL_DIR" "$HOME/.server-flow/agent-bundle-backup"
      fi
      mkdir -p "$INSTALL_DIR"
      echo "📦 Extracting new bundle..."
      tar -xzf /tmp/agent-bundle-update.tar.gz -C "$INSTALL_DIR" --no-same-owner
      rm /tmp/agent-bundle-update.tar.gz
      cd "$INSTALL_DIR"
      echo "🔨 Installing dependencies..."
      pnpm install --prod --ignore-scripts 2>&1 || npm install --omit=dev --ignore-scripts 2>&1
      echo "🔄 Restarting agent service..."
      sudo systemctl restart server-flow-agent || pm2 restart serverflow-agent || true
      echo "✨ Update complete!"
    `;

    return new Promise((resolve) => {
      session.client.exec(updateScript, { pty: true }, (err, stream) => {
        if (err) {
          this.sendToSocket(session.socket, { type: 'ERROR', code: 'UPDATE_FAILED', message: err.message });
          resolve(false);
          return;
        }

        stream.on('data', (data: Buffer) => {
          const text = data.toString();
          this.sendOutput(session, text);

          // Parse update progress
          if (text.includes('Downloading')) {
            this.sendStatus(session, 1, 'Downloading agent bundle');
          } else if (text.includes('Backing up')) {
            this.sendStatus(session, 2, 'Backing up current version');
          } else if (text.includes('Extracting')) {
            this.sendStatus(session, 2, 'Extracting new bundle');
          } else if (text.includes('Installing dependencies')) {
            this.sendStatus(session, 3, 'Installing dependencies');
          } else if (text.includes('Restarting')) {
            this.sendStatus(session, 4, 'Restarting agent');
          } else if (text.includes('Update complete')) {
            session.status = 'complete';
            this.sendStatus(session, 4, 'Update complete');
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          if (!text.includes('% Total') && !text.includes('Dload')) {
            this.sendOutput(session, text, true);
          }
        });

        stream.on('close', (code: number) => {
          if (code === 0) {
            session.status = 'complete';
            this.sendStatus(session, 4, 'Update complete');
            setTimeout(() => {
              this.sendToSocket(session.socket, { type: 'COMPLETE' });
              resolve(true);
            }, 100);
          } else {
            this.sendToSocket(session.socket, {
              type: 'ERROR',
              code: 'UPDATE_EXIT_CODE',
              message: `Update exited with code ${code}`,
            });
            resolve(false);
          }
        });
      });
    });
  }

  /**
   * Send raw input to the SSH shell (for interactive mode)
   */
  sendInput(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.shell) {
      session.shell.write(data);
    }
  }

  /**
   * End an SSH session and cleanup
   */
  endSession(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear timeout
    const timeout = this.cleanupIntervals.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.cleanupIntervals.delete(sessionId);
    }

    // Close SSH connection
    try {
      session.client.end();
    } catch (e) {
      // Ignore close errors
    }

    // Update user session count
    const userCount = this.userSessionCounts.get(userId) || 1;
    this.userSessionCounts.set(userId, Math.max(0, userCount - 1));

    // Remove session
    this.sessions.delete(sessionId);
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): SSHSession | undefined {
    return this.sessions.get(sessionId);
  }

  // Private helpers

  private sendToSocket(socket: WebSocket, msg: any): void {
    if (socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify(msg));
    }
  }

  private sendStatus(session: SSHSession, step: number, message: string): void {
    session.step = step;
    this.sendToSocket(session.socket, {
      type: 'STATUS',
      step,
      total: INSTALL_STEPS.length,
      message,
      stepName: INSTALL_STEPS[step - 1]?.name || 'unknown',
    });
  }

  private sendOutput(session: SSHSession, data: string, isStderr: boolean = false): void {
    // In simple mode, only send important output
    if (!session.verboseMode && !this.isImportantOutput(data)) {
      return;
    }

    this.sendToSocket(session.socket, {
      type: 'OUTPUT',
      data,
      isStderr,
    });
  }

  private isImportantOutput(text: string): boolean {
    const importantPatterns = [
      'error', 'Error', 'ERROR',
      'warning', 'Warning', 'WARNING',
      'success', 'Success', 'SUCCESS',
      'complete', 'Complete', 'COMPLETE',
      'failed', 'Failed', 'FAILED',
      'Installing', 'Configuring', 'Starting',
      'agent', 'service',
    ];
    return importantPatterns.some(p => text.includes(p));
  }

  private handleSSHError(session: SSHSession, err: Error): void {
    let code = 'CONNECTION_ERROR';
    let message = err.message;

    if (err.message.includes('ECONNREFUSED')) {
      code = 'CONNECTION_REFUSED';
      message = 'Cannot connect. Check IP address and port.';
    } else if (err.message.includes('Authentication') || err.message.includes('auth')) {
      code = 'AUTH_FAILED';
      message = 'Authentication failed. Check username and password/key.';
    } else if (err.message.includes('ETIMEDOUT') || err.message.includes('timeout')) {
      code = 'TIMEOUT';
      message = 'Connection timed out. Server may be unreachable.';
    } else if (err.message.includes('EHOSTUNREACH')) {
      code = 'HOST_UNREACHABLE';
      message = 'Host unreachable. Check network and firewall.';
    }

    session.status = 'error';
    this.sendToSocket(session.socket, { type: 'ERROR', code, message });
  }

  private getErrorMessage(code: string, details?: string): string {
    const messages: Record<string, string> = {
      'UNSUPPORTED_OS': `This server runs ${details || 'an unsupported OS'}. ServerFlow requires Debian or Ubuntu.`,
      'NO_SUDO': 'Root access required. Try connecting as root or ensure sudo is configured.',
      'CURL_INSTALL_FAILED': 'Failed to install curl. Check internet connectivity.',
    };
    return messages[code] || `Error: ${code}`;
  }
}

// Singleton instance
export const sshManager = new SSHSessionManager();
