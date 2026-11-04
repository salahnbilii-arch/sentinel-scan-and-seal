import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  children: ReactNode;
  /** Short label identifying the wrapped panel in logs and reports. */
  label: string;
}

interface State {
  error: Error | null;
}

/**
 * Per-section error boundary: one panel's crash renders this fallback instead of
 * killing the whole page (root fix for the page-killing `cn is not defined` crash).
 */
export class SectionBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[section:${this.props.label}]`, error, info.componentStack);
    reportLovableError(error, { boundary: `section:${this.props.label}` });
  }

  override render() {
    if (this.state.error) {
      return (
        <section className="panel border-critical/40 p-5">
          <h2 className="text-sm font-semibold text-critical">This panel failed to render</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything else on the page still works. You can retry the panel or reload the page.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-raised"
          >
            Try again
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
