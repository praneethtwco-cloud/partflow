export const SUPABASE_CONFIG = {
    URL: import.meta.env.VITE_SUPABASE_URL || '',
    ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

export const GEMINI_CONFIG = {
    BASE_URL: 'https://generativelanguage.googleapis.com/v1/models'
};
