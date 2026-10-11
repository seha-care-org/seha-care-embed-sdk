# Seha Care Embed SDK

`@seha-care/embed-sdk` creates short-lived Seha Care session URLs and displays them in an iframe. The package includes a server client, a browser client, React and Next.js components, and standalone Angular components.

## Choose an integration

| Environment | Integration |
| --- | --- |
| Next.js App Router | Import `EmbedSession` from `@seha-care/embed-sdk/nextjs`. Its Server Action reads the tenant key on the server; the session starts only after submit. |
| React SPA or Angular | Use the managed component and expose `/api/seha-care/session` from your backend. The browser sends session options and any organization-specific request data to that same-origin endpoint. |
| Existing session URL | Render `EmbedSessionFrame` from the React or Next.js entry, or `EmbedSessionFrameComponent` from the Angular entry. |
| Node.js, Express, NestJS | Import `SehaCareEmbedClient` from `@seha-care/embed-sdk/server`. |
| Other backend language | Make the same server-to-server HTTP request described below. |

Runnable projects are in [Next.js](examples/nextjs-app/README.md), [React + Express](examples/react-demo/README.md), [Angular + NestJS](examples/angular-nest/README.md), and [plain Node.js](examples/plain-node/README.md).

## Install

```sh
npm install @seha-care/embed-sdk
```

The server and browser clients have no framework requirement. For React components, install React 18 or 19. The Next.js integration targets Next.js 16 with React 19. The Angular entry targets Angular 21 and 22.

The `/nextjs` entry uses the `server-only` marker; include that package in Next.js applications if it is not already available through the app's dependencies.

In Next.js applications, add `@seha-care/embed-sdk` to `transpilePackages` in `next.config.ts` and use the Webpack compiler for development and production builds. This lets Next.js register the component's closure-bound Server Action from the SDK package:

```ts
const nextConfig = {
  transpilePackages: ["@seha-care/embed-sdk"],
};
```

## Next.js: managed component

Set these variables in the Next.js **server** environment:

```dotenv
SEHA_API_BASE_URL=https://demo.seha-care.com
SEHA_TENANT_API_KEY=replace-with-your-tenant-key
```

Do not prefix these variables with `NEXT_PUBLIC_`. Use the server component in an App Router page:

```tsx
import { EmbedSession } from "@seha-care/embed-sdk/nextjs";

export default function ConsultationPage() {
  return (
    <div style={{ height: "75vh", minHeight: 520 }}>
      <EmbedSession
        initAgent="receptionist"
        initDialect="EGY"
        language="en"
        iframeProps={{ title: "Seha Care consultation" }}
      />
    </div>
  );
}
```

The server component supplies a closure-bound action to the React UI. Rendering or prefetching the page does not create a session. The tenant key is read inside the action and never enters its arguments, captured values, or browser props. The component handles the start form, duplicate submits, loading, retry, and iframe display.

The visitor flow is public by default, so protect it with the controls appropriate for your application. To require application-specific authorization, pass a host-defined Server Action as `beforeStartAction`. It runs for every start request before the SDK contacts Seha Care. The optional `language` prop accepts `"en"` or `"ar"`; if omitted, Seha Care uses the tenant's configured session language:

```ts
// app/consultation-actions.ts
"use server";

import { cookies } from "next/headers";
import type { StartEmbeddedSessionRequest } from "@seha-care/embed-sdk/server";

export async function authorizeConsultation(
  _options: StartEmbeddedSessionRequest,
): Promise<void> {
  const session = (await cookies()).get("your-session-cookie");
  if (!session) throw new Error("Unauthorized");
}
```

```tsx
import { EmbedSession } from "@seha-care/embed-sdk/nextjs";
import { authorizeConsultation } from "./consultation-actions";

export function ProtectedConsultation() {
  return <EmbedSession beforeStartAction={authorizeConsultation} />;
}
```

If you want the same custom header and JSON body contract used by React or Angular, expose a protected, same-origin Next.js Route Handler and select that request path explicitly:

```tsx
<EmbedSession
  sessionEndpoint="/api/seha-care/session"
  sessionHeaders={{ "x-organization-context": "clinic-12" }}
  sessionBody={{ organizationContext: { bookingId: "booking-4821" } }}
  initAgent="receptionist"
/>
```

The Route Handler receives the custom header and top-level JSON fields. Authenticate and authorize every request there, validate organization data, then pass only the typed session options (`userIdentity`, `initAgent`, `initDialect`, and `language`) to the server client. Endpoint mode cannot be combined with `beforeStartAction`; that hook belongs to the SDK's default Server Action flow. Custom metadata requires an explicit endpoint. Browser requests force JSON content type, keep typed session options authoritative, and reject redirects.

