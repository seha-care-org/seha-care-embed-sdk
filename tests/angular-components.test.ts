import { ComponentFixture, TestBed } from "@angular/core/testing";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as AngularComponents from "../src/angular/seha-embed.components.js";

type EmbedSessionComponentInstance = InstanceType<typeof AngularComponents.EmbedSessionComponent>;
let EmbedSessionComponentClass: typeof AngularComponents.EmbedSessionComponent;
let EmbedSessionFrameComponentClass: typeof AngularComponents.EmbedSessionFrameComponent;

const sessionUrl = "https://demo.seha-care.com/en/embed/session/test-session-token";

describe("Angular embed components", () => {
  let fixture: ComponentFixture<EmbedSessionComponentInstance>;

  beforeAll(async () => {
    const packageEntry = "@seha-care/embed-sdk/angular";
    const angular = await import(packageEntry) as typeof AngularComponents;
    EmbedSessionComponentClass = angular.EmbedSessionComponent;
    EmbedSessionFrameComponentClass = angular.EmbedSessionFrameComponent;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmbedSessionComponentClass] }).compileComponents();
    fixture = TestBed.createComponent(EmbedSessionComponentClass);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (fixture && !fixture.componentRef.hostView.destroyed) fixture.destroy();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it("posts trimmed options to the same-origin endpoint and renders the iframe", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ sessionUrl }));
    vi.stubGlobal("fetch", fetchMock);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput("initAgent", "knowledge");
    fixture.componentRef.setInput("initDialect", "LEV");
    fixture.componentRef.setInput("sessionHeaders", { "X-Organization-Id": "clinic-12" });
    fixture.componentRef.setInput("sessionBody", { organizationContext: { bookingId: "booking-4821" } });
    fixture.componentRef.setInput("labels", { heading: "Start a consultation" });
    fixture.componentRef.setInput("className", "host-widget");
    const started = vi.fn();
    component.sessionStarted.subscribe(started);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("h2").textContent).toContain("Start a consultation");

    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
    input.value = "  Demo visitor  ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(component.sessionUrl).toBe(sessionUrl));
    fixture.detectChanges();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/seha-care/session",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-organization-id": "clinic-12",
        },
        body: JSON.stringify({
          organizationContext: { bookingId: "booking-4821" },
          userIdentity: "Demo visitor",
          initAgent: "knowledge",
          initDialect: "LEV",
        }),
      }),
    );
    expect(started).toHaveBeenCalledWith({ sessionUrl });

    const iframe = fixture.nativeElement.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toHaveAttribute("src", sessionUrl);
    expect(iframe).toHaveAttribute("title", "Seha Care consultation");
    expect(iframe).toHaveAttribute("allow", "camera; microphone; autoplay");
    expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(iframe).toHaveStyle({ width: "100%", height: "100%" });
    expect(fixture.nativeElement.firstElementChild).toHaveClass("host-widget");
  });

  it("blocks duplicate submits and announces loading", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const component = fixture.componentInstance;
    const firstRequest = component.handleSubmit(new Event("submit", { cancelable: true }));
    fixture.detectChanges();
    await component.handleSubmit(new Event("submit", { cancelable: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      "Creating your private session link",
    );
    expect(fixture.nativeElement.querySelector("button").disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveFetch(Response.json({ sessionUrl }));
    await firstRequest;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("iframe")).toBeTruthy();
  });

  it("announces safe errors, keeps the form, and allows retry", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("private upstream details", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ sessionUrl }));
    vi.stubGlobal("fetch", fetchMock);
    const component = fixture.componentInstance;
    const onError = vi.fn();
    component.sessionError.subscribe(onError);

    await component.handleSubmit(new Event("submit", { cancelable: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not start the session. Please try again.",
    );
    expect(fixture.nativeElement.textContent).not.toContain("private upstream details");
    expect(fixture.nativeElement.querySelector("button")).toBeTruthy();
    expect(onError).toHaveBeenCalledOnce();

    await component.handleSubmit(new Event("submit", { cancelable: true }));
    fixture.detectChanges();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector("iframe")).toBeTruthy();
  });

  it("aborts and ignores a stale response after destruction", async () => {
    let resolveFetch!: (response: Response) => void;
    let observedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      observedSignal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => (resolveFetch = resolve));
    });
    vi.stubGlobal("fetch", fetchMock);
    const started = vi.fn();
    fixture.componentInstance.sessionStarted.subscribe(started);
    const request = fixture.componentInstance.handleSubmit(new Event("submit", { cancelable: true }));
    fixture.destroy();

    expect(observedSignal?.aborted).toBe(true);
    resolveFetch(Response.json({ sessionUrl }));
    await request;
    expect(started).not.toHaveBeenCalled();
  });

  it("validates iframe URLs before trusting them and preserves iframe defaults", () => {
    const frameFixture = TestBed.createComponent(EmbedSessionFrameComponentClass);
    frameFixture.componentInstance.sessionUrl = sessionUrl;
    frameFixture.detectChanges();
    const iframe = frameFixture.nativeElement.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toHaveAttribute("src", sessionUrl);
    expect(iframe).toHaveAttribute("allow", "camera; microphone; autoplay");
    expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(iframe).toHaveAttribute("loading", "eager");
    expect(iframe).toHaveAttribute("allowfullscreen");
    frameFixture.componentRef.setInput("allow", "camera; microphone; autoplay; fullscreen");
    frameFixture.componentRef.setInput("title", "Host consultation");
    frameFixture.componentRef.setInput("id", "host-frame");
    frameFixture.componentRef.setInput("iframeStyles", { minHeight: "640px" });
    frameFixture.detectChanges();
    expect(iframe).toHaveAttribute("allow", "camera; microphone; autoplay; fullscreen");
    expect(iframe).toHaveAttribute("title", "Host consultation");
    expect(iframe).toHaveAttribute("id", "host-frame");
    expect(iframe).toHaveStyle({ width: "100%", minHeight: "640px" });
    const frameLoaded = vi.fn();
    frameFixture.componentInstance.frameLoad.subscribe(frameLoaded);
    iframe.dispatchEvent(new Event("load"));
    expect(frameLoaded).toHaveBeenCalledOnce();
    frameFixture.destroy();

    const unsafeFixture = TestBed.createComponent(EmbedSessionFrameComponentClass);
    unsafeFixture.componentInstance.sessionUrl = "javascript:alert(1)";
    expect(() => unsafeFixture.detectChanges()).toThrow("absolute HTTP or HTTPS URL");
    unsafeFixture.destroy();
  });
});
