import { createClient } from '@supabase/supabase-js'

// Your Project URL (Now with correct quotes)
const supabaseUrl = 'https://wkqittxnhepkdgvpuavv.supabase.co'

// Your Public API Key (Now with correct quotes)
const supabaseKey = 'sb_publishable_B_9L1cZ7-LffiYSYrr3JSw_HtkxzvaH'

// Create and export the connection
export const supabase = createClient(supabaseUrl, supabaseKey)