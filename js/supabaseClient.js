const SUPABASE_URL = "https://mgatiikbhpjcyfeimzdv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3UCgWsy297gMAyes5OKu0w_ia2t6-Qe";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  window.pensionatoSupabase = null;
  window.pensionatoPublicSupabase = null;
  window.pensionatoSupabaseError = "Não foi possível carregar a biblioteca do Supabase. Verifique sua conexão com a internet e recarregue a página.";
} else if (!SUPABASE_ANON_KEY.trim()) {
  window.pensionatoSupabase = null;
  window.pensionatoPublicSupabase = null;
  window.pensionatoSupabaseError = "Para conectar ao banco, informe a chave anon/public do projeto em js/supabaseClient.js.";
} else {
  window.pensionatoSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.pensionatoPublicSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storageKey: "pensionato-public-auth",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  window.pensionatoSupabaseError = "";
}
