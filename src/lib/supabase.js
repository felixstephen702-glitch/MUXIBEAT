import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase is optional for the first UI demo. Add .env.local values to connect it.
export const supabase = url && anonKey
  ? createClient(url, anonKey)
  : null