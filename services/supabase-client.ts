import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config';

let sharedSupabaseClient: SupabaseClient | null = null;

export const supabase = getSupabaseClient();

export function getSupabaseClient(): SupabaseClient {
  if (!sharedSupabaseClient) {
    const supabaseUrl = SUPABASE_CONFIG.URL;
    const supabaseAnonKey = SUPABASE_CONFIG.ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables. Please check your .env configuration.');
    }

    sharedSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
  }

  return sharedSupabaseClient;
}

export function resetSupabaseClient() {
  sharedSupabaseClient = null;
}
