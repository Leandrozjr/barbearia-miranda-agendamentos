import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fallback keys (Hardcoded for stability)
const FALLBACK_URL = "https://egamwunxbhklcwstqhpf.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYW13dW54YmhrbGN3c3RxaHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjI2NDksImV4cCI6MjA4MzQ5ODY0OX0.ih35FmfalhKoKaogXX9Oi406O63TeLJ5cLIxCsPyID8";

// Priority: Env Vars > Fallback > Empty
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

export const isSupabaseConfigured = () => {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
};

let client: SupabaseClient | null = null;

try {
  if (isSupabaseConfigured()) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (error) {
  console.error("Erro ao inicializar Supabase. Verifique suas chaves.", error);
  client = null;
}

export const supabase = client;
