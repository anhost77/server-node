# Story 7.7: Multi-Runtime Installer

**Epic:** 7 - Multi-Runtime & DevOps Automation
**Status:** DISCUSSION REQUIRED
**Priority:** High
**Effort:** TBD

## 1. Problem Statement

### Current Situation
The agent (`execution.ts`) now supports multiple runtimes:
- Python (FastAPI, Django, Flask)
- Go
- Rust
- Ruby (Rails, Sinatra)
- Docker

However, the server installation script (`install.sh`) only installs:
- Node.js 20 + pnpm
- git, nginx, certbot
- Optional tools (ufw, fail2ban, htop)

### Gap Analysis

| Runtime | Required Dependencies | Currently Installed |
|---------|----------------------|---------------------|
| Node.js | nodejs, pnpm | ✅ Yes |
| Python | python3, pip, venv, uvicorn, gunicorn | ❌ No |
| Go | golang | ❌ No |
| Rust | rustc, cargo | ❌ No |
| Ruby | ruby, bundler, puma | ❌ No |
| Docker | docker.io, docker-compose | ❌ No |

### Impact
- First deployment of non-Node.js apps will **fail**
- User will see cryptic "command not found" errors
- Poor user experience

---

## 2. Discussion Points (PM ↔ Dev)

### Option A: Modular Installation (Recommended)

**Concept:** Let users choose which runtimes to install.

```bash
# Base installation (current behavior)
curl -sSL $URL/install.sh | bash -s -- --token X --url Y

# Add specific runtimes
curl -sSL $URL/install.sh | bash -s -- --runtimes python,docker

# Or via dashboard checkbox during assisted setup
```

**Pros:**
- Minimal disk usage (~500MB base)
- Fast initial install
- User controls what's installed

**Cons:**
- User must know what they need upfront
- Two-step process for multi-runtime

---

### Option B: Full Installation

**Concept:** Install all supported runtimes by default.

```bash
# Installs everything
curl -sSL $URL/install.sh | bash -s -- --token X --url Y --full
```

**Estimated sizes:**
- Python + pip: ~200MB
- Go: ~500MB
- Rust: ~1GB
- Ruby + Bundler: ~300MB
- Docker: ~500MB
- **Total: ~2.5GB additional**

**Pros:**
- "It just works" for any project
- No runtime errors

**Cons:**
- Long install time (10-15 min)
- Wasted disk space if not used
- Larger attack surface

---

### Option C: On-Demand Installation

**Concept:** Detect missing runtime at deploy time, offer to install.

```typescript
// In execution.ts
if (projectInfo.type === 'python' && !commandExists('python3')) {
    this.onLog('🐍 Python not installed. Installing...', 'stdout');
    await this.runCommand('apt-get', ['install', '-y', 'python3', 'python3-pip']);
}
```

**Pros:**
- Only installs what's needed
- No upfront decisions

**Cons:**
- First deploy is slower
- Requires sudo at deploy time
- May fail if apt is locked

---

### Option D: Hybrid Approach

**Concept:** Base + runtime profiles

```bash
# Profiles defined in install.sh
--profile web      # Node.js + Python (most common)
--profile full     # All runtimes
--profile minimal  # Node.js only (current)
--profile docker   # Docker only (for containerized apps)
```

**Dashboard UI:**
```
┌─────────────────────────────────────────────────┐
│ Runtime Profile                                  │
├─────────────────────────────────────────────────┤
│ ○ Minimal (Node.js only) - 500MB, 2 min        │
│ ● Web Apps (Node.js + Python) - 800MB, 4 min   │
│ ○ Full Stack (All runtimes) - 3GB, 15 min      │
│ ○ Docker Only - 700MB, 3 min                   │
└─────────────────────────────────────────────────┘
```

---

## 3. Technical Considerations

### Dependency Versions
| Runtime | Recommended Version | Installation Method |
|---------|--------------------|--------------------|
| Python | 3.11+ | apt (python3) |
| Go | 1.21+ | Official tarball |
| Rust | stable | rustup |
| Ruby | 3.2+ | apt or rbenv |
| Docker | 24+ | docker.io package |

### Security Implications
- More runtimes = larger attack surface
- Each runtime needs security updates
- Docker requires privileged access

### Disk Space (VPS Reality)
- Typical VPS: 20-50GB SSD
- Full install: ~3GB (6-15% of disk)
- Consider: User apps, logs, databases

---

## 4. Recommendation

**Hybrid Approach (Option D)** with sensible defaults:

1. **Default profile: "web"** (Node.js + Python)
   - Covers 80%+ of use cases
   - Reasonable install time

2. **Dashboard shows profile selector** during assisted setup
   - Visual feedback on size/time
   - User can override

3. **On-demand fallback** for edge cases
   - If runtime missing, show clear error with install command
   - Don't auto-install (security concern)

---

## 5. Questions for PM

1. What's our target user profile?
   - Hobbyists with small VPS? → Minimal by default
   - Agencies with diverse stacks? → Full by default

2. Should we support on-demand installation?
   - Pros: Flexibility
   - Cons: Requires sudo, potential security issue

3. How do we handle runtime updates?
   - User responsibility?
   - Agent checks for updates?

4. Docker-in-Docker concerns?
   - If user deploys Docker apps, agent runs inside Docker?
   - Need to expose Docker socket?

---

## 6. Implementation Plan (If Approved)

### Phase 1: Profile System
- [ ] Add `--profile` flag to install.sh
- [ ] Implement profile definitions
- [ ] Update documentation

### Phase 2: Dashboard Integration
- [ ] Add profile selector to Assisted Setup
- [ ] Show estimated size/time
- [ ] Store preference for future nodes

### Phase 3: Runtime Verification
- [ ] Add runtime check before deploy
- [ ] Clear error messages with install instructions
- [ ] Optional: API endpoint to check server capabilities

---

## 7. Files to Modify

| File | Changes |
|------|---------|
| `apps/control-plane/public/install.sh` | Add profile system |
| `apps/dashboard/src/App.vue` | Add profile selector UI |
| `apps/agent/src/execution.ts` | Add runtime verification |
| `docs/DEPLOYMENT.md` | Document profiles |
