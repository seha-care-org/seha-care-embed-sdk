import type { CSSProperties, IframeHTMLAttributes } from "react";
import { EmbedFullscreenButton } from "./fullscreen-button.js";

export interface EmbedSessionFrameProps
  extends Omit<
    IframeHTMLAttributes<HTMLIFrameElement>,
    "allow" | "referrerPolicy" | "src" | "title"
  > {
  sessionUrl: string;
  title?: string;
  /** Replace the default camera, microphone, autoplay, and fullscreen permissions. */
  allow?: string;
  expandFullscreenLabel?: string;
  exitFullscreenLabel?: string;
}

const DEFAULT_ALLOW = "camera; microphone; autoplay; fullscreen";
const DEFAULT_STYLE: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  borderWidth: 0,
  borderStyle: "none",
};

export function EmbedSessionFrame({
  sessionUrl,
  title = "Seha Care consultation",
  allow = DEFAULT_ALLOW,
  className,
  style,
  loading = "eager",
  allowFullScreen = true,
  expandFullscreenLabel = "Expand consultation to full screen",
  exitFullscreenLabel = "Exit full screen",
  ...iframeProps
}: EmbedSessionFrameProps) {
  assertHttpUrl(sessionUrl);

  return (
    <div className="seha-embed-session-frame-shell">
      <iframe
        {...iframeProps}
        src={sessionUrl}
        title={title}
        allow={allow}
        allowFullScreen={allowFullScreen}
        referrerPolicy="no-referrer"
        loading={loading}
        className={["seha-embed-session__frame", className ?? ""]
          .filter(Boolean)
          .join(" ")}
        style={{ ...DEFAULT_STYLE, ...style }}
      />
      <EmbedFullscreenButton
        expandLabel={expandFullscreenLabel}
        exitLabel={exitFullscreenLabel}
      />
    </div>
  );
}

function assertHttpUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("sessionUrl must be an absolute HTTP or HTTPS URL");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new TypeError("sessionUrl must be an absolute HTTP or HTTPS URL");
  }
}
