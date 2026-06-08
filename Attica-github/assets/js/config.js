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
  SUPABASE_URL: "https://VOTRE-PROJET.supabase.co",

  // Clé publique "anon" (Supabase → Settings → API → anon public)
  SUPABASE_ANON_KEY: "VOTRE_CLE_ANON",

  // Endpoint de l'Edge Function de réception des formulaires
  // = <SUPABASE_URL>/functions/v1/submit-application
  SUBMIT_ENDPOINT: "https://VOTRE-PROJET.supabase.co/functions/v1/submit-application",
};