For an existing session link, the Next.js entry also exports `EmbedSessionFrame`.

## React or Angular: host a server endpoint

The managed browser components call the host application at `POST /api/seha-care/session` by default. A custom **same-origin** endpoint can be passed as `sessionEndpoint`. The endpoint accepts a JSON object of session options and optional organization fields, plus custom request headers, and returns `{ "sessionUrl": "https://…" }` with caching disabled. Custom body fields are merged alongside `userIdentity`, `initAgent`, `initDialect`, and `language`. These four fields are reserved for SDK session options and cannot be overridden through `sessionBody`.

The server endpoint should validate the request body, call the server client, and return only the session URL. For Express:

```ts
import express from "express";
import {
  EmbeddedSessionRequestError,
  SehaCareEmbedClient,
  validateStartSessionOptions,
} from "@seha-care/embed-sdk/server";

const app = express();
app.use(express.json({ limit: "8kb" }));

function sessionOptionsFrom(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Session request must be an object");
  }
  const { userIdentity, initAgent, initDialect, language } = value as Record<string, unknown>;
  return validateStartSessionOptions({ userIdentity, initAgent, initDialect, language });
}

app.post("/api/seha-care/session", async (request, response) => {
  response.setHeader("Cache-Control", "no-store");

  // Read organization-specific values from the incoming browser request.
  const organizationHeader = request.get("x-organization-context");
  const organizationBody = request.body?.organizationContext;
  // Validate and use these values in your organization's own logic here.

  let options;
  try {
    options = sessionOptionsFrom(request.body);
  } catch {
    response.status(400).json({ error: "Invalid session options" });
    return;
  }

  try {
    const client = new SehaCareEmbedClient(process.env.SEHA_TENANT_API_KEY ?? "");
    response.status(201).json(await client.startSession(options));
  } catch (error) {
    const status = error instanceof EmbeddedSessionRequestError
      ? error.status ?? 502
      : 502;
    response.status(status).json({ error: "Could not start the consultation" });
  }
});
```

The values are available on the organization server's incoming request. In Express, read a header with `request.get("x-organization-context")` and a custom body field with `request.body.organizationContext`, as shown above. In NestJS, use `@Headers("x-organization-context")` and access `organizationContext` on the object received by `@Body()`. In a plain Node handler, use the lower-case `request.headers["x-organization-context"]` and read `organizationContext` from the parsed JSON object. Validate these values before using them for organization-specific authorization or business logic. The server client sends only the validated session options to Seha Care.

Keep `SEHA_API_BASE_URL` and `SEHA_TENANT_API_KEY` in server-only configuration. Add your normal authentication and abuse controls to public endpoints; Seha Care tenant and session limits also apply.

### React

```tsx
import { EmbedSession, EmbedSessionFrame } from "@seha-care/embed-sdk/react";

export function Consultation() {
  return (
    <EmbedSession
      initAgent="knowledge"
      initDialect="EGY"
      language="ar"
      sessionHeaders={{ "x-organization-context": "clinic-12" }}
      sessionBody={{ organizationContext: { bookingId: "booking-4821" } }}
    />
  );
}

export function ExistingSession({ sessionUrl }: { sessionUrl: string }) {
  return <EmbedSessionFrame sessionUrl={sessionUrl} title="Consultation" />;
}
```

The iframe fills its parent, so set the parent height. The managed component accepts `sessionEndpoint`, identity/agent/dialect/language settings, translated `labels`, root `className`/`style`, `iframeProps`, `onSessionStarted`, and `onError`.

### Angular

Import the standalone components where needed:

```ts
import {
  EmbedSessionComponent,
  EmbedSessionFrameComponent,
} from "@seha-care/embed-sdk/angular";

@Component({
  standalone: true,
  imports: [EmbedSessionComponent, EmbedSessionFrameComponent],
  template: `
    <seha-embed-session
      [initAgent]="'knowledge'"
      [language]="'ar'"
      (sessionStarted)="sessionStarted($event)"
      (sessionError)="sessionFailed($event)"
    />
    <seha-embed-session-frame [sessionUrl]="knownSessionUrl" />
  `,
})
export class ConsultationComponent {
  knownSessionUrl = "https://demo.seha-care.com/en/embed/session/short-lived-token";
  sessionStarted(event: { sessionUrl: string }): void { /* keep in memory */ }
  sessionFailed(error: Error): void { /* handle safely */ }
}
```

