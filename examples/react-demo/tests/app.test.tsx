import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";

describe("React SDK demo", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the SDK start component and uses it to place the returned session iframe", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      Response.json({
        sessionUrl: "https://app.example.com/en/embed/session/demo-token",
      }),
    );

    render(<App />);
    expect(screen.getByLabelText(/Visitor name/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Visitor name/), {
      target: { value: "Demo visitor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));

    expect(await screen.findByTitle("Seha Care telehealth session")).toHaveAttribute(
      "src",
      "https://app.example.com/en/embed/session/demo-token",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/seha-care/session",
      expect.objectContaining({
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userIdentity: "Demo visitor", initAgent: "receptionist" }),
      }),
    );
  });

  it("renders the demo heading and the component's safe error state", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("private backend details", { status: 403 }));

    render(<App />);
    expect(screen.getByRole("heading", { name: "Embedded telehealth session" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not start the session. Please try again.",
    );
    expect(screen.queryByTitle("Seha Care telehealth session")).not.toBeInTheDocument();
  });
});
