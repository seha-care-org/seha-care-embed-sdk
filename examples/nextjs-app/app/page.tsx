import { EmbedSession } from "@seha-care/embed-sdk/nextjs";
import { requireConsultationAccess } from "./actions";

export default function HomePage() {
  return (
    <main>
      <h1>Seha Care embedded consultation</h1>
      <p>This server component creates a session after you select Start session.</p>
      <section id="public-visitor">
        <h2>Public visitor</h2>
        <EmbedSession
          initAgent="receptionist"
          className="consultation"
          iframeProps={{ title: "Seha Care visitor consultation" }}
        />
      </section>
      <section id="protected-visitor">
        <h2>Consultation with host authorization</h2>
        <EmbedSession
          beforeStartAction={requireConsultationAccess}
          initAgent="knowledge"
          className="consultation"
        />
      </section>
    </main>
  );
}
