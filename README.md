# Tracking Environment Build Guide

An interactive, step-by-step walkthrough for CMS/PAS tracking environment builds
(Websites 360 Lead Gen, WordPress/Woo360 Lead Gen, and Ecommerce/Both), built from
the CMS Handbook docs.

- Setup questions generate only the steps the current build needs
- Every screenshot and doc link from the handbook is preserved as a clickable chip
- Paste-as-you-go entry boxes capture each ID/label/code where it's created
- The Code Vault assembles a copyable, Zoho-ready list of everything captured
- Special cases (No Ad Spend, No C2C, alternate Ads UIs, iframe forms, CMPro
  subdomains, client-placed codes, etc.) are folded into the flow or kept in a
  reference tab
- Progress auto-saves to the browser (localStorage), per person, per browser

## Run it locally

Requires Node 18+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Build for hosting

```bash
npm run build
```

The static site lands in `dist/` — deploy it to Netlify, Vercel, GitHub Pages, or
any internal static host. Each person's build progress is saved in their own
browser; nothing is stored on a server.

## Where things live

```
index.html                     entry page
src/main.jsx                   React bootstrap + localStorage shim for window.storage
src/App.jsx                    thin wrapper
src/tracking-build-guide.jsx   the entire guide (steps, links, code fields, vault)
```

## Customizing

Everything is in `src/tracking-build-guide.jsx`:

- **Add/edit code fields** — the `CODE_FIELDS` array at the top defines every
  vault slot, its Zoho label, and the condition for when it appears.
- **Edit steps** — each phase is a block inside the `sections` useMemo
  (`start`, `c2c`, `ga4`, `ads`, `gtm`, `sc`, `mc`, `ob`, `final`). Steps are
  `{ id, title, body }` objects; `<Shot u="..." l="..." />` renders a screenshot
  chip, `<Lit v="..." />` renders a copyable literal value.
- **Special cases** — the `specials` array near the bottom.
- **Colors/typography** — the `T` token object at the top.

When the handbook changes, update the matching step text/links here so the guide
stays the source of truth.
