# ServerFlow Multi-Runtime Support Roadmap

## Overview

ServerFlow aims to support multiple programming languages and deployment strategies beyond Node.js. This document outlines the planned multi-runtime support, detection mechanisms, and implementation details.

## Current State

### Supported (v1.0)

| Runtime | Status | Detection | Install | Build | Start |
|---------|--------|-----------|---------|-------|-------|
| **Node.js** | Supported | `package.json` | `pnpm install` | `npm run build` | `npm start` |
| **Static** | Supported | No package.json | None | None | `npx serve` |

## Planned Runtime Support

### Phase 1: Core Languages

#### Python

**Detection Files:**
- `requirements.txt` - pip dependencies
- `pyproject.toml` - Modern Python projects (Poetry, Flit, PDM)
- `Pipfile` - Pipenv projects
- `setup.py` - Traditional packages

**Execution Flow:**

```typescript
interface PythonProject {
    type: 'python';
    packageManager: 'pip' | 'poetry' | 'pipenv' | 'pdm';
    wsgiServer: 'uvicorn' | 'gunicorn' | 'waitress';
    entrypoint: string;  // e.g., 'main:app'
}
```

| Step | Command |
|------|---------|
| Virtual env | `python -m venv .venv` |
| Install (pip) | `pip install -r requirements.txt` |
| Install (poetry) | `poetry install --no-dev` |
| Install (pipenv) | `pipenv install --deploy` |
| Start (FastAPI) | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Start (Django) | `gunicorn project.wsgi:application --bind 0.0.0.0:$PORT` |
| Start (Flask) | `gunicorn app:app --bind 0.0.0.0:$PORT` |

**Framework Detection:**

```typescript
function detectPythonFramework(workDir: string): string {
    const files = fs.readdirSync(workDir);
    const content = fs.readFileSync('requirements.txt', 'utf-8');

    if (content.includes('fastapi')) return 'fastapi';
    if (content.includes('django')) return 'django';
    if (content.includes('flask')) return 'flask';
    if (files.includes('manage.py')) return 'django';

    return 'generic';
}
```

---

#### Go

**Detection Files:**
- `go.mod` - Go modules
- `go.sum` - Dependency checksums

**Execution Flow:**

```typescript
interface GoProject {
    type: 'go';
    modulePath: string;
    binaryName: string;
}
```

| Step | Command |
|------|---------|
| Download deps | `go mod download` |
| Verify | `go mod verify` |
| Build | `CGO_ENABLED=0 go build -o app .` |
| Start | `./app` |

**Build Optimization:**

```bash
# Production build with optimizations
CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s" \
    -o app .
```

---

#### Rust

**Detection Files:**
- `Cargo.toml` - Cargo manifest
- `Cargo.lock` - Dependency lock file

**Execution Flow:**

```typescript
interface RustProject {
    type: 'rust';
    crateName: string;
    binaryPath: string;  // target/release/{name}
}
```

| Step | Command |
|------|---------|
| Fetch deps | `cargo fetch` |
| Build | `cargo build --release` |
| Start | `./target/release/{crate_name}` |

**Binary Detection:**

```typescript
function getRustBinaryName(workDir: string): string {
    const cargoToml = fs.readFileSync('Cargo.toml', 'utf-8');
    const match = cargoToml.match(/name\s*=\s*"([^"]+)"/);
    return match ? match[1] : 'app';
}
```

---

#### Ruby

**Detection Files:**
- `Gemfile` - Bundler dependencies
- `Gemfile.lock` - Locked versions
- `config.ru` - Rack configuration
- `config/puma.rb` - Puma configuration

**Execution Flow:**

```typescript
interface RubyProject {
    type: 'ruby';
    framework: 'rails' | 'sinatra' | 'rack';
    server: 'puma' | 'unicorn' | 'thin';
}
```

| Step | Command |
|------|---------|
| Install | `bundle install --deployment --without development test` |
| Build (Rails) | `bundle exec rails assets:precompile` |
| DB Migrate | `bundle exec rails db:migrate` |
| Start (Puma) | `bundle exec puma -C config/puma.rb` |
| Start (Rails) | `bundle exec rails server -b 0.0.0.0 -p $PORT` |

---

### Phase 2: Container Support

#### Docker

**Detection Files:**
- `Dockerfile` - Standard Docker build
- `docker-compose.yml` - Multi-container setups
- `.dockerignore` - Build context exclusions

**Execution Flow:**

```typescript
interface DockerProject {
    type: 'docker';
    imageName: string;
    composeFile?: string;
    exposedPorts: number[];
}
```

