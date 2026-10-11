import { CommonModule, DOCUMENT } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  ChangeDetectorRef,
  inject,
  Input,
  HostListener,
  OnChanges,
  Output,
  Renderer2,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import {
  DomSanitizer,
  SafeResourceUrl,
} from "@angular/platform-browser";
import {
  createSameOriginEndpoint,
  DEFAULT_SESSION_ENDPOINT,
  EmbeddedSessionRequestError,
  requestBrowserSession,
} from "./session-client.js";
import type {
  ArabicDialect,
  EmbeddedAgent,
  SessionLanguage,
  StartEmbeddedSessionRequest,
  StartEmbeddedSessionResponse,
} from "./session-client.js";

export interface EmbedSessionLabels {
  heading: string;
  description: string;
  userIdentityLabel: string;
  userIdentityPlaceholder: string;
  optionalLabel: string;
  startButton: string;
  startingButton: string;
  loadingStatus: string;
  errorMessage: string;
  expandFullscreenButton: string;
  exitFullscreenButton: string;
}

export interface EmbedSessionStartedEvent {
  sessionUrl: string;
}

const DEFAULT_LABELS: EmbedSessionLabels = {
  heading: "Start your session",
  description: "Enter a visitor name to begin, or continue with the default visitor.",
  userIdentityLabel: "Visitor name",
  userIdentityPlaceholder: "Enter a name (optional)",
  optionalLabel: "(optional)",
  startButton: "Start session",
  startingButton: "Starting session…",
  loadingStatus: "Creating your private session link…",
  errorMessage: "Could not start the session. Please try again.",
  expandFullscreenButton: "Expand consultation to full screen",
  exitFullscreenButton: "Exit full screen",
};

const IFRAME_STYLES = [
  ":host{container-type:inline-size;display:block;width:100%;max-width:66.25rem;margin-inline:auto}",
  ".seha-embed-session-frame-shell{position:relative;width:100%;max-width:66.25rem;margin-inline:auto}",
  "iframe{display:block;width:100%;height:auto;aspect-ratio:3/4;border:0;border-radius:1rem}",
  "@container (min-width:48rem){iframe{aspect-ratio:4/3;border-radius:1.25rem}}",
  ".seha-embed-session__fullscreen-button{position:absolute;z-index:2;inset-block-start:.75rem;inset-inline-end:.75rem;display:grid;width:2.75rem;height:2.75rem;place-items:center;padding:0;border:1px solid rgb(255 255 255 / 62%);border-radius:.75rem;background:rgb(14 31 29 / 82%);color:#fff;font:inherit;font-size:1.625rem;line-height:1;cursor:pointer;backdrop-filter:blur(.5rem)}",
  ".seha-embed-session__fullscreen-button:hover{background:rgb(14 31 29 / 96%)}",
  ".seha-embed-session__fullscreen-button:focus-visible{outline:3px solid #58c7a8;outline-offset:3px}",
  ".seha-embed-session-frame-shell--fullscreen-fallback,.seha-embed-session-frame-shell:fullscreen{position:fixed!important;z-index:2147483647;inset:0!important;width:100vw!important;max-width:none!important;height:100vh!important;height:100dvh!important;margin:0!important;overflow:auto;background:#000}",
  ".seha-embed-session-frame-shell--fullscreen-fallback iframe,.seha-embed-session-frame-shell:fullscreen iframe{width:100%!important;height:100%!important;aspect-ratio:auto!important;border-radius:0!important}",
];

const SESSION_STYLES = [
  ":host{display:block;width:100%;min-width:0}",
  ".seha-embed-session{width:min(100%,31rem);margin-inline:auto}",
  ".seha-embed-session--active{width:100%;max-width:66.25rem;padding:0;margin-inline:auto;background:transparent}",
  ".seha-embed-session__form{display:flex;flex-direction:column;gap:.875rem;max-width:32rem;margin-inline:auto;padding:1.25rem}",
  ".seha-embed-session__heading,.seha-embed-session__description{margin:0}",
  ".seha-embed-session__input,.seha-embed-session__button{font:inherit;padding:.75rem;border-radius:.5rem}",
  ".seha-embed-session__button{cursor:pointer}",
  ".seha-embed-session__frame{display:block;width:100%;max-width:66.25rem;height:auto;border:0}",
  ".seha-embed-session__error{color:#a52828}",
];

