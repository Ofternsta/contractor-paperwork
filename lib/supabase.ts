import { createClient } from '@/lib/supabase/client'

/** Browser Supabase client (uses logged-in session when available). */
export const supabase = createClient()