| Step | Command |
|------|---------|
| Build | `docker build -t {app}:{hash} .` |
| Run | `docker run -d -p $PORT:$CONTAINER_PORT --name {app} {app}:{hash}` |
| Stop | `docker stop {app}` |
| Logs | `docker logs -f {app}` |

**Compose Support:**

```bash
# For docker-compose.yml projects
docker-compose up -d --build
docker-compose down
docker-compose logs -f
```

---

### Phase 3: Additional Languages

#### Java

**Detection Files:**
- `pom.xml` - Maven
- `build.gradle` / `build.gradle.kts` - Gradle
- `*.jar` - Pre-built JAR

| Build Tool | Install | Build | Run |
|------------|---------|-------|-----|
| Maven | `mvn dependency:resolve` | `mvn package -DskipTests` | `java -jar target/*.jar` |
| Gradle | `gradle dependencies` | `gradle build -x test` | `java -jar build/libs/*.jar` |

#### PHP

**Detection Files:**
- `composer.json` - Composer dependencies
- `artisan` - Laravel
- `public/index.php` - Standard entry point

| Step | Command |
|------|---------|
| Install | `composer install --no-dev --optimize-autoloader` |
| Start | `php artisan serve --host=0.0.0.0 --port=$PORT` |

#### .NET

**Detection Files:**
- `*.csproj` / `*.fsproj` - Project files
- `*.sln` - Solution file
- `appsettings.json` - Configuration

| Step | Command |
|------|---------|
| Restore | `dotnet restore` |
| Build | `dotnet publish -c Release -o ./publish` |
| Start | `dotnet ./publish/{app}.dll --urls http://0.0.0.0:$PORT` |

---

## Detection Algorithm

### Proposed Implementation

```typescript
type RuntimeType =
    | 'nodejs' | 'python' | 'go' | 'rust' | 'ruby'
    | 'docker' | 'java' | 'php' | 'dotnet' | 'static';

interface DetectedProject {
    type: RuntimeType;
    confidence: number;     // 0-100
    framework?: string;     // e.g., 'fastapi', 'rails'
    entrypoint?: string;    // main file or binary
    buildCommand?: string;  // custom build
    startCommand?: string;  // custom start
}

function detectProjectType(workDir: string): DetectedProject {
    const files = fs.readdirSync(workDir);

    // Priority order (highest first)
    const detectors = [
        { check: () => files.includes('Dockerfile'), type: 'docker' },
        { check: () => files.includes('package.json'), type: 'nodejs' },
        { check: () => files.includes('go.mod'), type: 'go' },
        { check: () => files.includes('Cargo.toml'), type: 'rust' },
        { check: () => files.includes('requirements.txt') || files.includes('pyproject.toml'), type: 'python' },
        { check: () => files.includes('Gemfile'), type: 'ruby' },
        { check: () => files.includes('pom.xml') || files.some(f => f.endsWith('.gradle')), type: 'java' },
        { check: () => files.includes('composer.json'), type: 'php' },
        { check: () => files.some(f => f.endsWith('.csproj') || f.endsWith('.sln')), type: 'dotnet' },
    ];

    for (const detector of detectors) {
        if (detector.check()) {
            return {
                type: detector.type as RuntimeType,
                confidence: 90,
                ...getTypeDetails(detector.type, workDir)
            };
        }
    }

    // Default to static
    return { type: 'static', confidence: 50 };
}
```

### Procfile Support

For explicit configuration, support Heroku-style Procfiles:

```procfile
# Procfile
web: npm start
worker: node worker.js
```

```typescript
function parseProcfile(workDir: string): Record<string, string> {
    const procfilePath = path.join(workDir, 'Procfile');
    if (!fs.existsSync(procfilePath)) return {};

    const content = fs.readFileSync(procfilePath, 'utf-8');
    const processes: Record<string, string> = {};

    for (const line of content.split('\n')) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
            processes[match[1]] = match[2];
        }
    }

    return processes;
}
```

---

## Configuration File

### serverflow.yaml (Proposed)

```yaml
# serverflow.yaml - Optional explicit configuration
runtime: python
version: "3.11"

install:
  - pip install -r requirements.txt

build:
  - python manage.py collectstatic --noinput

start: gunicorn myapp.wsgi:application --bind 0.0.0.0:$PORT

env:
  DJANGO_SETTINGS_MODULE: myapp.settings.production

healthcheck:
  path: /health
  interval: 30s
  timeout: 5s

processes:
  web: gunicorn myapp.wsgi:application
  worker: celery -A myapp worker
```

