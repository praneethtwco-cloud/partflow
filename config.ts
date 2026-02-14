export const API_CONFIG = {
    // Replace with your Vercel URL
    BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'https://partflow-pro-akila.vercel.app',
    BACKEND_KEY: import.meta.env.VITE_API_KEY || 'partflow_secret_token_2026_v2'
};

export const SUPABASE_CONFIG = {
    URL: import.meta.env.VITE_SUPABASE_URL || '',
    ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};
