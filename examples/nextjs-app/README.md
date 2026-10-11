# Next.js App Router example

This App Router example uses the SDK's server `EmbedSession` component. The visitor starts a session by submitting the form; page rendering does not contact Seha Care.

## Requirements

- Node.js 24 and npm 11
- Chromium available to Playwright for the integration checks

## Install and configure

From the SDK repository root:

```powershell
npm run build
Set-Location examples/nextjs-app
npm install
Copy-Item .env.example .env
```

Set `SEHA_API_BASE_URL` to the Seha Care **frontend** origin and put the tenant key in `SEHA_TENANT_API_KEY`. These are server environment variables. Never prefix them with `NEXT_PUBLIC_`.

Run the development server:

```powershell
npm run dev
```

Open <http://localhost:4199>. The page has a public visitor flow and a second component with the example cookie authorization action. Without `consultation_access=allowed`, that hook blocks session creation.

When a session URL already exists, the same entry point re-exports the URL-only iframe component:

```tsx
import { EmbedSessionFrame } from "@seha-care/embed-sdk/nextjs";

export function ExistingConsultation({ sessionUrl }: { sessionUrl: string }) {
  return <EmbedSessionFrame sessionUrl={sessionUrl} title="Seha Care consultation" />;
}
```

## Protect a session

`app/actions.ts` demonstrates a host-defined Next.js Server Action passed as `beforeStartAction`. It reads a same-origin cookie and rejects requests that lack the expected value. Replace this demonstration check with the authentication, authorization, and rate limits used by your application. The SDK invokes the hook on every session request before reading the Seha configuration and calling Seha Care.

The `/nextjs` component returns a safe error to the browser if access is denied or the upstream request fails. Do not return credentials or upstream response bodies from a host authorization action.

## Development and production integration checks

The browser check starts a local mock Seha endpoint and uses a synthetic key to verify that:

- rendering does not create a session;
- submitting creates one session, and the browser receives no tenant key;
- the authorization hook blocks a request before it reaches the mock endpoint;
- an authorized request succeeds; and
- the rendered page and browser responses do not contain the synthetic key.

For development:

```powershell
npx playwright install chromium
npm run test:integration:dev
```

For production, first build, then run the production check:

```powershell
npm run build
npm run check:bundle
npm run test:integration
```

The checks use a local mock only. They do not need a real Seha Care tenant or contact a remote service.
