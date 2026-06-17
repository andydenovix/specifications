# DeNovix Master Spec Sheets

A hosted product specification comparison tool for DeNovix instruments. Admins edit specs in Google Sheets; the site rebuilds automatically and serves the data both as a standalone app and as embeddable components for the DeNovix WordPress site.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture & Key Decisions](#architecture--key-decisions)
4. [Security](#security)
5. [Quick Usage Guide](#quick-usage-guide)
6. [How Content Gets Modified](#how-content-gets-modified)
7. [Adding a New Product Line](#adding-a-new-product-line)
8. [Development Setup](#development-setup)
9. [Deployment](#deployment)
10. [File Structure](#file-structure)

---

## System Overview

```
Google Sheets (master data)
        │
        │  [on each Netlify build]
        ▼
  fetchData.js  ──► specData.json  (bundled into the app)
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
       Main App (dist/)         Embed Bundle (spec-embed.js)
  denovixspecs.netlify.app      loaded by WordPress pages
              │                        │
              └───────────┬────────────┘
                          ▼
                  Firestore (live config)
              theme · visibility · ordering
```

**The key split:** product/spec data is static (baked into the build from Google Sheets), while UI configuration — colors, which columns are hidden, category ordering — is live from Firestore and updates without a rebuild.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + Vite |
| Database / Auth | Firebase (Firestore + Google OAuth) |
| Data source | Google Sheets API v4 |
| Hosting | Netlify |
| Embed delivery | Vite IIFE bundle (`spec-embed.js`) |

---

## Architecture & Key Decisions

### 1. Google Sheets as the content source
Non-technical team members edit specs directly in a shared spreadsheet. No CMS or database schema to maintain. The fetch script (`scripts/fetchData.js`) pulls three tabs at build time and writes `src/assets/specData.json`.

**Trade-off:** Spec changes require a rebuild (~1–2 min via the Admin sync button). Configuration changes (theme, visibility, ordering) are instant via Firestore.

### 2. Static JSON + real-time Firestore
`specData.json` is bundled at build time for fast initial load with no runtime API dependency on Google. Firestore handles everything that should update instantly — the two layers never overlap in responsibility.

### 3. Dual build output
One codebase produces two artifacts:
- **`dist/`** — the full standalone app with tabs, filters, and admin panel
- **`spec-embed.js`** — a self-contained IIFE bundle that WordPress pages load with a single `<script>` tag

Both read the same `specData.json` and subscribe to the same Firestore documents, so they're always in sync.

### 4. Embed via script tag, not iframe
The embed renders directly into the WordPress page's DOM rather than inside an iframe. This means the spec table inherits the page's scroll context and is easier to style — no cross-origin iframe sizing hacks needed (the `postMessage` height reporting only applies to the standalone app, not embeds).

### 5. Firestore for configuration only
Theme colors, hidden products/rows, and category/feature ordering are all stored in Firestore and applied at runtime. This means an admin can rearrange or hide a product without waiting for a rebuild.

### 6. Domain-restricted admin access
Only `@denovix.com` Google accounts can log in. This is enforced at two levels: the Google OAuth `hd` parameter (restricts the Google login picker) and a Firestore rule check at the database level.

---

## Security

### Netlify build hook
The build hook URL that triggers a Netlify rebuild is stored as an environment variable (`VITE_NETLIFY_BUILD_HOOK`) — it is **not hardcoded** in source. It is set in:
- Netlify site settings → Environment variables (for production builds)
- A local `.env` file (if needed for local testing — already gitignored)

### postMessage origin
The iframe height reporting message targets `https://www.denovix.com` specifically, not the wildcard `*`. This prevents a malicious page from spoofing the parent frame.

### Firebase API key
The Firebase client API key is visible in source — this is expected and safe for Firebase web apps. Security is enforced by **Firestore rules**, not the key itself.

Current Firestore rules:
```js
allow read: if true;
allow write: if request.auth != null
  && request.auth.token.email_verified == true
  && request.auth.token.email.matches('.*@denovix\\.com');
```
- **Read is public** — the spec matrix is public-facing content.
- **Write is locked** to verified `@denovix.com` accounts only.

### Google service account credentials
The `google-credentials.json` file (used by `fetchData.js` to access Google Sheets) is **gitignored** and was never committed. In production, credentials are passed via Netlify's `GOOGLE_CREDENTIALS_JSON` environment variable.

### Firebase authorized domains
In the Firebase Console (Authentication → Settings → Authorized domains), only the Netlify production domain and `localhost` should be listed.

---

## Quick Usage Guide

### Viewing specs (public)
Navigate to `https://denovixspecs.netlify.app/`. Use the tabs to switch between product lines. Use the filter controls to narrow by measurement mode, optics, throughput, etc.

### Embedding specs on WordPress
Add this snippet to any WordPress page where you want a spec table to appear:

```html
<div data-spec-tab="Spectrophotometers / Fluorometers"></div>
<script src="https://denovixspecs.netlify.app/spec-embed.js" defer></script>
```

Replace the `data-spec-tab` value with the exact tab name you want to display. The Admin Portal shows a pre-built snippet for every available tab — use the copy button there.

### Accessing the Admin Panel
1. Click **🔐 Admin Panel** (bottom of the main app)
2. Sign in with your `@denovix.com` Google account
3. You now have access to four control sections:

| Section | What it does |
|---|---|
| Brand Design | Change theme colors and font stack |
| WordPress Embed Snippets | Copy embed code for each product line |
| Category Display Order | Drag categories to reorder them per tab |
| Hide Products / Rows | Toggle visibility of products and spec rows; drag rows to reorder |

All changes save to Firestore instantly. Visibility and ordering changes appear live on the site and in all embeds without a rebuild.

---

## How Content Gets Modified

### Spec data (product specs, feature rows, categories)

1. Open the [Google Sheets master spreadsheet](https://docs.google.com/spreadsheets/d/1itRN0ghY_ipkYwCnrHhhbMpYy1-no8DQUJYD0Xrj2pM/edit?usp=sharing).
2. Make edits — add rows, change values, rename columns, etc.
   - **Row 0** = column headers (product names)
   - **Column A** = category group names
   - **Column B** = feature/specification names
   - **Remaining columns** = spec values per product
3. In the Admin Panel, click **Sync Google Sheet**.
4. Netlify triggers a rebuild. The site updates in ~1–2 minutes.

### Theme / colors
Admin Panel → **Brand Design & Typography** → adjust pickers → changes save immediately.

### Product / row visibility
Admin Panel → **Hide Product Columns** or **Hide Specification Rows** → toggle checkboxes → saves immediately.

### Category and row ordering
Admin Panel → **Category Display Order** → drag to reorder → saves immediately.
Admin Panel → **Hide Specification Rows** → drag row handles within a category → saves immediately.

---

## Adding a New Product Line

A "product line" here means a new tab in the Google Sheet (e.g. adding "Microplate Readers" alongside the existing Spectrophotometers and Cell Counters tabs).

### Step 1 — Add the tab to Google Sheets
Create a new sheet tab with the product line name. Follow the same column structure as existing tabs:
- Row 1: product names in columns C onward
- Column A: category group names
- Column B: feature names
- Fill in spec values

### Step 2 — Register the tab in `fetchData.js`
In `scripts/fetchData.js`, add the new tab name to the list of sheets being fetched. It should match the exact tab name in Google Sheets.

### Step 3 — Add product metadata to `src/config/products.js`

For each new product in the line, add an entry:

```js
// Spectrophotometer / Fluorometer type
'DS-12 Pro': {
  type: 'spec',
  modes: ['Microvolume UV-Vis', 'Cuvette UV-Vis', 'Fluorescence'],
  optionalModes: [],
  multi: false,
}

// Cell Counter type
'CellDrop XL': {
  type: 'counter',
  optics: ['Brightfield', 'Fluorescence'],
  magnification: ['Standard Magnification'],
}
```

If this is an entirely new instrument category with different filter dimensions, you may also need to add filter logic to `src/components/FilterControls.jsx`.

### Step 4 — Trigger a sync
In the Admin Panel, click **Sync Google Sheet**. The new tab will appear automatically in the main app and embed system once the build completes.

### Step 5 — Add an embed snippet to WordPress
After the sync, the Admin Panel → **WordPress Embed Snippets** section will automatically include a snippet for the new tab. Copy and paste it into the relevant WordPress page.

---

## Development Setup

### Prerequisites
- Node.js 18+
- A `google-credentials.json` file in the project root (Google service account with Sheets read access — get this from the Firebase/Google Cloud console, do not commit it)

### Install & run

```bash
npm install
npm run dev        # starts local dev server at localhost:5173
```

### Fetch latest spec data locally

```bash
node scripts/fetchData.js
```

This regenerates `src/assets/specData.json` from the live Google Sheet. Run this before building if you want the latest data locally.

### Build

```bash
npm run build      # full pipeline: fetch data → build app → build embed bundle
```

Output goes to `dist/` (main app + `spec-embed.js`).

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_NETLIFY_BUILD_HOOK` | Netlify env vars | URL to trigger a production rebuild from the admin panel |
| `GOOGLE_CREDENTIALS_JSON` | Netlify env vars | Service account JSON (string) for Google Sheets access during build |

For local dev, neither is required — the dev server doesn't need to trigger Netlify builds, and `google-credentials.json` handles Sheets access locally.

---

## Deployment

Hosting is on Netlify, connected to the `main` branch of this repo.

**Build command:** `npm run build`
**Publish directory:** `dist`

Every push to `main` triggers a full rebuild (fetch from Sheets → build app → build embed bundle). Admins can also trigger a rebuild manually via the **Sync Google Sheet** button in the Admin Panel, which POSTs to the Netlify build hook URL.

The embed script (`spec-embed.js`) is published into `dist/` alongside the main app, so both are served from the same Netlify domain.

---

## File Structure

```
/
├── index.html                     # HTML entry for main app
├── netlify.toml                   # Build config
├── vite.config.js                 # Main app Vite config
├── vite.embed.config.js           # Embed bundle Vite config (IIFE output)
├── .env.example                   # Template for local env vars
├── google-credentials.json        # Service account key — NOT in git
│
├── scripts/
│   └── fetchData.js               # Fetches Google Sheets → specData.json
│
└── src/
    ├── main.jsx                   # Entry for main app
    ├── embed.jsx                  # Entry for embed bundle
    ├── App.jsx                    # Top-level routing and auth state
    ├── firebase.js                # Firebase init
    ├── assets/
    │   └── specData.json          # Generated at build time — do not edit manually
    ├── config/
    │   └── products.js            # Product metadata and font options
    └── components/
        ├── SpecMatrix.jsx         # Spec comparison table
        ├── SpecEmbed.jsx          # Embed wrapper (single-tab, no admin UI)
        ├── AdminPortal.jsx        # Admin control panel
        ├── AdminLogin.jsx         # Google OAuth login screen
        └── FilterControls.jsx     # Filter bar (modes, optics, throughput, magnification)
```
