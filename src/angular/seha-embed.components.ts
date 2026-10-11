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
  validateStartSessionOptions,
} from "./session-client.js";
import type {
  ArabicDialect,
  EmbeddedAgent,
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
};

const IFRAME_STYLES = [
  ":host{display:block;width:100%;height:100%;min-height:32rem}",
  "iframe{display:block;width:100%;height:100%;border:0}",
];

const SESSION_STYLES = [
  ":host{display:block;width:100%;height:100%;min-height:32rem}",
  ".seha-embed-session{width:100%;height:100%;min-height:32rem}",
  ".seha-embed-session__form{display:flex;flex-direction:column;gap:.875rem;max-width:32rem;margin-inline:auto;padding:1.25rem}",
  ".seha-embed-session__heading,.seha-embed-session__description{margin:0}",
  ".seha-embed-session__input,.seha-embed-session__button{font:inherit;padding:.75rem;border-radius:.5rem}",
  ".seha-embed-session__button{cursor:pointer}",
  ".seha-embed-session__frame{display:block;width:100%;height:100%;min-height:32rem;border:0}",
  ".seha-embed-session__error{color:#a52828}",
];

@Component({
  selector: "seha-embed-session-frame",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<iframe #frame [src]="safeUrl" [attr.title]="title" allow="camera; microphone; autoplay" allowfullscreen referrerpolicy="no-referrer" loading="eager" [attr.id]="id" [class]="className" [ngStyle]="iframeStyles" (load)="frameLoad.emit($event)"></iframe>',
  styles: IFRAME_STYLES,
})
export class EmbedSessionFrameComponent implements AfterViewInit, OnChanges {
  @ViewChild("frame", { static: true }) private frame: ElementRef<HTMLIFrameElement> | undefined;
  @Input({ required: true }) sessionUrl = "";
  @Input() title = "Seha Care consultation";
  @Input() allow = "camera; microphone; autoplay";
  @Input() id: string | undefined;
  @Input() iframeStyles: Record<string, string | number> = {};
  @Input() className = "";
  @Output() readonly frameLoad = new EventEmitter<Event>();

  private readonly sanitizer = inject(DomSanitizer);
  private readonly renderer = inject(Renderer2);

  ngOnChanges(_changes: SimpleChanges): void {
    this.applyAllowPolicy();
  }

  ngAfterViewInit(): void {
    this.applyAllowPolicy();
  }

  get safeUrl(): SafeResourceUrl {
    const validatedUrl = assertHttpUrl(this.sessionUrl);
    return this.sanitizer.bypassSecurityTrustResourceUrl(validatedUrl);
  }

  private applyAllowPolicy(): void {
    if (this.frame) this.renderer.setAttribute(this.frame.nativeElement, "allow", this.allow);
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
  @Input() userIdentity: string | undefined;
  @Input() initAgent: EmbeddedAgent | undefined;
  @Input() initDialect: ArabicDialect | undefined;
  @Input() labels: Partial<EmbedSessionLabels> = {};
  @Input() className = "";
  @Input() iframeTitle = "Seha Care consultation";
  @Input() iframeAllow = "camera; microphone; autoplay";
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
      };
      const options = validateStartSessionOptions(requestOptions);
      const endpoint = createSameOriginEndpoint(
        this.sessionEndpoint,
        this.document.location.origin,
      );
      const result: StartEmbeddedSessionResponse = await requestBrowserSession(endpoint, {
        ...options,
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
