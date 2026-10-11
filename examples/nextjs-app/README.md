# Next.js App Router example

This App Router example uses the SDK's server `EmbedSession` component. The visitor starts a session by submitting the form; page rendering does not contact Seha Care.

## Requirements

- Node.js 24 and npm 11

## Install and configure

From the SDK repository root:

```powershell
npm run build
Set-Location examples/nextjs-app
npm install
Copy-Item .env.example .env
```

Put the tenant key in `SEHA_TENANT_API_KEY`. These are server environment variables. Never prefix them with `NEXT_PUBLIC_`.

The example enables the SDK package in `transpilePackages` and uses Next.js's Webpack compiler for both development and production builds. This is required for Next.js to register the SDK's closure-bound Server Action from its package module.

Run the development server:

```powershell
npm run dev
```

Open <http://localhost:4199>. The page has a public visitor flow and a second component with the example cookie authorization action. Without `consultation_access=allowed`, that hook blocks session creation.

The page also demonstrates the custom metadata mode. `app/api/seha-care/session/route.ts` reads the `x-organization-context` header and the `organizationContext` JSON field, checks authorization on every request, and passes only validated session options to Seha Care. The SDK sends this same-origin request only when the visitor submits the form. Custom metadata mode requires `sessionEndpoint` and cannot be combined with `beforeStartAction`.

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

## Production build

Create the production build and scan its browser assets for server credentials:

```powershell
npm run build
npm run check:bundle
npm start
```

The bundle scan expects the production build in `.next`. `npm start` serves the app at <http://localhost:4199>.
