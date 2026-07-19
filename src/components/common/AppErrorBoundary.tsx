import {
  Component,
  Fragment,
  useEffect,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from "react";
import React from "react";
import { runtimeConfig, type ReleaseMetadata } from "../../lib/runtimeConfig";
import { redactString, safeLogger, type SafeLogger } from "../../lib/observability/safeLogger";

export interface AppErrorFallbackProps {
  incidentId: string;
  release: ReleaseMetadata;
  onRetry: () => void;
  onReload: () => void;
}

export function createIncidentReference(): string {
  const randomPart = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 10)
    ?? Math.random().toString(36).slice(2, 12);
  return `INC-${Date.now().toString(36).toUpperCase()}-${randomPart.toUpperCase()}`;
}

export function AppErrorFallback({
  incidentId,
  release,
  onRetry,
  onReload,
}: AppErrorFallbackProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const commit = release.commitSha === "unknown" ? "unknown" : release.commitSha.slice(0, 12);

  return (
    <main
      className="runtime-error-shell"
      role="alert"
      aria-live="assertive"
      aria-labelledby="runtime-error-title"
    >
      <div className="runtime-error-content">
        <p className="eyebrow">Application safety response</p>
        <h1 id="runtime-error-title" ref={headingRef} tabIndex={-1}>
          PrefabHome could not continue
        </h1>
        <p>
          The current view stopped safely. Retry the application or reload this page. No technical
          error details are shown here.
        </p>
        <dl className="runtime-error-reference">
          <div>
            <dt>Reference</dt>
            <dd>{incidentId}</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>{release.environment}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{release.appVersion}</dd>
          </div>
          <div>
            <dt>Commit</dt>
            <dd>{commit}</dd>
          </div>
        </dl>
        <div className="runtime-error-actions">
          <button type="button" onClick={onRetry} aria-label="Retry PrefabHome application">
            Retry
          </button>
          <button type="button" className="secondary" onClick={onReload} aria-label="Reload PrefabHome page">
            Reload
          </button>
        </div>
      </div>
    </main>
  );
}

type RuntimeEventTarget = Pick<Window, "addEventListener" | "removeEventListener">;

function safeGlobalErrorValue(value: unknown): Error | string {
  if (value instanceof Error) return value;
  if (typeof value === "string") return redactString(value);
  return "A browser runtime error occurred.";
}

export function installGlobalRuntimeErrorListeners(
  target: RuntimeEventTarget,
  logger: SafeLogger = safeLogger,
  release: ReleaseMetadata = runtimeConfig.release,
  now: () => number = Date.now
): () => void {
  const seenObjects = new WeakSet<object>();
  const seenMessages = new Map<string, number>();
  const dedupeWindowMs = 10_000;

  function shouldReport(kind: string, value: unknown): boolean {
    if (value && typeof value === "object") {
      if (seenObjects.has(value)) return false;
      seenObjects.add(value);
      return true;
    }
    const key = `${kind}:${redactString(String(value)).slice(0, 200)}`;
    const timestamp = now();
    const previous = seenMessages.get(key);
    seenMessages.set(key, timestamp);
    if (seenMessages.size > 50) {
      for (const [candidate, recordedAt] of seenMessages) {
        if (timestamp - recordedAt > dedupeWindowMs) seenMessages.delete(candidate);
      }
    }
    return previous === undefined || timestamp - previous > dedupeWindowMs;
  }

  const handleWindowError: EventListener = (event) => {
    const errorEvent = event as ErrorEvent;
    const value = errorEvent.error ?? errorEvent.message;
    if (!shouldReport("window.error", value)) return;
    logger.error("Unhandled browser error", {
      incidentId: createIncidentReference(),
      release,
      error: safeGlobalErrorValue(value),
    });
  };

  const handleUnhandledRejection: EventListener = (event) => {
    const rejectionEvent = event as PromiseRejectionEvent;
    if (!shouldReport("unhandledrejection", rejectionEvent.reason)) return;
    logger.error("Unhandled promise rejection", {
      incidentId: createIncidentReference(),
      release,
      error: safeGlobalErrorValue(rejectionEvent.reason),
    });
  };

  target.addEventListener("error", handleWindowError);
  target.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    target.removeEventListener("error", handleWindowError);
    target.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
}

interface AppErrorBoundaryProps {
  children: ReactNode;
  logger?: SafeLogger;
  release?: ReleaseMetadata;
  runtimeTarget?: RuntimeEventTarget | null;
  reload?: () => void;
}

export interface AppErrorBoundaryState {
  hasError: boolean;
  incidentId: string | null;
  resetKey: number;
}

export function retryBoundaryState(state: AppErrorBoundaryState): AppErrorBoundaryState {
  return {
    hasError: false,
    incidentId: null,
    resetKey: state.resetKey + 1,
  };
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    incidentId: null,
    resetKey: 0,
  };

  private removeRuntimeListeners: (() => void) | null = null;

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return {
      hasError: true,
      incidentId: createIncidentReference(),
    };
  }

  componentDidMount() {
    const target = this.props.runtimeTarget ?? (typeof window !== "undefined" ? window : null);
    if (target) {
      this.removeRuntimeListeners = installGlobalRuntimeErrorListeners(
        target,
        this.props.logger ?? safeLogger,
        this.props.release ?? runtimeConfig.release
      );
    }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    (this.props.logger ?? safeLogger).error("React application boundary caught an error", {
      incidentId: this.state.incidentId ?? createIncidentReference(),
      release: this.props.release ?? runtimeConfig.release,
      error,
    });
  }

  componentWillUnmount() {
    this.removeRuntimeListeners?.();
    this.removeRuntimeListeners = null;
  }

  retry = () => {
    this.setState(retryBoundaryState);
  };

  reload = () => {
    if (this.props.reload) {
      this.props.reload();
      return;
    }
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <AppErrorFallback
          incidentId={this.state.incidentId ?? createIncidentReference()}
          release={this.props.release ?? runtimeConfig.release}
          onRetry={this.retry}
          onReload={this.reload}
        />
      );
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
