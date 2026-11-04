/**
 * Neutral pending state for client-side route transitions. Deliberately NOT a
 * page: while a route chunk or loader resolves, the previous page's content
 * must never stay on screen and no other page's content may flash.
 */
export function DefaultPending() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-2 border-border border-t-primary"
        />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Loading…
        </span>
      </div>
    </div>
  );
}