@Component({
  selector: "seha-embed-session-frame",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<div #shell class="seha-embed-session-frame-shell" [class.seha-embed-session-frame-shell--fullscreen-fallback]="isFullscreenFallback"><iframe #frame [src]="safeUrl" [attr.title]="title" allow="camera; microphone; autoplay; fullscreen" allowfullscreen referrerpolicy="no-referrer" loading="eager" [attr.id]="id" [class]="className" [ngStyle]="iframeStyles" (load)="frameLoad.emit($event)"></iframe><button #fullscreenButton class="seha-embed-session__fullscreen-button" type="button" [attr.aria-label]="isFullscreen ? exitFullscreenLabel : expandFullscreenLabel" [attr.aria-pressed]="isFullscreen" [attr.title]="isFullscreen ? exitFullscreenLabel : expandFullscreenLabel" (click)="toggleFullscreen()"><span aria-hidden="true">{{ isFullscreen ? "×" : "⛶" }}</span></button></div>',
  styles: IFRAME_STYLES,
})
export class EmbedSessionFrameComponent implements AfterViewInit, OnChanges {
  @ViewChild("frame", { static: true }) private frame: ElementRef<HTMLIFrameElement> | undefined;
  @ViewChild("shell", { static: true }) private shell: ElementRef<HTMLDivElement> | undefined;
  @ViewChild("fullscreenButton", { static: true }) private fullscreenButton: ElementRef<HTMLButtonElement> | undefined;
  @Input({ required: true }) sessionUrl = "";
  @Input() title = "Seha Care consultation";
  @Input() allow = "camera; microphone; autoplay; fullscreen";
  @Input() id: string | undefined;
  @Input() iframeStyles: Record<string, string | number> = {};
  @Input() className = "";
  @Input() expandFullscreenLabel = DEFAULT_LABELS.expandFullscreenButton;
  @Input() exitFullscreenLabel = DEFAULT_LABELS.exitFullscreenButton;
  @Output() readonly frameLoad = new EventEmitter<Event>();

  safeUrl: SafeResourceUrl | null = null;
  isFullscreen = false;
  isFullscreenFallback = false;

  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);

  ngOnChanges(_changes: SimpleChanges): void {
    if (_changes["sessionUrl"]) {
      const validatedUrl = assertHttpUrl(this.sessionUrl);
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(validatedUrl);
    }
    this.applyAllowPolicy();
  }

  ngAfterViewInit(): void {
    this.applyAllowPolicy();
  }

  private applyAllowPolicy(): void {
    if (this.frame) this.renderer.setAttribute(this.frame.nativeElement, "allow", this.allow);
  }

  @HostListener("document:fullscreenchange")
  syncFullscreenState(): void {
    this.isFullscreen =
      this.isFullscreenFallback || this.document.fullscreenElement === this.shell?.nativeElement;
  }

  @HostListener("document:keydown", ["$event"])
  handleEscape(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !this.isFullscreenFallback) return;
    this.isFullscreenFallback = false;
    this.isFullscreen = false;
    this.fullscreenButton?.nativeElement.focus();
  }

  async toggleFullscreen(): Promise<void> {
    const shell = this.shell?.nativeElement;
    if (!shell) return;

    if (this.document.fullscreenElement === shell) {
      await this.document.exitFullscreen().catch(() => undefined);
      return;
    }

    if (this.isFullscreenFallback) {
      this.isFullscreenFallback = false;
      this.isFullscreen = false;
      this.fullscreenButton?.nativeElement.focus();
      return;
    }

    if (this.document.fullscreenEnabled && shell.requestFullscreen) {
      try {
        await shell.requestFullscreen();
        return;
      } catch {
        // Use a viewport-sized overlay when the browser blocks native fullscreen.
      }
    }

    this.isFullscreenFallback = true;
    this.isFullscreen = true;
  }
}

