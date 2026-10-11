import type { CSSProperties, IframeHTMLAttributes } from "react";

export interface EmbedSessionFrameProps
  extends Omit<
    IframeHTMLAttributes<HTMLIFrameElement>,
    "allow" | "referrerPolicy" | "src" | "title"
  > {
  sessionUrl: string;
  title?: string;
  /** Replace the default camera, microphone, and autoplay permissions. */
  allow?: string;
}

const DEFAULT_ALLOW = "camera; microphone; autoplay";
const DEFAULT_STYLE: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
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
  ...iframeProps
}: EmbedSessionFrameProps) {
  assertHttpUrl(sessionUrl);

  return (
    <iframe
      {...iframeProps}
      src={sessionUrl}
      title={title}
      allow={allow}
      referrerPolicy="no-referrer"
      loading={loading}
      className={className}
      style={{ ...DEFAULT_STYLE, ...style }}
    />
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
