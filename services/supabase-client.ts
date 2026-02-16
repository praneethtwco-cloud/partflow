import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config';
import { Capacitor } from '@capacitor/core';
import { Http } from '@capacitor-community/http';

let sharedSupabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!sharedSupabaseClient) {
    const supabaseUrl = SUPABASE_CONFIG.URL;
    const supabaseAnonKey = SUPABASE_CONFIG.ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables. Please check your .env configuration.');
    }

    const isNative = Capacitor.isNativePlatform();

    sharedSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      ...(isNative && {
        httpAgent: async (options: any) => {
          const { url, method, headers, body } = options;
          try {
            const response = await Http.request({
              method: method as any,
              url: url,
              headers: headers,
              data: body ? JSON.parse(body) : undefined
            });
            return {
              ok: response.status >= 200 && response.status < 300,
              status: response.status,
              headers: response.headers,
              json: async () => response.data,
              text: async () => JSON.stringify(response.data)
            };
          } catch (error: any) {
            console.error('HTTP Error:', error);
            throw error;
          }
        }
      })
    });
  }

  return sharedSupabaseClient;
}

export function resetSupabaseClient() {
  sharedSupabaseClient = null;
}
