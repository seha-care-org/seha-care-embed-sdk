import { Component } from "@angular/core";
import { EmbedSessionComponent } from "@seha-care/embed-sdk/angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [EmbedSessionComponent],
  template: `
    <main>
      <h1>Seha Care embedded consultation</h1>
      <p>The managed component starts the session after the visitor selects Start session.</p>
      <seha-embed-session
        className="consultation"
        [initAgent]="'receptionist'"
      />
    </main>
  `,
})
export class AppComponent {}
