import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s["next"]) }),
  head: () => ({
    meta: [
      { title: "Operator Sign In — SentinelOps AI" },
      {
        name: "description",
        content:
          "Authenticate to the SentinelOps AI command center to access autonomous security agents and connected AI clients.",
      },
      { property: "og:title", content: "Operator Sign In — SentinelOps AI" },
      {
        property: "og:description",
        content: "Secure operator access to the SentinelOps AI autonomous security platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(next);
    });
  }, [next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${next}` },
      });
      setBusy(false);
      if (signUpError) return setError(signUpError.message);
      setNotice("Check your inbox to confirm this operator account, then sign in.");
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) return setError(signInError.message);
    window.location.replace(next);
  }

  async function google() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${next}`,
    });
    if (result.error) return setError(result.error.message ?? "Google sign-in failed.");
    if (result.redirected) return;
    void navigate({ to: next });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-lg border border-primary/25 bg-card/70 p-8 shadow-[0_0_40px_-18px_hsl(var(--primary))] backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <div>
            <h1 className="font-mono text-lg tracking-widest text-foreground">OPERATOR ACCESS</h1>
            <p className="text-xs text-muted-foreground">SentinelOps AI · authenticated plane</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 font-sans text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 font-sans text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && <p className="text-sm text-primary">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 font-mono text-sm uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Authenticating…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={google}
          className="mt-3 w-full rounded-md border border-border bg-background/60 px-4 py-2 font-mono text-sm uppercase tracking-widest text-foreground hover:border-primary"
        >
          Continue with Google
        </button>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {mode === "signin" ? "Need an operator account? Register" : "Already registered? Sign in"}
        </button>
      </div>
    </main>
  );
}
