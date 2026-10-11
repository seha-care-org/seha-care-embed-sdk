# Angular + NestJS example

The Angular app uses the SDK's standalone components and posts to its same-origin `/api/seha-care/session` endpoint. The NestJS service calls Seha Care with its tenant key from server configuration.

## Requirements

- Node.js 24 and npm 11
- A Seha Care frontend origin and tenant API key

## Install and run

Build the SDK once from the repository root, then install each app:

```powershell
npm run build
Set-Location examples/angular-nest/server
npm install
Copy-Item .env.example .env
```

Edit `server/.env` with the tenant's frontend origin and API key. Start NestJS in one terminal:

```powershell
npm run start:dev
```

Install and start Angular in a second terminal:

```powershell
Set-Location ../client
npm install
npm start
```

Open <http://localhost:4201>. Angular's development proxy forwards `/api/seha-care/session` to the NestJS app on `http://127.0.0.1:4175`, so the browser sends no tenant credential and needs no cross-origin permission.

For a page that already has a session link, use the URL-only component:

```ts
import { EmbedSessionFrameComponent } from "@seha-care/embed-sdk/angular";

@Component({
  standalone: true,
  imports: [EmbedSessionFrameComponent],
  template: '<seha-embed-session-frame [sessionUrl]="sessionUrl" />',
})
export class ExistingConsultationComponent {
  sessionUrl = "https://demo.seha-care.com/en/embed/session/short-lived-token";
}
```

## Build checks

```powershell
npm run check:bundle
Set-Location ../server
npm run build
```

The SDK's `/angular` export targets Angular 21 and 22 partial compilation. Keep tenant keys in the server `.env`, use HTTPS in production, and never log session URLs or upstream response bodies.
