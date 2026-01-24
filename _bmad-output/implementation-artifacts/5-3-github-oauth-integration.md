# GitHub OAuth Implementation Plan

## 1. Overview
We will implement a standard OAuth2 flow to allow users to authenticate with GitHub. This will grant the "ServerFlow" dashboard access to list both public and private repositories, enabling a seamless "Click-to-Deploy" experience for private projects.

## 2. Architecture

### Backend (Control Plane - Port 3000)
- **`GET /api/auth/github/login`**: Redirects user to GitHub authorization page.
- **`GET /api/auth/github/callback`**: Handles the code returned by GitHub, exchanges it for an Access Token, and redirects back to Dashboard with a session token.
- **`GET /api/github/repos`**: Proxies the request to GitHub API using the stored Access Token to list repos.

### Frontend (Dashboard - Port 5173)
- **New "Connect GitHub" Button**: Initiates the flow.
- **State Management**: Stores the `gh_access_token` (in memory or local storage for this version) to make authenticated requests.
- **Repo Selector**: Updated to fetch from `/api/github/repos` instead of directly from GitHub API (to avoid CORS/Token leakage issues).

## 3. Configuration Requirements (USER ACTION NEEDED)
The user generally needs to create a GitHub OAuth App.
1. Go to GitHub Settings > Developer settings > OAuth Apps > New OAuth App.
2. **Application Name**: ServerFlow Local
3. **Homepage URL**: `http://localhost:5173`
4. **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
5. **Get Client ID and Generate Client Secret**.

## 4. Environment Variables
We need to add these to `apps/control-plane/.env`:
```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## 5. Implementation Steps
1. [Backend] Create Auth Routes (`login`, `callback`).
2. [Backend] Create Proxy Route (`/api/github/repos`).
3. [Frontend] Add "Connect GitHub" button.
4. [Frontend] Handle callback and store token.
5. [Frontend] Update Repo Fetch logic.
