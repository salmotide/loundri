import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const configurationError = !url || !publishableKey
  ? 'Konfigurasi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY belum diisi.'
  : '';

export const supabase = configurationError ? null : createClient(url, publishableKey);
