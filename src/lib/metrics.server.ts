/**
 * Real counters for work the public API actually served. Root fix (2026-11-04):
 * the previous in-memory counters silently reset on every stateless worker
 * isolate, which rendered 0s and an epoch date. Counters now persist in the
 * backend database and increment only after a route has served a real result.
 * Nothing here is fabricated: no write happens without a served request.
 */
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./api-helpers.server";
import type { Database } from "@/integrations/supabase/types";

const COUNTER_KEYS = ["scans", "heals", "analyses", "verifications"] as const;
export type CounterKey = (typeof COUNTER_KEYS)[number];
const ACTIVE_SINCE_KEY = "counters_active_since";

export interface ApiCounters {
  scans: number;
  heals: number;
  analyses: number;
  verifications: number;
  /** Timestamp of the first counted API event; null until the first served request. */
  activeSince: string | null;
  note: string;
}

const NOTE = "counters persist in the database; every increment is a real served request";

function publishableClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new HttpError(503, "counters_unavailable", "Counters storage is not configured on the server.");
  }
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
        if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        // Opaque publishable keys are not bearer JWTs: send them as apikey only.
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Records one served request. A storage failure is logged, never surfaced to the caller. */
export async function recordCounter(key: CounterKey): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("increment_api_counter", { p_key: key });
    if (error) throw error;
  } catch (error) {
    console.error(`[metrics] failed to record "${key}":`, error instanceof Error ? error.message : error);
  }
}

export const recordScan = () => recordCounter("scans");
export const recordHeal = () => recordCounter("heals");
export const recordAnalysis = () => recordCounter("analyses");
export const recordVerification = () => recordCounter("verifications");

/** Reads the counters through the narrow public SELECT policy (no admin client). */
export async function apiCounters(): Promise<ApiCounters> {
  const client = publishableClient();
  const [counters, meta] = await Promise.all([
    client.from("api_counters").select("key,count"),
    client.from("api_counters_meta").select("key,value").eq("key", ACTIVE_SINCE_KEY).maybeSingle(),
  ]);
  if (counters.error || meta.error) {
    console.error("[metrics] counter read failed:", counters.error?.message ?? meta.error?.message);
    throw new HttpError(503, "counters_unavailable", "The served-work counters could not be read.");
  }
  const byKey = new Map((counters.data ?? []).map((r) => [r.key, Number(r.count) || 0]));
  const value = (k: CounterKey) => byKey.get(k) ?? 0;
  return {
    scans: value("scans"),
    heals: value("heals"),
    analyses: value("analyses"),
    verifications: value("verifications"),
    activeSince: meta.data?.value ?? null,
    note: NOTE,
  };
}
