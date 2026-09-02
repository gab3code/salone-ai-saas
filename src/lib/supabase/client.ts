"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase per componenti browser (React "use client"). Usa SOLO la
 * anon key -- ogni lettura/scrittura passa dalle policy RLS, mai un bypass.
 * Questo è il client che, ad esempio, chiama supabase.auth.signUp() nel
 * form di registrazione.
 */
export function creaClientBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
