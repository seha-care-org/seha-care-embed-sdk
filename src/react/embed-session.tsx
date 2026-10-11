"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  SehaCareEmbedClient,
  type ArabicDialect,
  type EmbeddedAgent,
  type SessionLanguage,
} from "../client/index.js";
import { EmbedSessionFrame, type EmbedSessionFrameProps } from "./frame.js";
import type {
  StartEmbeddedSessionRequest,
  StartEmbeddedSessionResponse,
} from "../shared/types.js";

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

export interface EmbedSessionProps {
  sessionEndpoint?: string;
  sessionHeaders?: Record<string, string>;
  sessionBody?: Record<string, unknown>;
  startSession?: (
    options: StartEmbeddedSessionRequest,
  ) => Promise<StartEmbeddedSessionResponse>;
  userIdentity?: string;
  initAgent?: EmbeddedAgent;
  initDialect?: ArabicDialect;
  language?: SessionLanguage;
  labels?: Partial<EmbedSessionLabels>;
  className?: string;
  style?: CSSProperties;
  iframeProps?: Omit<EmbedSessionFrameProps, "sessionUrl">;
  onSessionStarted?: (result: { sessionUrl: string }) => void;
  onError?: (error: Error) => void;
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

export function EmbedSession({
  sessionEndpoint,
  sessionHeaders,
  sessionBody,
  startSession: startSessionAction,
  userIdentity,
  initAgent,
  initDialect,
  language,
  labels,
  className,
  style,
  iframeProps,
  onSessionStarted,
  onError,
}: EmbedSessionProps) {
  const [enteredIdentity, setEnteredIdentity] = useState("");
  const [sessionUrl, setSessionUrl] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isStarting, setIsStarting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const requestPending = useRef(false);
  const mounted = useRef(false);
  const suppliedIdentity = userIdentity !== undefined;
  const identityInputId = `seha-embed-session-identity${useId()}`;
  const resolvedLabels = { ...DEFAULT_LABELS, ...labels };

  useEffect(() => {
    mounted.current = true;
    setIsMounted(true);
    return () => {
      mounted.current = false;
      setIsMounted(false);
      activeRequest.current?.abort();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestPending.current || sessionUrl) return;

    requestPending.current = true;
    setErrorMessage(undefined);
    setIsStarting(true);

    const controller = new AbortController();
    activeRequest.current = controller;
    let result: { sessionUrl: string };
    try {
      const client = new SehaCareEmbedClient(sessionEndpoint);
      const visitorIdentity = enteredIdentity.trim();
      const options: StartEmbeddedSessionRequest = {
        ...(suppliedIdentity
          ? { userIdentity }
          : visitorIdentity
            ? { userIdentity: visitorIdentity }
            : {}),
        ...(initAgent ? { initAgent } : {}),
        ...(initDialect ? { initDialect } : {}),
        ...(language !== undefined ? { language } : {}),
      };
      result = startSessionAction
        ? await startSessionAction(options)
        : await client.startSession({
            ...options,
            headers: sessionHeaders,
            body: sessionBody,
            signal: controller.signal,
          });

    } catch (cause) {
      if (controller.signal.aborted || isAbortError(cause)) return;
      if (!mounted.current) return;

      setErrorMessage(resolvedLabels.errorMessage);
      onError?.(asError(cause));
      return;
    } finally {
      if (activeRequest.current === controller) activeRequest.current = undefined;
      requestPending.current = false;
      if (mounted.current) setIsStarting(false);
    }

    if (!mounted.current || controller.signal.aborted) return;
    setSessionUrl(result.sessionUrl);
    onSessionStarted?.(result);
  }

  const rootClassName = [
    "seha-embed-session",
    sessionUrl ? "seha-embed-session--active" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (sessionUrl) {
    const {
      className: iframeClassName,
      style: iframeStyle,
      expandFullscreenLabel,
      exitFullscreenLabel,
      ...restIframeProps
    } = iframeProps ?? {};

    return (
      <div className={rootClassName} style={style}>
        <EmbedSessionFrame
          {...restIframeProps}
          sessionUrl={sessionUrl}
          className={iframeClassName}
          style={iframeStyle}
          expandFullscreenLabel={
            expandFullscreenLabel ?? resolvedLabels.expandFullscreenButton
          }
          exitFullscreenLabel={exitFullscreenLabel ?? resolvedLabels.exitFullscreenButton}
        />
      </div>
    );
  }

  return (
    <div className={rootClassName} style={style}>
      <form className="seha-embed-session__form" onSubmit={handleSubmit}>
        <h2 className="seha-embed-session__heading">{resolvedLabels.heading}</h2>
        <p className="seha-embed-session__description">{resolvedLabels.description}</p>
        <label className="seha-embed-session__label" htmlFor={identityInputId}>
          {resolvedLabels.userIdentityLabel}
          {!suppliedIdentity && (
            <span className="seha-embed-session__optional"> {resolvedLabels.optionalLabel}</span>
          )}
        </label>
        <input
          className="seha-embed-session__input"
          id={identityInputId}
          autoComplete="name"
          placeholder={resolvedLabels.userIdentityPlaceholder}
          readOnly={suppliedIdentity}
          value={suppliedIdentity ? userIdentity : enteredIdentity}
          disabled={isStarting}
          onChange={(event) => setEnteredIdentity(event.currentTarget.value)}
        />
        <button className="seha-embed-session__button" type="submit" disabled={!isMounted || isStarting}>
          {isStarting ? resolvedLabels.startingButton : resolvedLabels.startButton}
        </button>
        {isStarting && (
          <p className="seha-embed-session__status" role="status" aria-live="polite">
            {resolvedLabels.loadingStatus}
          </p>
        )}
        {errorMessage && (
          <p className="seha-embed-session__error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Embedded session request failed");
}
