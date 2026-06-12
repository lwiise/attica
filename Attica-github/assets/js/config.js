/* ============================================================
 *  Attica Résidences — Configuration publique du front-end
 *  ------------------------------------------------------------
 *  À renseigner UNE SEULE FOIS après la création du projet Supabase.
 *  La clé "anon" est PUBLIQUE par conception : la sécurité repose sur
 *  les règles RLS (voir backend/schema.sql). Ne mettez JAMAIS ici la
 *  clé "service_role".
 * ============================================================ */
window.ATTICA_CONFIG = {
  // URL de votre projet (Supabase → Settings → API → Project URL)
  SUPABASE_URL: "https://lmcvmvmhyvoizdgnqhfm.supabase.co",

  // Clé publique "anon" (Supabase → Settings → API → anon public)
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtY3Ztdm1oeXZvaXpkZ25xaGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODk1NjUsImV4cCI6MjA5Njg2NTU2NX0.PRgTvF8lZkoAf3UiBIuR0cb8IUFmcllT4DB6IyS86m4",

  // Endpoint de l'Edge Function de réception des formulaires
  // = <SUPABASE_URL>/functions/v1/submit-application
  SUBMIT_ENDPOINT: "https://lmcvmvmhyvoizdgnqhfm.supabase.co/functions/v1/submit-application",
};
