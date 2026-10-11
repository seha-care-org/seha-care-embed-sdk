import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmbedSession } from "../src/react/index.js";

const sessionUrl = "https://app.example.com/en/embed/session/demo-token";

describe("EmbedSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("trims an entered identity, starts on submit, and replaces the form with the iframe", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ sessionUrl }));
    const onSessionStarted = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <EmbedSession
        initAgent="triage"
        initDialect="EGY"
        sessionHeaders={{ "X-Organization-Id": "clinic-12" }}
        sessionBody={{ organizationContext: { bookingId: "booking-4821" } }}
        labels={{ heading: "Start care", userIdentityLabel: "Your name" }}
        className="host-root"
        style={{ maxWidth: 700 }}
        iframeProps={{
          id: "care-frame",
          title: "CarePoint session",
          allow: "camera; microphone; autoplay; fullscreen",
          allowFullScreen: true,
          className: "host-frame",
          style: { minHeight: 650 },
        }}
        onSessionStarted={onSessionStarted}
      />,
    );

    expect(screen.getByRole("heading", { name: "Start care" })).toBeInTheDocument();
    const identity = screen.getByLabelText(/Your name/);
    expect(identity).not.toHaveAttribute("readonly");
    fireEvent.change(identity, { target: { value: "  Demo visitor  " } });
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));

    expect(await screen.findByTitle("CarePoint session")).toHaveAttribute("src", sessionUrl);
    expect(screen.queryByRole("button", { name: "Start session" })).not.toBeInTheDocument();
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
          initAgent: "triage",
          initDialect: "EGY",
        }),
      }),
    );
    expect(onSessionStarted).toHaveBeenCalledWith({ sessionUrl });

    const frame = screen.getByTitle("CarePoint session");
    expect(frame).toHaveAttribute("id", "care-frame");
    expect(frame).toHaveAttribute("allow", "camera; microphone; autoplay; fullscreen");
    expect(frame).toHaveAttribute("allowfullscreen");
    expect(frame).toHaveClass("seha-embed-session__frame", "host-frame");
    expect(frame).toHaveStyle({ width: "100%", minHeight: "650px" });
    expect(container.firstElementChild).toHaveClass("seha-embed-session", "host-root");
  });

  it("shows and sends a supplied identity unchanged in a read-only field", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ sessionUrl }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EmbedSession userIdentity=" Known visitor " />);

    const identity = screen.getByLabelText("Visitor name");
    expect(identity).toHaveValue(" Known visitor ");
    expect(identity).toHaveAttribute("readonly");
    expect(screen.queryByText("(optional)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));

    await screen.findByTitle("Seha Care consultation");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ userIdentity: " Known visitor " }),
    );
  });

  it("omits a blank optional identity so the backend applies its default", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ sessionUrl }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EmbedSession />);
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));

    await screen.findByTitle("Seha Care consultation");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe("{}");
  });

  it("uses a supplied server action without making a browser request", async () => {
    const serverAction = vi.fn(async () => ({ sessionUrl }));
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(<EmbedSession startSession={serverAction} initAgent="knowledge" />);
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));

    await screen.findByTitle("Seha Care consultation");
    expect(serverAction).toHaveBeenCalledWith({ initAgent: "knowledge" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disables duplicate submits and announces the loading state", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve)),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<EmbedSession />);
    const form = screen.getByRole("button", { name: "Start session" }).closest("form");
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(screen.getByRole("status")).toHaveTextContent("Creating your private session link");
    expect(screen.getByRole("button", { name: "Starting session…" })).toBeDisabled();
    expect(screen.getByLabelText(/Visitor name/)).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveFetch(Response.json({ sessionUrl }));
    await screen.findByTitle("Seha Care consultation");
  });

  it.each([
    ["HTTP failure", () => new Response("private response details", { status: 503 })],
    ["malformed response", () => Response.json({})],
  ])("keeps the form after a %s and allows retry", async (_caseName, makeFailureResponse) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeFailureResponse())
      .mockResolvedValueOnce(Response.json({ sessionUrl }));
    const onError = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<EmbedSession onError={onError} />);
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not start the session. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Start session" })).toBeInTheDocument();
    expect(screen.queryByText("private response details")).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    await screen.findByTitle("Seha Care consultation");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancels an unfinished request on unmount without reporting an error", async () => {
    let observedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      observedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        observedSignal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });
    const onError = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(
      <EmbedSession onError={onError} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    await waitFor(() => expect(observedSignal).toBeDefined());
    unmount();

    expect(observedSignal?.aborted).toBe(true);
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });
});
