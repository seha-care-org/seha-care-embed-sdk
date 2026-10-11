import "server-only";

import type { CSSProperties } from "react";
import { executeStartEmbeddedSession } from "./action.js";
import {
  EmbedSession as ManagedEmbedSession,
  type EmbedSessionLabels,
} from "../react/index.js";
import type { EmbedSessionFrameProps } from "../react/frame.js";
import type {
  ArabicDialect,
  EmbeddedAgent,
  SessionLanguage,
  StartEmbeddedSessionRequest,
} from "../shared/types.js";

export { EmbedSessionFrame } from "../react/frame.js";
export type { EmbedSessionLabels } from "../react/embed-session.js";
export type { SessionLanguage } from "../shared/types.js";

interface NextEmbedSessionBaseProps {
  userIdentity?: string;
  initAgent?: EmbeddedAgent;
  initDialect?: ArabicDialect;
  language?: SessionLanguage;
  labels?: Partial<EmbedSessionLabels>;
  className?: string;
  style?: CSSProperties;
  iframeProps?: Omit<EmbedSessionFrameProps, "sessionUrl" | "onLoad">;
}

export type NextEmbedSessionProps = NextEmbedSessionBaseProps & (
  | {
      sessionEndpoint: string;
      sessionHeaders?: Record<string, string>;
      sessionBody?: Record<string, unknown>;
      beforeStartAction?: never;
    }
  | {
      sessionEndpoint?: never;
      sessionHeaders?: never;
      sessionBody?: never;
      beforeStartAction?: (
        options: StartEmbeddedSessionRequest,
      ) => void | Promise<void>;
    }
);

/**
 * Server Component: the tenant key is read only inside a Server Action.
 * Submitting creates a session; rendering and prefetching do not.
 */
export function EmbedSession(props: Readonly<NextEmbedSessionProps>) {
  const hasEndpoint = props.sessionEndpoint !== undefined;
  const hasCustomMetadata =
    props.sessionHeaders !== undefined || props.sessionBody !== undefined;
  if (
    (hasEndpoint && props.beforeStartAction !== undefined) ||
    (!hasEndpoint && hasCustomMetadata)
  ) {
    throw new TypeError(
      "Next.js custom session headers and body require sessionEndpoint and cannot be combined with beforeStartAction.",
    );
  }

  const {
    beforeStartAction,
    sessionEndpoint,
    sessionHeaders,
    sessionBody,
    ...serializableProps
  } = props;

  if (hasEndpoint) {
    return (
      <ManagedEmbedSession
        {...serializableProps}
        sessionEndpoint={sessionEndpoint}
        sessionHeaders={sessionHeaders}
        sessionBody={sessionBody}
      />
    );
  }

  async function startSession(untrustedOptions: StartEmbeddedSessionRequest) {
    "use server";

    return executeStartEmbeddedSession(beforeStartAction, untrustedOptions);
  }

  return (
    <ManagedEmbedSession
      {...serializableProps}
      startSession={startSession}
    />
  );
}
