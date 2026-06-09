import { createClient } from "@supabase/supabase-js"

import { getServerEnv } from "./env"

export function createServerSupabaseClient() {
  const env = getServerEnv()

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
