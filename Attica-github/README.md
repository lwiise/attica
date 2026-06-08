# Attica Résidences — Site Web
Réf. TM-2026-AR01 | Taylor Swiss Media Value

## Structure du site
```
Attica/
├── index.html                  ← Page d'accueil (2 boutons : Annuelle / Mensuelle)
├── location-annuelle.html      ← Onglet 1 : Studios 24m² (Étudiants EPFL/UNIL)
├── location-mensuelle.html     ← Onglet 2 : Suites 45m² (Masters/PhD/Chercheurs)
├── admin.html                  ← Tableau de bord privé des demandes (login)
├── assets/
│   ├── js/config.js            ← Clés Supabase (à renseigner) — voir SETUP.md
│   └── images/
│       ├── logo-nav.png        ← Logo navigation (PNG transparent)
│       ├── logo-hero.jpg       ← Logo hero
│       └── gallery/            ← 10 photos optimisées
├── backend/                    ← Schéma SQL + Edge Function (Supabase)
├── SETUP.md                    ← Guide de mise en place du back-end
└── README.md
```

## Mise en ligne (Netlify Drop)
1. Aller sur netlify.com/drop
2. Glisser-déposer le dossier "Attica" complet
3. Le site est en ligne en ~30 secondes

⚠️ index.html doit rester à la racine du dossier.

## Fonctionnalités
- Site bilingue FR / EN (bascule + mémorisation navigateur)
- Galerie photos avec lightbox
- Formulaire de demande (annuelle) calqué sur le PDF Segurimmo
- Formulaire de réservation (mensuelle)
- Bouton WhatsApp flottant : +41 79 638 17 90
- Note anti-escroquerie FR/EN
- Responsive desktop / tablette / mobile
- **Collecte des formulaires + documents via Supabase** (base UE Frankfurt, stockage privé)
- **Tableau de bord privé** `admin.html` : consultation des demandes, téléchargement
  des pièces, statut & notes (accès par login)

## Back-end (Supabase)
Les formulaires envoient désormais champs **et documents** vers Supabase.
👉 Configuration en ~30 min : voir **[SETUP.md](SETUP.md)**.
Tant que `assets/js/config.js` n'est pas renseigné, l'envoi affiche un message
« Configuration manquante » (aucune donnée perdue côté visiteur).

## À faire (prochaines étapes)
- Renseigner `assets/js/config.js` et déployer l'Edge Function (voir SETUP.md)
- Page location-parking.html
- Textes définitifs Onglet 2 (en attente de Laura)
