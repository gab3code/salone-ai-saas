"use server";

import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";

export async function esci() {
  const supabase = await creaClientServer();
  await supabase.auth.signOut();
  redirect("/accedi");
}
