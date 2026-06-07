# Attica Résidences — Site Web
Réf. TM-2026-AR01 | Taylor Swiss Media Value

## Structure du site
```
Attica/
├── index.html                  ← Page d'accueil (2 boutons : Annuelle / Mensuelle)
├── location-annuelle.html      ← Onglet 1 : Studios 24m² (Étudiants EPFL/UNIL)
├── location-mensuelle.html     ← Onglet 2 : Suites 45m² (Masters/PhD/Chercheurs)
├── assets/
│   └── images/
│       ├── logo-nav.png        ← Logo navigation (PNG transparent)
│       ├── logo-hero.jpg       ← Logo hero
│       └── gallery/            ← 10 photos optimisées
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

## À faire (prochaines étapes)
- Connecter les formulaires à un service d'envoi email (Formspree / Netlify Forms)
- Page location-parking.html
- Textes définitifs Onglet 2 (en attente de Laura)
