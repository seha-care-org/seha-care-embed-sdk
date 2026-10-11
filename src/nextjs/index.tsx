import "server-only";

import type { CSSProperties } from "react";
import { startEmbeddedSessionAction } from "./action.js";
import {
  EmbedSession as ManagedEmbedSession,
  type EmbedSessionLabels,
} from "../react/index.js";
import type { EmbedSessionFrameProps } from "../react/frame.js";
import type {
  ArabicDialect,
  EmbeddedAgent,
  StartEmbeddedSessionRequest,
} from "../shared/types.js";

export { EmbedSessionFrame } from "../react/frame.js";
export type { EmbedSessionLabels } from "../react/embed-session.js";

export interface NextEmbedSessionProps {
  userIdentity?: string;
  initAgent?: EmbeddedAgent;
  initDialect?: ArabicDialect;
  labels?: Partial<EmbedSessionLabels>;
  className?: string;
  style?: CSSProperties;
  iframeProps?: Omit<EmbedSessionFrameProps, "sessionUrl" | "onLoad">;
  beforeStartAction?: (
    options: StartEmbeddedSessionRequest,
  ) => void | Promise<void>;
}

/**
 * Server Component: the tenant key is read only inside a Server Action.
 * Submitting creates a session; rendering and prefetching do not.
 */
export function EmbedSession(props: Readonly<NextEmbedSessionProps>) {
  const startSession = startEmbeddedSessionAction.bind(
    null,
    props.beforeStartAction,
  );
  const {
    beforeStartAction: _beforeStartAction,
    ...serializableProps
  } = props;

  return (
    <ManagedEmbedSession
      {...serializableProps}
      startSession={startSession}
    />
  );
}
