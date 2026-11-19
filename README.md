# Kanban — a Jira-style task board

A static web app for GitHub Pages: Kanban boards with Jira-like issues, GitHub sign-in and per-member access rights. The interface is available in **English** and **Ukrainian** (switch in the top bar).

**Live site:** https://darkv3ctor.github.io/app-kanban/

## Features

- **Jira-like issues:** key (`GAME-12`), type, status, priority, assignee, reporter, labels, components, fix version, epic, story points, time estimate, due date.
- **Markdown descriptions:** headings, lists, tables, code, links and clickable `- [ ]` checkboxes.
- **Checklist** (sub-tasks) with progress shown on the card.
- **Issue links:** blocks / is blocked by / relates to / duplicates.
- **Comments** (Markdown, edit, delete) and a **change history** of every field.
- **Board:** drag & drop (mouse, touch, keyboard), WIP limits, quick create inside a column, swimlanes by assignee, epic or priority.
- **Filters:** text search, assignees, type, priority, labels, components, version, epic, "My issues", "Updated this week".
- **Issue list** with sorting and CSV export (opens in Excel).
- **Releases:** versions and milestones with dates, progress, release and archive.
- **Board settings:** columns and their categories, issue types (icon, color, description template, default checklist), labels, components.
- **Members and permissions:** add people by GitHub username and pick one of 5 roles.
- Board export/import as JSON, light and dark themes, mobile layout.
- Keyboard shortcuts: `C` creates an issue, `/` focuses search.

## Templates

| Template | Columns | Issue types |
|---|---|---|
| 🎮 **Game development** | Backlog → To do → In progress → Review → QA / Playtest → Done | Epic, Feature, Bug, Task, Art, Audio, Level design, Game design, Tech debt |
| 🏠 **Home & life** | Ideas → Planned → This week → In progress → Waiting → Done | Goal, Chore, Shopping, Repair, Finance, Health, Event, Learning / hobby |
| 💻 **Software development** | To do → In progress → In review → Done | Epic, Story, Task, Bug |
| 📋 **Blank board** | To do → In progress → Done | Epic, Task, Bug |

The game dev template comes with components (Gameplay, Graphics, Audio, UI/UX, AI, Networking…), milestones (Prototype → Vertical Slice → Alpha → Beta → Release 1.0) and description templates: steps to reproduce and environment for bugs, a definition of done for features, asset requirements for art and audio. The home template has rooms and areas of life, monthly versions and templates for repairs, payments, doctor visits and events. Everything can be changed in the board settings.

A board's template text (column names, types, sample issues) is created in the interface language that is active when you create the board.

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

Permissions are enforced on the server by [`firestore.rules`](firestore.rules), not only in the UI. They are tied to the numeric GitHub ID rather than the username, so renaming a GitHub account does not break access.

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
  appAdmins: ["78609208"]
};
```

Commit and push to `main` — GitHub Actions builds and publishes the site. The `firebaseConfig` values are public identifiers, not secrets; data access is protected by the Firestore rules.

### Adding another app admin

Find the numeric GitHub ID (`https://api.github.com/users/<username>`, field `id`) and add it in two places:

- `appAdmins` in `public/config.js`;
- the list in `isAppAdmin()` in `firestore.rules` (then publish the rules again).

Regular board members don't need this — a board owner or admin adds them on the board's Members page.

---

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run i18n:check   # every UI string has a Ukrainian translation
npm run build        # outputs dist/
```

`localhost` is in Firebase's Authorized domains by default, so GitHub sign-in also works locally.

### Translations

UI strings are written in English and wrapped in `t('…')`; the English text is the key. Ukrainian translations live in [`src/locales/uk.ts`](src/locales/uk.ts), board template text in `src/locales/templates.<lang>.ts`. `npm run i18n:check` (also run in CI) fails if a string has no translation.

**Stack:** React 19, TypeScript, Vite, Firebase Auth and Firestore, `@hello-pangea/dnd`, `marked` and `DOMPurify`.

**Layout:**

```
public/config.js              runtime settings (Firebase, app admins)
firestore.rules               server-side access rules
src/i18n.ts                   translation helpers and language switch
src/locales/                  Ukrainian UI strings and template text (EN / UK)
src/templates.ts              board templates (game dev, home, software, blank)
src/store/                    storage: firebaseStore (cloud) and localStore (demo)
src/components/               UI: board, issue dialog, list, releases, settings, members
scripts/check-i18n.ts         translation coverage check
.github/workflows/deploy.yml  automatic deploy to GitHub Pages
```
