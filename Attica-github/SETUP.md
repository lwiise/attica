# Attica Résidences — Mise en place du back-end (Supabase)

Collecte des formulaires **+ documents** (passeport, justificatifs financiers, etc.)
et **tableau de bord privé** pour consulter et gérer les demandes.

> **Données sensibles.** Choisissez la région **Frankfurt (eu-central-1)** à la
> création du projet : les documents (pièces d'identité, relevés bancaires)
> restent ainsi dans l'UE, conformément à la nLPD/RGPD.

---

## Architecture (résumé)

```
Formulaire (navigateur)  ──POST(FormData + fichiers)──►  Edge Function "submit-application"
                                                          │  • valide
                                                          │  • upload fichiers → bucket PRIVÉ
                                                          │  • insère la demande en base
                                                          │  • email de notification (option.)
                                                          ▼
                                              Base Postgres + Storage (privé, UE)
                                                          ▲
        admin.html (login Supabase) ──lecture/maj + URLs signées──┘
```

Le navigateur public **n'a aucun accès** à la base : tout passe par l'Edge
Function (clé `service_role`, côté serveur). Seuls vos comptes admin connectés
peuvent lire les demandes et télécharger les documents.

---

## Étapes (≈ 30 min)

### 1. Créer le projet Supabase
1. https://supabase.com → **New project**
2. **Region : Frankfurt (eu-central-1)**. Notez le mot de passe de la base.

### 2. Créer la base + le stockage
1. Menu **SQL Editor** → **New query**.
2. Copiez-collez tout le contenu de [`backend/schema.sql`](backend/schema.sql) → **Run**.
   (Crée la table `applications`, les règles de sécurité RLS, et le bucket privé `applications`.)

### 3. Déployer l'Edge Function
**Option simple (sans outil) :** menu **Edge Functions** → **Deploy a new function**
→ nom exact `submit-application` → collez le contenu de
[`backend/functions/submit-application/index.ts`](backend/functions/submit-application/index.ts) → **Deploy**.

**Option CLI :**
```bash
supabase login
supabase link --project-ref VOTRE_REF
supabase functions deploy submit-application --no-verify-jwt
```

### 4. (Optionnel) Activer l'email de notification
1. Créez un compte sur https://resend.com et **vérifiez votre domaine** (région UE).
2. Dans Supabase → **Project Settings → Edge Functions → Secrets**, ajoutez :
   - `RESEND_API_KEY` = votre clé Resend
   - `NOTIFY_EMAIL`   = adresse(s) destinataire(s), séparées par des virgules
   - `FROM_EMAIL`     = expéditeur vérifié (ex. `demandes@attica-residences.ch`)

   Sans ces secrets, les demandes sont quand même enregistrées (juste pas d'email).

### 5. Renseigner le front-end
Dans **Settings → API**, copiez **Project URL** et la clé **anon public**, puis
éditez [`assets/js/config.js`](assets/js/config.js) :
```js
SUPABASE_URL:      "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...",            // clé anon (publique, OK)
SUBMIT_ENDPOINT:   "https://xxxx.supabase.co/functions/v1/submit-application",
```
> La clé **anon** est publique par conception (sécurité assurée par RLS).
> Ne mettez **jamais** la clé `service_role` dans ce fichier.

### 6. Créer votre compte admin
1. Menu **Authentication → Users → Add user** → email + mot de passe (pour vous / Segurimmo).
2. **Déclarez ce compte comme administrateur** (obligatoire — sinon le tableau de
   bord n'affiche aucune demande). Dans **SQL Editor**, exécutez en remplaçant l'email :
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'vous@exemple.com'
   on conflict (user_id) do nothing;
   ```
   Seuls les comptes présents dans `public.admins` peuvent lire/gérer les demandes et
   télécharger les documents (verrouillage RLS, en plus du point 3 ci-dessous).
3. **Authentication → Providers → Email** : désactivez **« Enable sign-ups »**
   pour qu'aucun inconnu ne puisse créer de compte.

### 7. Mettre en ligne et tester
1. Redéployez le site (Netlify).
2. Envoyez une demande test depuis `location-mensuelle.html` (avec un fichier).
3. Ouvrez **`/admin.html`**, connectez-vous, vérifiez la demande et le
   téléchargement du document.

---

## Dépannage : les emails de notification n'arrivent plus ?

Bonne nouvelle : **les demandes sont quand même enregistrées** (vérifiez
`/admin.html`) — seul l'email d'alerte est en cause. Depuis la mise à jour de
la fonction, chaque demande porte le résultat de l'envoi (visible dans le
volet de détail du tableau de bord : « Email de notification : envoyé ✓ /
ÉCHEC — raison »), et l'erreur exacte apparaît dans
**Supabase → Edge Functions → submit-application → Logs**.

Pour bénéficier de ce suivi sur un projet déjà en place :
1. Ré-exécutez [`backend/schema.sql`](backend/schema.sql) dans le SQL Editor
   (le fichier est ré-exécutable sans risque ; il ajoute 2 colonnes).
2. Redéployez la fonction : recollez le contenu de
   [`backend/functions/submit-application/index.ts`](backend/functions/submit-application/index.ts)
   dans **Edge Functions → submit-application**, ou
   `supabase functions deploy submit-application --no-verify-jwt`.
3. Envoyez une demande test et regardez le statut dans le tableau de bord.

Causes fréquentes d'un arrêt des emails **alors que ça fonctionnait** :
- **Domaine plus vérifié chez Resend** : si les enregistrements DNS
  (SPF/DKIM) ont été modifiés ou supprimés (changement d'hébergeur, refonte
  DNS), Resend rejette chaque envoi. Vérifiez https://resend.com/domains
  (statut « Verified »).
- **Clé API révoquée ou supprimée** : vérifiez https://resend.com/api-keys et
  que le secret `RESEND_API_KEY` existe toujours dans
  **Project Settings → Edge Functions → Secrets**.
- **Quota Resend atteint** : offre gratuite = 100 emails/jour, 3 000/mois.
- **Expéditeur `onboarding@resend.dev`** : ne délivre qu'à l'adresse du
  compte Resend lui-même — utilisez un domaine vérifié.
- **Filtrage spam** : cherchez « Nouvelle demande » dans le dossier
  spam/indésirables ; consultez https://resend.com/emails (statut
  « Delivered » vs « Bounced »).
- **Projet Supabase en pause** (offre gratuite, ~1 semaine d'inactivité) :
  dans ce cas le formulaire entier échoue, pas seulement l'email —
  réactivez le projet depuis le dashboard Supabase.

---

## Conformité & sécurité (à valider)
- ✅ Données hébergées en **UE (Frankfurt)** ; bucket **privé** ; accès admin par login.
- ✅ Téléchargements via **URLs signées** temporaires (5 min).
- ⬜ Signez le **DPA** de Supabase (Data Processing Agreement).
- ⬜ Définissez une **durée de conservation** des dossiers et supprimez les
  documents des candidats non retenus.
- ⬜ Restreignez `Access-Control-Allow-Origin` de l'Edge Function à votre domaine
  une fois l'URL finale connue (actuellement `*`).

---

## Coûts indicatifs
- Supabase : gratuit pour démarrer (1 Go stockage). Au-delà : ~25 USD/mois (Pro).
- Resend : gratuit jusqu'à 3 000 emails/mois.
- Netlify : gratuit (hébergement statique).
