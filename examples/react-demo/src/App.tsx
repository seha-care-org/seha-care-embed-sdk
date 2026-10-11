import { EmbedSession } from "@seha-care/embed-sdk/react";

export function App() {
  return (
    <main className="page-shell">
      <header className="demo-intro">
        <div className="brand-mark" aria-hidden="true">
          SC
        </div>
        <p className="eyebrow">Seha Care Embed SDK</p>
        <h1>Embedded telehealth session</h1>
        <p className="intro">
          Enter a visitor name or continue with the default visitor. The SDK starts the session
          and places the call here.
        </p>
      </header>

      <EmbedSession
        initAgent="receptionist"
        className="demo-embed-session"
        iframeProps={{
          id: "telehealth-iframe",
          title: "Seha Care telehealth session",
        }}
      />
    </main>
  );
}
