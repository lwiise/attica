---
name: verify
description: Build/launch/drive recipe to verify changes to the Attica static site (rental application forms + Supabase backend).
---

# Verifying Attica changes

Static site, no build step. All pages live in `Attica-github/`.

## Launch

```bash
(cd Attica-github && python3 -m http.server 8901 >/dev/null 2>&1 &)
curl -s -o /dev/null -w '%{http_code}' http://localhost:8901/location-annuelle.html   # expect 200
```

## Drive (browser)

Playwright is installed globally; ESM imports need a local symlink:

```bash
mkdir -p node_modules && ln -sfn /opt/node22/lib/node_modules/playwright node_modules/playwright
```

Launch Chromium with the explicit executable (the default resolution path fails):

```js
chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
```

## Flows worth driving

- The three form pages: `location-annuelle.html` (`#rental-form`), `location-mensuelle.html`
  (`#reservation-form`), `location-parking.html` (`#parking-form`).
- File uploads: inputs inside `.form-upload-area`; selections ACCUMULATE across picks
  (custom JS reassigns `input.files` via `DataTransfer`), list renders in the sibling
  `.form-upload-list` with per-file remove buttons.
- Submission posts `new FormData(form)` to `ATTICA_CONFIG.SUBMIT_ENDPOINT`
  (Supabase Edge Function `backend/functions/submit-application/index.ts`); without
  `assets/js/config.js` configured, submit shows an alert — intercept the route or
  inspect `FormData` composition in-page instead.

## Gotchas

- `html { scroll-behavior: smooth }` makes `scrollIntoView` async — screenshot the
  element (`locator.screenshot()`) instead of scrolling then screenshotting the page.
- Bilingual UI: `setLang('en'|'fr')` rewrites every `[data-fr]` element's innerHTML from
  its `data-*` attributes; dynamic text must keep those attributes in sync or it gets
  clobbered on language toggle.
