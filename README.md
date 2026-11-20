# Kanban — a Jira-style task board

A static web app for GitHub Pages: Kanban boards with Jira-like issues, GitHub sign-in and per-member access rights. The interface is available in **English** and **Ukrainian** (switch in the top bar).

**Live site:** https://darkv3ctor.github.io/app-kanban/

## Features

- **Jira-like issues:** key (`GAME-12`), type, status, priority, assignee, reporter, labels, components, fix version, epic, story points, time estimate, due date; game dev boards also have a build field (the build a bug was found in).
- **Markdown descriptions:** headings, lists, tables, code, links and clickable `- [ ]` checkboxes. Raw HTML is shown as text, and external images load only when clicked (see [Security](#security)).
- **Checklist** (sub-tasks) with progress shown on the card.
- **Issue links:** blocks / is blocked by / relates to / duplicates.
- **Covers and release dates** (movies, series & games boards): upload a picture, paste or drop one (also straight from another web page), or link to one. Uploads are shrunk in the browser to a small WebP and kept in the issue itself, so no file storage is needed. Cards show the cover, the release year (or the date, highlighted, while it is still ahead) and the rating with a star; the issue list has a sortable release date column.
- **Comments** (Markdown, edit, delete) and a **change history** of every field.
- **Board:** drag & drop (mouse, touch, keyboard), WIP limits, quick create inside a column, swimlanes by assignee, epic or priority.
- **Filters:** text search, assignees, type, priority, labels, components, version, epic, "My issues", "Updated this week".
- **Issue list** with sorting and CSV export (opens in Excel).
- **Calendar:** a month grid (or a list of the month's days, the default on phones) of what comes out on which day: release dates on movies, series & games boards, due dates on other boards. The board's filters apply; "+" on a day creates an issue for that date.
- **Releases:** versions and milestones with dates, progress, release and archive.
- **Progress charts** for a day, week, month or year (browse back through earlier periods): completed and created issues with the change against the previous period, median lead time, story points, the share of the board that is done, a created-vs-completed column chart, a burn-up chart, a GitHub-style activity heatmap for the year, breakdowns by type and assignee and the latest completed issues. Every chart has hover / keyboard tooltips and a table view.
- **Field names per kind of board:** the issue fields are called the way the board's template suggests ("Milestone" and "Discipline" in game dev; "Who does it", "Room / area", "Month", "Goal", "Effort" at home; "Release" in software; "Format", "Genres", "Platform", "Franchise", "My rating", "Length" for movies and games), and admins can rename any of them in the board settings.
- **Board settings:** columns and their categories, issue types (icon, color, description template, default checklist), field names, labels, components.
- **Members and permissions:** add people by GitHub username and pick one of 5 roles.
- Board export/import as JSON, mobile layout.
- **Appearance:** seven designs — *Classic* (Atlassian-like), *Apple* (SF Pro / Inter, frosted-glass bars and menus, iOS system colors), *Fluent* (Microsoft Fluent 2 as in Microsoft 365, built on the official Fluent UI tokens: Segoe UI, the brand-blue header, NavDrawer with the selection indicator, shadow-based elevation, stroke buttons, inputs with the focus underline, TabList tabs, tint badges), *Material* (Google's Material Design 3 / Material You with the baseline purple scheme: Roboto, tonal surfaces instead of lines, pill buttons and a pill-shaped navigation indicator, outlined text fields, filter chips, segmented buttons, 28 px dialogs, inverse snackbars), *Translucent* (frosted glass over a soft aurora backdrop: blurred translucent panels, pill buttons with a gradient glow; turns opaque when the system asks for reduced transparency), *Linux* (inspired by Kali Linux: a monospaced UI in JetBrains Mono, near-black navy with the Kali blue and terminal green, `$` prompts with a blinking cursor, `[ DONE ]` status tags, glowing focus) and *Brutalist* (neo-brutalism: thick black outlines and hard offset shadows, buttons and cards that lift on hover and press flat, a pink primary and a yellow top bar, column headers coloured by category, a cream dot-grid page, chunky Rubik with uppercase labels; off-white ink in dark mode) — each in light, dark or auto (follows the system) mode. Switch them from the top-bar button; the choice is remembered in the browser.
- The board menu on the left can be resized (drag its edge) and hidden.
- Keyboard shortcuts: `C` creates an issue, `/` focuses search, `[` hides or shows the board menu.

## Templates

| Template | Columns | Issue types |
|---|---|---|
| 🎮 **Game development** | Backlog → To do → In progress → Review → QA / Playtest → Done | Epic, Feature, Bug, Task, Art, Audio, Level design, Game design, Tech debt |
| 🏠 **Home & life** | Ideas → Planned → This week → In progress → Waiting → Done | Goal, Chore, Shopping, Repair, Finance, Health, Event, Learning / hobby |
| 💻 **Software development** | To do → In progress → In review → Done | Epic, Story, Task, Bug |
| 🍿 **Movies, series & games** | Wishlist → Coming soon → Up next → Watching / playing → Finished → Dropped | Franchise, Movie, Series, Game |
| 📋 **Blank board** | To do → In progress → Done | Epic, Task, Bug |

The game dev template comes with components (Gameplay, Graphics, Audio, UI/UX, AI, Networking…), milestones (Prototype → Vertical Slice → Alpha → Beta → Release 1.0) and description templates: steps to reproduce and environment for bugs, a definition of done for features, asset requirements for art and audio. The home template has rooms and areas of life, monthly versions and templates for repairs, payments, doctor visits and events. The movies, series & games template adds covers and release dates to its issues, uses genres as labels and platforms (cinema, streaming, PC, consoles) as components, plans by month, groups a franchise as an epic and keeps a 1–10 rating in the story points (which are then not added up). Its values have their own names too: the interest goes from "Can't wait" to "Someday" instead of Highest…Lowest, and nobody being assigned reads "Nobody yet" ("For me" instead of "Assign to me"). Everything can be changed in the board settings.

A board's template text (column names, types, sample issues) is created in the interface language that is active when you create the board. Field names are not stored: each viewer sees the template's field names in their own language, until an admin renames a field (custom names are shown as typed).

## Roles

| Action | Owner | Admin | Editor | Commenter | Viewer |
|---|:-:|:-:|:-:|:-:|:-:|
| View the board and issues | ✓ | ✓ | ✓ | ✓ | ✓ |
| Comment | ✓ | ✓ | ✓ | ✓ | |
| Create, edit and move issues | ✓ | ✓ | ✓ | | |
| Delete own issues | ✓ | ✓ | ✓ | | |
| Delete any issue or comment | ✓ | ✓ | | | |
| Columns, types, labels, versions, settings | ✓ | ✓ | | | |
| Add members and assign roles | ✓ | ✓ | | | |
| Delete the board, transfer ownership | ✓ | | | | |

Permissions are enforced on the server by [`firestore.rules`](firestore.rules), not only in the UI. They are tied to the numeric GitHub ID rather than the username, so renaming a GitHub account does not break access. The rules also validate the shape of every document (field types, lengths, valid roles, exactly one owner, unique issue numbers) and are covered by tests (`npm run test:rules`). Comments, history entries and new issues must carry the current time (±10 minutes, so a device clock that is far off makes these writes fail), and a member's name and avatar are written only when they are added and removed together with them — nobody can rename another member. People who are no longer on a board are shown as "Former member".

Separately, you control **who can create new boards**: the app admins (their GitHub IDs are listed in `config.js` and `firestore.rules`) and users they allow via the avatar menu → "Who can create boards". Everyone else sees only the boards they were invited to.

---

## Demo mode

Until Firebase is configured (`firebase: null` in [`public/config.js`](public/config.js)) the site runs in **demo mode**: no sign-in, and data is kept only in this browser's localStorage. It is a quick way to try the app. Boards can be moved later via Settings → "Download JSON", then Boards → "Import".

## Enabling GitHub sign-in (Firebase)

GitHub Pages only serves static files, so sign-in and the shared database are provided by Firebase. The free Spark plan is enough (50k reads and 20k writes per day).

### 1. Create a Firebase project

1. Open https://console.firebase.google.com → **Create a project** (Google Analytics is optional).
2. On the project overview, click the **`</>`** (Web) icon and register an app (Firebase Hosting is not needed).
3. Keep the `firebaseConfig` object — you will need it in step 5.

### 2. Enable GitHub sign-in

1. Firebase: **Build → Authentication → Get started → Sign-in method → Add new provider → GitHub**, turn on **Enable**.
2. Copy the **authorization callback URL**, e.g. `https://<project-id>.firebaseapp.com/__/auth/handler`. Keep the dialog open.
3. In another tab open GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App** (https://github.com/settings/applications/new). Make sure it is an *OAuth App*, not a *GitHub App*.
   - **Application name:** `Kanban`
   - **Homepage URL:** `https://darkv3ctor.github.io/app-kanban/` (informational only, can be changed later)
   - **Authorization callback URL:** the URL from Firebase
4. Click **Register application**, then **Generate a new client secret** (it is shown only once).
5. Paste the **Client ID** and **Client secret** into the Firebase GitHub provider dialog → **Save**.

The client secret must stay in Firebase only — never commit it.

### 3. Authorize the site's domain

Firebase: **Authentication → Settings → Authorized domains → Add domain** → `darkv3ctor.github.io` (domain only, no `https://` and no path).

### 4. Create the database and security rules

1. Firebase: **Build → Firestore Database → Create database**. Choose **Standard edition**, keep the database ID `(default)`, pick a location close to you (it cannot be changed later) and **Start in production mode**.
2. Open the **Rules** tab, replace its content with [`firestore.rules`](firestore.rules) and click **Publish**.

   Or with the CLI: `npx firebase-tools login`, then `npx firebase-tools deploy --only firestore:rules --project <project-id>`.

### 5. Add the config and deploy

Edit [`public/config.js`](public/config.js):

```js
window.KANBAN_CONFIG = {
  firebase: {
    apiKey: "AIza...",
    authDomain: "<project-id>.firebaseapp.com",
    projectId: "<project-id>",
    storageBucket: "<project-id>.firebasestorage.app",
    messagingSenderId: "...",
    appId: "1:...:web:..."
  },
  appAdmins: ["78609208"],
  appCheckSiteKey: null
};
```

Commit and push to `main` — GitHub Actions builds and publishes the site. The `firebaseConfig` values are public identifiers, not secrets; data access is protected by the Firestore rules.

**The rules are not deployed by CI.** Whenever `firestore.rules` changes, publish it again (step 4) — the site and the rules must match.

### Adding another app admin

Find the numeric GitHub ID (`https://api.github.com/users/<username>`, field `id`) and add it in two places:

- `appAdmins` in `public/config.js`;
- the list in `isAppAdmin()` in `firestore.rules` (then publish the rules again).

Regular board members don't need this — a board owner or admin adds them on the board's Members page.

---

## Security

What the app does:

- **Server-side rules** check permissions and validate every write ([`firestore.rules`](firestore.rules)); the client also normalizes everything it reads, so one malformed document cannot break the board for others, and rendering errors are contained by error boundaries.
- **Markdown** (written by anyone with the commenter role) is rendered without raw HTML and sanitized with a strict allowlist; external images are shown as placeholders and load only when clicked, so they cannot be used as tracking pixels. Issue covers are the exception: a linked cover (https only) loads directly, with no referrer, because only editors can set it; an uploaded cover is re-encoded in the browser, and firestore.rules accept only WebP, JPEG or PNG data of limited size. Avatars load only from `avatars.githubusercontent.com`.
- **Content Security Policy:** the production build adds a CSP `<meta>` tag (GitHub Pages cannot send headers), built from `public/config.js` in [`vite.config.ts`](vite.config.ts).
- **Nothing is cached on disk:** boards are cached in memory only (an older on-disk copy is deleted on start), and signing out clears the app's local data (profiles, filters, per-board view settings — only the language and appearance stay) and reloads the page.
- **No framing:** the app refuses to run inside another site's frame, so its buttons cannot be overlaid by a hostile page (GitHub Pages cannot send `frame-ancestors` / `X-Frame-Options`, so this is checked in the app).
- **Exports carry no people:** a board's JSON export has no members, names or GitHub IDs (only assignments to yourself), so it can be shared as a template; CSV cells that a spreadsheet would run as formulas are escaped.

What you should set up in the consoles (one-time):

1. **Restrict the API key.** Google Cloud Console → APIs & Services → Credentials → the "Browser key" of the project:
   - *Application restrictions* → **Websites**: `https://darkv3ctor.github.io/*`, `http://localhost:5173/*`, `http://localhost:4173/*`, and `https://<project-id>.firebaseapp.com/*` (needed by the sign-in popup);
   - *API restrictions* → **Restrict key**: Identity Toolkit API, Token Service API, Cloud Firestore API (and Firebase App Check API if you enable it).
2. **Use a dedicated origin (recommended).** All GitHub Pages sites of one account share the origin `https://<user>.github.io`, so every other Pages site of `darkv3ctor` could read this app's sign-in token from the browser storage, and the authorized domain `darkv3ctor.github.io` covers all of them. If the account has (or will have) other Pages sites, give this one its own domain: add `public/CNAME` with e.g. `kanban.example.com`, point a DNS `CNAME` record to `darkv3ctor.github.io`, set it in the repo's Settings → Pages → Custom domain (with HTTPS), then in Firebase → Authentication → Settings → Authorized domains add the new domain and remove `darkv3ctor.github.io`. Update the API key restriction too.
3. **App Check (optional).** Limits use of the project to your site: create a reCAPTCHA Enterprise key for your domain, register the web app in Firebase → App Check, put the site key into `appCheckSiteKey` in `public/config.js`, deploy, watch the App Check metrics, and only then turn on **Enforce** for Firestore and Authentication. Rebuild after changing the key — the CSP is generated from `config.js`. Local development then needs a debug token (see [Development](#development)).

---

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run i18n:check   # every UI string has a Ukrainian translation
npm test             # unit tests
npm run test:rules   # security rules tests in the Firestore emulator (needs Java 21+)
npm run build        # outputs dist/ (with the CSP meta tag)
npm run preview      # serve dist/ locally to check the production build
```

All of these run in CI before every deploy.

`localhost` is in Firebase's Authorized domains by default, so GitHub sign-in also works locally.

**App Check on localhost.** The reCAPTCHA key works only on the site's domain, so once App Check is enforced a local copy needs a debug token (on `localhost` the app switches to the debug provider by itself):

- In Firebase → App Check → Apps → ⋮ → **Manage debug tokens** → **Add debug token** → **Generate token**, and put it into `.env.local` in the project folder: `VITE_APPCHECK_DEBUG_TOKEN=<token>`. It works in every browser with `npm run dev`. `.env.local` is ignored by git, and the token is never built into the site.
- Or start the app without it: the browser console prints a debug token made for that browser (also with `npm run preview`) — add that one in **Manage debug tokens**.

A debug token lets its holder past App Check: keep it out of the repo and chats, and delete it in the console when it is no longer needed.

### Translations

UI strings are written in English and wrapped in `t('…')`; the English text is the key. Ukrainian translations live in [`src/locales/uk.ts`](src/locales/uk.ts), board template text in `src/locales/templates.<lang>.ts`. `npm run i18n:check` (also run in CI) fails if a string has no translation.

**Stack:** React 19, TypeScript, Vite, Firebase Auth and Firestore, `@hello-pangea/dnd`, `marked` and `DOMPurify`.

**Layout:**

```
public/config.js              runtime settings (Firebase, app admins, App Check)
firestore.rules               server-side access rules and data validation
src/i18n.ts                   translation helpers and language switch
src/locales/                  Ukrainian UI strings and template text (EN / UK)
src/templates.ts              board templates (game dev, home, software, movies & games, blank)
src/store/                    storage: firebaseStore (cloud) and localStore (demo)
src/lib/normalize.ts          coerces data read from the database into valid shapes
src/lib/markdown.ts           safe Markdown rendering
src/components/               UI: board, issue dialog, list, releases, settings, members
scripts/check-i18n.ts         translation coverage check
tests/unit/                   unit tests (node:test)
tests/rules/                  security rules tests (Firestore emulator)
.github/workflows/deploy.yml  tests and automatic deploy to GitHub Pages
```
