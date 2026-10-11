"use client";

import { useEffect, useRef, useState } from "react";

const FALLBACK_CLASS = "seha-embed-session-frame-shell--fullscreen-fallback";

interface EmbedFullscreenButtonProps {
  expandLabel: string;
  exitLabel: string;
}

export function EmbedFullscreenButton({
  expandLabel,
  exitLabel,
}: EmbedFullscreenButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const shell = buttonRef.current?.parentElement;
    if (!shell) return;

    const syncFullscreenState = () => {
      const isNativeFullscreen = document.fullscreenElement === shell;
      const isFallbackFullscreen = shell.classList.contains(FALLBACK_CLASS);
      setIsFullscreen(isNativeFullscreen || isFallbackFullscreen);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !shell.classList.contains(FALLBACK_CLASS)) return;
      shell.classList.remove(FALLBACK_CLASS);
      setIsFullscreen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("keydown", handleKeyDown);
      shell.classList.remove(FALLBACK_CLASS);
    };
  }, []);

  async function toggleFullscreen() {
    const shell = buttonRef.current?.parentElement;
    if (!shell) return;

    if (document.fullscreenElement === shell) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    if (shell.classList.contains(FALLBACK_CLASS)) {
      shell.classList.remove(FALLBACK_CLASS);
      setIsFullscreen(false);
      buttonRef.current?.focus();
      return;
    }

    if (document.fullscreenEnabled && shell.requestFullscreen) {
      try {
        await shell.requestFullscreen();
        return;
      } catch {
        // Fall back to a viewport-sized overlay when browser fullscreen is unavailable.
      }
    }

    shell.classList.add(FALLBACK_CLASS);
    setIsFullscreen(true);
  }

  return (
    <button
      ref={buttonRef}
      className="seha-embed-session__fullscreen-button"
      type="button"
      aria-label={isFullscreen ? exitLabel : expandLabel}
      aria-pressed={isFullscreen}
      title={isFullscreen ? exitLabel : expandLabel}
      onClick={toggleFullscreen}
    >
      <span aria-hidden="true">{isFullscreen ? "×" : "⛶"}</span>
    </button>
  );
}
