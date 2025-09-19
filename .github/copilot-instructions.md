# Bok Choy League AI Coding Agent Instructions

## Project Overview
- **Type:** Next.js app (app directory structure) for a fantasy football league, with Firebase backend and custom cloud functions.
- **Main Features:** League management, matchups, polls, win probability tracking, draft visualization, OAuth, and admin tools.
- **Live Site:** https://thebokchoyleague.com

## Architecture & Data Flow
- **Frontend:** Located in `app/` (pages, components, subfolders for features). Uses React, Next.js, Tailwind CSS.
- **Backend:** Firebase Cloud Functions in `functions/src/` (see `index.ts` for exports). Integrates with Yahoo Fantasy API via custom endpoints (e.g., `yahooAPI`).
- **Firestore:** Used for persistent data (teams, standings, polls, ices, etc.). Access via `getFirestore()` in client and server code.
- **Shared Types/Utils:** Many feature folders have local `utils/` for helpers and shared logic.

## Developer Workflows
- **Start Dev Server:**
  ```bash
  npm run dev
  # or: yarn dev, pnpm dev, bun dev
  ```
- **Deploy Cloud Functions:**
  ```bash
  firebase deploy --only functions
  # or: firebase deploy --only functions:FUNCTION_NAME
  ```
- **Build/Static Export:**
  ```bash
  npm run build
  ```
- **Tailwind:** Config in `tailwind.config.js`. All UI uses Tailwind classes.

## Key Patterns & Conventions
- **Pages:** All routes/pages are in `app/` (e.g., `app/matchups/page.tsx`). Use `"use client"` for client components.
- **Components:** Feature components in `app/components/`, often grouped by feature (e.g., `standings/`, `pollCreator/`, `ices/`).
- **Firebase:**
  - Config in `firebase.ts` and `lib/firebaseConfig.ts`.
  - Always use `getApps()`/`initializeApp()` pattern to avoid duplicate initialization.
- **Yahoo API:**
  - Cloud function endpoint: `/api_test` page demonstrates usage.
  - See `functions/src/yahooAPI.ts` for request structure and supported types.
- **Modals/Charts:** Custom modal and chart logic (see `WinProbabilityTracker.tsx`, `DraftVisualizer.tsx`).
- **Admin Tools:** `app/admin/page.tsx` aggregates admin features (polls, ices, win prob charts).
- **Data Fetching:** Use Firestore client (`getFirestore`, `getDocs`, etc.) for all persistent data. Example: `addIces.tsx` for updating entries.
- **Routing:** Use Next.js file-based routing. Navigation via `next/link` or `useRouter`.

## Integration Points
- **Yahoo Fantasy API:** All external league data flows through custom Firebase functions.
- **Google OAuth:** Handled in `app/oauth/callbackpage/`.
- **Google Docs:** League rules embedded via `GoogleDocViewer`.

## Examples
- **Win Probability:** `app/components/WinProbabilityTracker.tsx` (chart, modal, Firestore data).
- **Draft Board:** `app/components/DraftVisualizer.tsx` (SVG, table, custom logic).
- **Polls:** `app/components/Poll.tsx`, `app/polls/page.tsx` (Firestore integration, custom hooks).
- **Admin:** `app/admin/page.tsx` (aggregates feature components).

## Tips for AI Agents
- Always check for feature-specific `utils/` folders for helpers.
- Use Firestore for all persistent state; avoid localStorage/sessionStorage.
- Follow Tailwind and Next.js conventions for UI and routing.
- For new features, mirror the structure of existing feature folders/components.
- Reference `functions/src/index.ts` for available backend endpoints.

---

*Update this file as new conventions or workflows emerge. For questions, review `README.md` and key feature components.*
