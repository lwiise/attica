-- ============================================================
--  Attica Résidences — Schéma base de données des demandes
--  À exécuter dans : Supabase → SQL Editor → New query → Run
--  Région recommandée du projet : Frankfurt (eu-central-1)
-- ============================================================

-- 1) Table des demandes -------------------------------------------------
create table if not exists public.applications (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  type            text not null check (type in ('annuelle','mensuelle')),
  status          text not null default 'new'
                    check (status in ('new','reviewing','accepted','rejected','archived')),
  applicant_name  text,
  applicant_email text,
  applicant_phone text,
  data            jsonb not null default '{}'::jsonb,   -- tous les champs du formulaire
  files           jsonb not null default '[]'::jsonb,   -- [{field, path, name, size, type}]
  notes           text  not null default ''
);

create index if not exists applications_created_at_idx on public.applications (created_at desc);
create index if not exists applications_status_idx     on public.applications (status);
create index if not exists applications_type_idx       on public.applications (type);

-- 2) Row Level Security -------------------------------------------------
--    * Les visiteurs (clé anon) ne peuvent NI lire NI écrire la table.
--    * Les insertions passent UNIQUEMENT par l'Edge Function (service_role,
--      qui contourne RLS) -> aucune policy insert pour le public.
--    * Le tableau de bord (utilisateurs authentifiés = vos admins) peut
--      lire et mettre à jour les demandes.
alter table public.applications enable row level security;

drop policy if exists "admins read applications"   on public.applications;
create policy "admins read applications"
  on public.applications for select
  to authenticated using (true);

drop policy if exists "admins update applications" on public.applications;
create policy "admins update applications"
  on public.applications for update
  to authenticated using (true) with check (true);

-- 3) Stockage privé des documents --------------------------------------
insert into storage.buckets (id, name, public)
values ('applications', 'applications', false)
on conflict (id) do nothing;

-- Seuls les admins authentifiés peuvent lire les fichiers (pour générer
-- des URLs signées de téléchargement). L'upload est réservé au
-- service_role de l'Edge Function -> pas de policy insert publique.
drop policy if exists "admins read application files" on storage.objects;
create policy "admins read application files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'applications');

-- ============================================================
--  Fin. Rappel sécurité : ne partagez JAMAIS la clé service_role
--  (réservée à l'Edge Function). La clé "anon" est publique.
-- ============================================================
