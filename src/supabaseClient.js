import { createClient } from '@supabase/supabase-js';

// Use environment variables (Best Practice)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // This is CRITICAL for the logout fix
    autoRefreshToken: true,
  }
});