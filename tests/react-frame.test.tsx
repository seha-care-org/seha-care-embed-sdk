import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmbedSessionFrame } from "../src/react/index.js";

const sessionUrl = "https://app.example.com/en/embed/session/token";

describe("EmbedSessionFrame", () => {
  it("renders the returned URL with accessible defaults and media permissions", () => {
    render(<EmbedSessionFrame sessionUrl={sessionUrl} />);

    const iframe = screen.getByTitle("Seha Care consultation");
    expect(iframe.parentElement).toHaveClass("seha-embed-session-frame-shell");
    expect(iframe).toHaveAttribute("src", sessionUrl);
    expect(iframe).toHaveAttribute("allow", "camera; microphone; autoplay");
    expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(iframe).toHaveAttribute("loading", "eager");
    expect(iframe).toHaveStyle({
      display: "block",
      width: "100%",
      height: "auto",
      borderWidth: "0px",
      borderStyle: "none",
    });
  });

  it("supports the host title, dimensions, permissions, and load callback", () => {
    const onLoad = vi.fn();
    render(
      <EmbedSessionFrame
        id="telehealth-iframe"
        sessionUrl={sessionUrl}
        title="CarePoint Telehealth Video Room"
        allow="camera; microphone; display-capture; autoplay; fullscreen"
        allowFullScreen
        className="telehealth-frame"
        style={{ minHeight: 640, aspectRatio: "1 / 1" }}
        onLoad={onLoad}
      />,
    );

    const iframe = screen.getByTitle("CarePoint Telehealth Video Room");
    fireEvent.load(iframe);

    expect(iframe).toHaveAttribute("id", "telehealth-iframe");
    expect(iframe).toHaveAttribute(
      "allow",
      "camera; microphone; display-capture; autoplay; fullscreen",
    );
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(iframe).toHaveClass("telehealth-frame");
    expect(iframe).toHaveStyle({ width: "100%", minHeight: "640px", aspectRatio: "1 / 1" });
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("rejects non-HTTP session URLs", () => {
    expect(() => render(<EmbedSessionFrame sessionUrl="javascript:alert(1)" />)).toThrow(
      "absolute HTTP or HTTPS URL",
    );
  });
});
