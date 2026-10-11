# Plain Node.js example

This small Node HTTP server serves a browser page and exposes `POST /api/seha-care/session`. The tenant key is used only by the server client. The page uses the SDK browser client and renders the returned session URL in an ordinary iframe.

## Requirements and run

- Node.js 24 and npm 11
- A Seha Care frontend origin and tenant API key

From the SDK repository root:

```powershell
npm run build
Set-Location examples/plain-node
npm install
Copy-Item .env.example .env
```

Set `SEHA_API_BASE_URL` and `SEHA_TENANT_API_KEY` in `.env`, then run:

```powershell
npm start
```

Open <http://127.0.0.1:4177>. The form calls the local endpoint. Node validates the session options, calls Seha Care through `/server`, and returns a no-store `{ sessionUrl }` response.

## Other backends

The same flow works with any server that can make an HTTPS request:

1. Keep the tenant key in private server configuration.
2. Send `POST /api/v1/session/embed/start-session` to the Seha Care frontend origin with `x-tenant-api-key` and a JSON body containing the optional session options.
3. Return only `{ sessionUrl }` from your own authorized, no-store endpoint.
4. In the browser, call that same-origin endpoint and put `sessionUrl` in an iframe.

Do not return or log the tenant key or log the session URL. Allow the Seha Care frontend origin in the embedding page's `frame-src` CSP.
