import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dcgsmnosupjtochqmmvk.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_SE3WddGx27LI4ZMRKk34OA_6u2XCm1D";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
