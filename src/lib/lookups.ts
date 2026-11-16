import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/auth";
import type { Agent, Client } from "@/lib/types";
import type { Developer } from "@/lib/developers";

/** Full records used to pre-fill documents and populate pickers. RLS limits what each role sees. */
export const getLookups = cache(async () => {
  if (!supabaseConfigured()) {
    return { clients: [] as Client[], developers: [] as Developer[], agents: [] as Agent[] };
  }
  const supabase = await createClient();
  const [c, d, a] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase.from("developers").select("*").order("developer_name"),
    supabase.from("agents").select("*").order("full_name"),
  ]);
  return {
    clients: (c.data ?? []) as Client[],
    developers: (d.data ?? []) as Developer[],
    agents: (a.data ?? []) as Agent[],
  };
});