---

## Build Output Detection

### Automatic Output Directory Detection

```typescript
const BUILD_OUTPUTS = {
    nodejs: ['dist', 'build', '.next', 'out', 'public'],
    python: ['dist', 'build', 'static'],
    go: ['bin', 'build'],
    rust: ['target/release'],
    ruby: ['public/assets'],
    java: ['target', 'build/libs'],
    dotnet: ['publish', 'bin/Release'],
};

function findBuildOutput(workDir: string, type: RuntimeType): string | null {
    const candidates = BUILD_OUTPUTS[type] || [];

    for (const dir of candidates) {
        const fullPath = path.join(workDir, dir);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    return null;
}
```

---

## Process Management

### Per-Runtime PM2 Configuration

```typescript
interface PM2Config {
    name: string;
    script: string;
    interpreter?: string;
    args?: string[];
    cwd: string;
    env: Record<string, string>;
    instances?: number;
    exec_mode?: 'fork' | 'cluster';
}

function generatePM2Config(project: DetectedProject, appName: string, port: number): PM2Config {
    switch (project.type) {
        case 'nodejs':
            return {
                name: appName,
                script: 'npm',
                args: ['start'],
                cwd: workDir,
                env: { PORT: String(port) }
            };

        case 'python':
            return {
                name: appName,
                script: 'uvicorn',
                interpreter: 'python',
                args: ['main:app', '--host', '0.0.0.0', '--port', String(port)],
                cwd: workDir,
                env: { PYTHONUNBUFFERED: '1' }
            };

        case 'go':
            return {
                name: appName,
                script: './app',
                cwd: workDir,
                env: { PORT: String(port) }
            };

        case 'rust':
            const binaryName = getRustBinaryName(workDir);
            return {
                name: appName,
                script: `./target/release/${binaryName}`,
                cwd: workDir,
                env: { PORT: String(port) }
            };

        // ... other runtimes
    }
}
```

---

## Runtime Requirements

### System Dependencies

Each runtime may require additional system packages:

| Runtime | Required Packages |
|---------|------------------|
| Node.js | `nodejs`, `npm` |
| Python | `python3`, `python3-pip`, `python3-venv` |
| Go | `golang` |
| Rust | `rustc`, `cargo` |
| Ruby | `ruby`, `bundler` |
| Java | `openjdk-17-jdk`, `maven` or `gradle` |
| PHP | `php`, `php-fpm`, `composer` |
| .NET | `dotnet-sdk-8.0` |
| Docker | `docker`, `docker-compose` |

### Version Management

Consider integration with version managers:

| Runtime | Version Manager |
|---------|----------------|
| Node.js | `nvm`, `fnm` |
| Python | `pyenv` |
| Ruby | `rbenv`, `rvm` |
| Go | `gvm` |
| Rust | `rustup` |
| Java | `sdkman` |

---

## Migration Path

### Phase 1 (Current)
- Node.js full support
- Static sites

### Phase 2 (Q2 2025)
- Python support
- Go support
- Docker support

### Phase 3 (Q3 2025)
- Rust support
- Ruby support
- Java support

### Phase 4 (Q4 2025)
- PHP support
- .NET support
- Custom runtime support

---

## API Changes

### Deploy Command Extension

```typescript
interface DeployCommand {
    type: 'DEPLOY';
    appId: string;
    repoUrl: string;
    // Existing fields...

    // New fields for multi-runtime
    runtime?: RuntimeType;           // Explicit runtime override
    runtimeVersion?: string;         // e.g., "3.11" for Python
    customBuild?: string[];          // Custom build commands
    customStart?: string;            // Custom start command
    dockerfile?: string;             // Custom Dockerfile path
}
```

### New Status Codes

| Status | Description |
|--------|-------------|
| `detecting` | Auto-detecting project type |
| `unsupported_runtime` | Runtime not supported |
| `missing_runtime` | Required runtime not installed |
| `version_mismatch` | Runtime version incompatible |

---

## Best Practices

### For Users

1. **Include lock files**: Ensures reproducible builds
2. **Define explicit scripts**: `start`, `build` in package managers
3. **Use Procfile**: For explicit process definition
4. **Configure health checks**: Enable reliable deployments

### For Contributors

1. **Test detection logic**: Cover edge cases
2. **Handle missing runtimes**: Graceful degradation
3. **Support version constraints**: From project files
4. **Log clearly**: Help users debug issues
