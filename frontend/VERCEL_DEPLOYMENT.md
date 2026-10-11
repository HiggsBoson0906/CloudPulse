# CloudPulse Frontend — Vercel Deployment Guide

This guide describes how to deploy the CloudPulse React + Vite + TypeScript frontend on [Vercel](https://vercel.com) using the GitHub-connected workflow, while keeping the backend hosted independently.

---

## 1. Import Repository into Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** → **Project**.
3. Select your Git provider (GitHub) and locate the **CloudPulse** repository (`HiggsBoson0906/CloudPulse`).
4. Click **Import**.

---

## 2. Project Settings & Build Configuration

In the **Configure Project** screen, configure the following settings:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | Detected automatically by Vercel |
| **Root Directory** | `frontend` | **CRITICAL**: Click *Edit* next to Root Directory and select `frontend` |
| **Build Command** | `npm run build` | Executes `tsc -b && vite build` |
| **Output Directory** | `dist` | Generated Vite output bundle |
| **Install Command** | `npm install` | Installs frontend dependencies |

> [!IMPORTANT]
> The repository is structured as a monorepo containing backend services at the root and the web dashboard in `frontend/`. Setting the **Root Directory** to `frontend` ensures Vercel only installs frontend dependencies and builds the client application.

---

## 3. Environment Variables

All variables prefixed with `VITE_` are embedded into the client-side JavaScript bundle during the build. **Never place secrets, private keys, or database credentials here.**

### Available Environment Variables

| Variable | Public / Secret | Default (Local) | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | **Public** | `""` (relative path) | Public URL of the backend API (without trailing slash). Leave empty for local development to use Vite's dev proxy. |

### Security Architecture & API Keys
* **Do NOT set admin or operator API keys in Vercel environment variables**: Any `VITE_*` variable is bundled into public browser scripts and visible to all site visitors.
* **Runtime Authentication**: When connecting to a protected CloudPulse backend, operators can set their API token at runtime in the browser console via `window.cloudpulse.setApiKey('YOUR_KEY')`. The token is stored locally in the browser's `localStorage` (`cloudpulse_api_key`) and sent via `Authorization: Bearer <token>`.

---

## 4. Configuring the Backend URL Later

When the CloudPulse backend is deployed to a separate host (e.g. AWS ECS/EC2, GCP Cloud Run, or a VPS):

1. Go to your Vercel Project Dashboard → **Settings** → **Environment Variables**.
2. Add a new variable:
   * **Key**: `VITE_API_BASE_URL`
   * **Value**: Your actual backend URL, e.g. `https://api.yourdomain.com` (no trailing slash).
   * **Environments**: Check *Production*, *Preview*, and *Development*.
3. Save the variable.
4. Trigger a **Redeploy** (Environment variables in Vite take effect during the build step).

---

## 5. Configuring Backend CORS for the Vercel Domain

Because the frontend and backend will be hosted on different origins, the backend must accept cross-origin requests from your Vercel deployment:

1. Obtain your assigned Vercel domain from the project dashboard (e.g. `https://cloudpulse-xyz.vercel.app` or custom domain `https://monitor.yourdomain.com`).
2. On your backend host, update the `CORS_ALLOWED_ORIGINS` environment variable:
   ```bash
   CORS_ALLOWED_ORIGINS="https://cloudpulse-xyz.vercel.app,https://monitor.yourdomain.com"
   ```
3. Restart or redeploy the backend API service.

---

## 6. How to Redeploy After Changes

* **Automatic Deployments**: Any push to the `main` branch on GitHub automatically triggers a production build on Vercel. Pushes to pull requests create preview deployments.
* **Manual Redeploy**:
  1. Open the project in Vercel.
  2. Navigate to the **Deployments** tab.
  3. Click the three dots (`...`) next to the latest deployment → **Redeploy**.

---

## 7. Known Limitations When Backend is Unavailable

When the frontend is deployed to Vercel before the backend is deployed (or if `VITE_API_BASE_URL` is unset):

1. **Dashboard Operational Banner**: The banner will display `"CONNECTING..."` while attempting to poll the API.
2. **Telemetry Directories**: Service directories, metrics charts, and alert lists will show empty initial states (`"Awaiting initial check"`, `"No services registered"`).
3. **Action Toasts**: Creating a service, adding an alert rule, or resolving an incident will trigger error toasts indicating the backend endpoint is unreachable (`HTTP 404` or `Failed to fetch`).
4. **Offline Resilience**: The React application itself will load and render completely with zero crashes; client-side navigation between tabs (Overview, Services, Alert Rules, Incidents) functions smoothly.