`EmbedSessionComponent` supports `sessionEndpoint`, `sessionHeaders`, `sessionBody`, `userIdentity`, `initAgent`, `initDialect`, `language`, translated `labels`, CSS class and style inputs, iframe title/permissions/id/styles, and `sessionStarted`/`sessionError` outputs. Language accepts `en` or `ar`; if omitted, the tenant's configured session language applies. For example, bind `[sessionHeaders]="{ 'x-organization-context': 'clinic-12' }"` and `[sessionBody]="{ organizationContext: { bookingId: 'booking-4821' } }"`. The iframe component checks the URL before marking it safe for the browser.

## Server client and HTTP contract

The server client sends `POST /api/v1/session/embed/start-session` to the Seha Care frontend origin, with `x-tenant-api-key` and JSON session options. The Seha Care frontend attaches its own platform credential when it calls the agents backend. Your application needs only its tenant API key.

```ts
import { SehaCareEmbedClient } from "@seha-care/embed-sdk/server";

const client = new SehaCareEmbedClient(process.env.SEHA_TENANT_API_KEY ?? "");
const { sessionUrl } = await client.startSession({
  userIdentity: "booking-4821",
  initAgent: "receptionist",
  initDialect: "EGY",
  language: "ar",
});
```

`SEHA_API_BASE_URL` is read from the server environment. It must be the final API HTTP(S) origin, with no path, query, or fragment; the SDK rejects redirects so it never forwards the tenant key to another destination. For dependency-injected configuration, supply an explicit override:

```ts
const client = new SehaCareEmbedClient(tenantApiKey, {
  apiBaseUrl: configService.getOrThrow("SEHA_API_BASE_URL"),
});
```

Session options are optional:

| Option | Accepted values | Behavior |
| --- | --- | --- |
| `userIdentity` | string | Optional display identity; omitted values default to `visitor`. Do not use a patient name or other protected information. |
| `initAgent` | `receptionist`, `triage`, `knowledge` | Optional initial agent. |
| `initDialect` | `MAGHREB`, `LEV`, `MSA`, `GLF`, `EGY` | Optional Arabic dialect preference. |
| `language` | `en`, `ar` | Optional consultation language. Omitted values use the tenant's configured session language. |
| `signal` | `AbortSignal` | Optional local request cancellation. |

The browser `SehaCareEmbedClient` has no tenant-key argument. It sends only validated options to the host endpoint, uses same-origin credentials, and disables caching. Do not add permissive CORS or a tenant key to browser code to work around a missing host endpoint.

The browser client, React component, Angular component, Next.js endpoint mode, and Flutter client/widget accept host-endpoint-specific custom headers and extra JSON `body` fields:

```ts
import { SehaCareEmbedClient } from "@seha-care/embed-sdk/client";

const client = new SehaCareEmbedClient();
const { sessionUrl } = await client.startSession({
  initAgent: "receptionist",
  language: "en",
  headers: { "x-organization-context": "clinic-12" },
  body: { organizationContext: { bookingId: "booking-4821" } },
});
```

These values go to your own `/api/seha-care/session` endpoint. Do not put secrets in browser-supplied headers or body fields. Validate organization data on your server and pass only supported session options (`userIdentity`, `initAgent`, `initDialect`, and `language`) to `SehaCareEmbedClient`. Language is optional; omitting it lets the tenant's configured value apply.

## Security and display

- A session URL contains a bearer token. Give it only to the intended browser session; do not log, analyze, persist, or put it in a shareable link.
- Do not log tenant keys, upstream error bodies, or participant information. SDK errors expose a safe status and category rather than an upstream body.
- Allow the Seha Care origin in the host page's `frame-src` Content Security Policy. Camera and microphone use depends on HTTPS, browser permission, and iframe `allow="camera; microphone; autoplay"`.
- Server-to-server calls do not use browser CORS. Browser session-start calls should stay same-origin through the host endpoint or its development proxy.

## Migration from 0.1.x

Version `0.1.0` removes the insecure browser key flow. Replace `EmbedSession tenantApiKey={...}` and `new SehaCareEmbedClient(tenantApiKey)` in browser code with the keyless browser client and a host server endpoint, or use the Next.js `/nextjs` component. Remove `VITE_SEHA_API_BASE_URL`, `VITE_SEHA_TENANT_API_KEY`, and the `__SEHA_API_BASE_URL__` build define. The React demo shows an Express endpoint and Vite development proxy. Add `knowledge` where you want the backend's knowledge agent.

## Development and checks

From this directory:

```sh
npm install
npm run verify
npm run pack:check
```

Each runnable example has its own setup and build commands in its README. After installing the React, Angular/NestJS, and plain Node examples and building NestJS, `npm run check:server-examples` exercises the Express, NestJS, and plain Node endpoints against a local mock. The React, Angular, and Next.js checks scan browser assets and source maps; the Next.js example tests ordinary requests and direct requests with missing or tampered authorization context in development and production. All automated checks use synthetic credentials and local mocks.
