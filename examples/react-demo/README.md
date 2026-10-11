# React + Express demo

This Vite React app uses the SDK's managed browser component. The browser calls a same-origin Express endpoint; Express reads the tenant key and requests a Seha Care session from the server.

## Requirements

- Node.js 24 and npm 11
- A Seha Care frontend origin and tenant API key

## Install and run

From the SDK repository root, build the package and install the demo:

```powershell
npm run build
Set-Location examples/react-demo
npm install
Copy-Item .env.example .env
```

Edit `.env` with server-only values:

```dotenv
SEHA_API_BASE_URL=https://demo.seha-care.com
SEHA_TENANT_API_KEY=replace-with-your-tenant-api-key
PORT=4174
```

Start Express in one terminal:

```powershell
npm run dev:server
```

Start Vite in a second terminal:

```powershell
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api/seha-care/session` to Express on port 4174. The tenant key is read by the Express process and never enters Vite variables, browser source, or browser requests.

## Components

The demo uses the managed component:

```tsx
import { EmbedSession } from "@seha-care/embed-sdk/react";

export function Consultation() {
  return <EmbedSession initAgent="receptionist" />;
}
```

When your application already has a session URL, render the iframe component instead:

```tsx
import { EmbedSessionFrame } from "@seha-care/embed-sdk/react";

export function ConsultationFrame({ sessionUrl }: { sessionUrl: string }) {
  return <EmbedSessionFrame sessionUrl={sessionUrl} title="Seha Care consultation" />;
}
```

Your own Express or NestJS backend can implement the same endpoint with `SehaCareEmbedClient` from `/server`. Validate input, return only `{ sessionUrl }`, use `Cache-Control: no-store`, and return safe errors.

## Security

Keep `SEHA_TENANT_API_KEY` on the server. Do not rename it with a `VITE_` prefix. The returned session URL is a bearer credential; do not log or store it. For production, apply the host application's authentication and abuse controls to the Express endpoint and allow the Seha Care origin in the host page's `frame-src` CSP.

## Checks

```powershell
npm run typecheck
npm test
npm run check:bundle
```

`check:bundle` builds the browser app with source maps and scans both for Seha Care server configuration.