@Component({
  selector: "seha-embed-session",
  standalone: true,
  imports: [CommonModule, EmbedSessionFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sessionUrl) {
      <div [class]="rootClass" [ngStyle]="style">
        <seha-embed-session-frame
          class="seha-embed-session__frame"
          [sessionUrl]="sessionUrl"
          [title]="iframeTitle"
          [allow]="iframeAllow"
          [expandFullscreenLabel]="resolvedLabels.expandFullscreenButton"
          [exitFullscreenLabel]="resolvedLabels.exitFullscreenButton"
          [id]="iframeId"
          [iframeStyles]="iframeStyles"
        />
      </div>
    } @else {
      <div [class]="rootClass" [ngStyle]="style">
        <form class="seha-embed-session__form" (submit)="handleSubmit($event)">
          <h2 class="seha-embed-session__heading">{{ resolvedLabels.heading }}</h2>
          <p class="seha-embed-session__description">{{ resolvedLabels.description }}</p>
          <label class="seha-embed-session__label" for="seha-visitor-identity">
            {{ resolvedLabels.userIdentityLabel }}
            @if (!hasSuppliedIdentity) {
              <span class="seha-embed-session__optional"> {{ resolvedLabels.optionalLabel }}</span>
            }
          </label>
          <input
            class="seha-embed-session__input"
            id="seha-visitor-identity"
            autocomplete="name"
            [placeholder]="resolvedLabels.userIdentityPlaceholder"
            [readOnly]="hasSuppliedIdentity"
            [value]="hasSuppliedIdentity ? userIdentity : enteredIdentity"
            [disabled]="isStarting"
            [ngStyle]="inputStyles"
            (input)="enteredIdentity = inputValue($event)"
          />
          <button class="seha-embed-session__button" type="submit" [disabled]="isStarting">
            {{ isStarting ? resolvedLabels.startingButton : resolvedLabels.startButton }}
          </button>
          @if (isStarting) {
            <p class="seha-embed-session__status" role="status" aria-live="polite">
              {{ resolvedLabels.loadingStatus }}
            </p>
          }
          @if (errorMessage) {
            <p class="seha-embed-session__error" role="alert">{{ errorMessage }}</p>
          }
        </form>
      </div>
    }
  `,
  styles: SESSION_STYLES,
})
export class EmbedSessionComponent {
  @Input() sessionEndpoint = DEFAULT_SESSION_ENDPOINT;
  @Input() sessionHeaders: Record<string, string> = {};
  @Input() sessionBody: Record<string, unknown> = {};
  @Input() userIdentity: string | undefined;
  @Input() initAgent: EmbeddedAgent | undefined;
  @Input() initDialect: ArabicDialect | undefined;
  @Input() language: SessionLanguage | undefined;
  @Input() labels: Partial<EmbedSessionLabels> = {};
  @Input() className = "";
  @Input() iframeTitle = "Seha Care consultation";
  @Input() iframeAllow = "camera; microphone; autoplay; fullscreen";
  @Input() iframeId: string | undefined;
  @Input() iframeStyles: Record<string, string | number> = {};
  @Input() inputStyles: Record<string, string | number> = {};
  @Input() style: Record<string, string | number> = {};

  @Output() readonly sessionStarted = new EventEmitter<EmbedSessionStartedEvent>();
  @Output() readonly sessionError = new EventEmitter<Error>();

  enteredIdentity = "";
  sessionUrl: string | undefined;
  errorMessage: string | undefined;
  isStarting = false;
  private requestController: AbortController | undefined;
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly changeDetector = inject(ChangeDetectorRef);

  constructor() {
    this.destroyRef.onDestroy(() => this.requestController?.abort());
  }

  get rootClass(): string {
    return ["seha-embed-session", this.sessionUrl ? "seha-embed-session--active" : "", this.className]
      .filter(Boolean)
      .join(" ");
  }

  get hasSuppliedIdentity(): boolean {
    return this.userIdentity !== undefined;
  }

  get resolvedLabels(): EmbedSessionLabels {
    return { ...DEFAULT_LABELS, ...this.labels };
  }

  inputValue(event: Event): string {
    return event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : "";
  }

  async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.isStarting || this.sessionUrl) return;

    this.isStarting = true;
    this.errorMessage = undefined;
    this.changeDetector.markForCheck();
    const controller = new AbortController();
    this.requestController = controller;

    try {
      const requestOptions: StartEmbeddedSessionRequest = {
        ...(this.hasSuppliedIdentity
          ? { userIdentity: this.userIdentity }
          : this.enteredIdentity.trim()
            ? { userIdentity: this.enteredIdentity.trim() }
            : {}),
        ...(this.initAgent ? { initAgent: this.initAgent } : {}),
        ...(this.initDialect ? { initDialect: this.initDialect } : {}),
        ...(this.language !== undefined ? { language: this.language } : {}),
      };
      const endpoint = createSameOriginEndpoint(
        this.sessionEndpoint,
        this.document.location.origin,
      );
      const result: StartEmbeddedSessionResponse = await requestBrowserSession(endpoint, {
        ...requestOptions,
        headers: this.sessionHeaders,
        body: this.sessionBody,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      this.sessionUrl = result.sessionUrl;
      this.changeDetector.markForCheck();
      this.sessionStarted.emit({ sessionUrl: result.sessionUrl });
    } catch (cause) {
      if (controller.signal.aborted || isAbortError(cause)) return;
      this.errorMessage = this.resolvedLabels.errorMessage;
      this.changeDetector.markForCheck();
      this.sessionError.emit(asError(cause));
    } finally {
      if (this.requestController === controller) this.requestController = undefined;
      if (!controller.signal.aborted) {
        this.isStarting = false;
        this.changeDetector.markForCheck();
      }
    }
  }
}

function assertHttpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("sessionUrl must be an absolute HTTP or HTTPS URL");
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password
  ) {
    throw new TypeError("sessionUrl must be an absolute HTTP or HTTPS URL");
  }
  return url.toString();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function asError(error: unknown): Error {
  if (error instanceof EmbeddedSessionRequestError) return error;
  return error instanceof Error ? error : new Error("Embedded session request failed");
}
