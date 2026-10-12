# StudyApp — times tables + screen time

> This is a working copy for development. The production server and its deployment live in a separate private
> repository, so there is no deploy workflow and no secrets here: feel free to experiment.
> The owner moves changes from here to production by hand.

A kid solves "6 × 8 = ?" cards in the web app. Finished sessions give them minutes of screen time.
The phone app blocks the chosen apps while there are no minutes left and counts how much the kid has actually used.
The parent sees everything in the admin page and can add or take away time.

There is an iOS client today. There is no Android client, and that is a good entry point for a contributor: the server and the protocol are ready, see "How to build an Android client".

## What it consists of (all in this repository)

| Part | Where | What it does |
|---|---|---|
| Web app | `src/app` | Study (cards, sessions), the kid's progress, the parent admin page `/admin` |
| Study logic | `src/lib/study.ts`, `src/lib/srs.ts`, `src/lib/hints.ts` | Card selection, spaced repetition, hints, rules for counting a session |
| Screen-time logic | `src/lib/screen.ts` | App groups, daily budget, session rewards, "more time" requests, device pairing |
| HTTP API | `src/app/api/**/route.ts` | For the web (`/api/study/*`) and for the phone (`/api/screen/*`) |
| Database | `src/db/migrations/*.sql` | Postgres (Neon). Applied in order: `npm run db:migrate` |
| iOS client | `ios/` | SwiftUI + Screen Time API. Details in `ios/README.md` |
| Deployment | `deploy/` | Example server configs (systemd, nginx). No auto-deploy in this copy |
| Utilities | `scripts/` | `migrate.ts`, `screen.sh` (screen-time control from the terminal) |

Stack: Next.js 16 (App Router, standalone), React 19, Tailwind 4, Neon Postgres via `@neondatabase/serverless`, no ORM.
Authentication via Neon Auth (managed Better Auth). Swift 5, iOS 17.4+, XcodeGen.

## How it works

### Study

- Cards: every pair 2…9 × 2…9, one per unordered pair (3×7 = 7×3, shown in random order). Table `cards`, column `kind`: `mul`, plus `missing` ("… × 6 = 36", switched on per kid in `user_settings`). The `active` flag turns a card off completely.
- Repetition: stages 1…7 with intervals of 1/2/4/8/16/30/60 days (`src/lib/srs.ts`). A mistake drops the card one stage and brings it back after 90 seconds. Stage 4 and above means "learned".
- Session: 10 cards. It counts only with at least 4 correct answers and fewer than 7 "I don't remember" (`MIN_CORRECT`, `MAX_DONT_KNOW`). The kid is not shown the threshold.
- "I don't remember" works in two steps: first a hint on how to work it out, without the answer; then "I still don't remember", and the answer is shown. Both buttons are inactive for 5 seconds.
- Every answer is written to `reviews`, card state lives in `user_cards`, sessions in `sessions`.

### Screen time

Three buckets of apps (the kid does not see how they work inside):

| Group | Key | Budget |
|---|---|---|
| Always allowed (calls, messages, camera, maps, the study app itself) | not blocked | no limit |
| Messengers | `social` | 40 minutes a day, sessions have no effect |
| Everything else (games, video…) | `default` | 0 minutes + session rewards: 30, then 10, then 10 |

Group rules are defined in `GROUPS` (`src/lib/screen.ts`) and in the `screen_policies` table, per kid and per group.

- **Daily budget** = base + session credits + parent grants (`screen_grants`). At midnight Europe/Lisbon everything starts over.
- **The phone counts usage**: how many minutes since midnight the kid spent in the apps of each bucket. The phone sends it to the server (`screen_usage`) and applies the block itself when usage reaches the budget. The server is not needed at the moment of blocking, so network lag cannot be used to "sit out" the limit.
- **"Ask for more"** appears for the kid only when the limit is used up and today's sessions are exhausted. The request goes to the parent in Telegram with "✅ +15 / +30 / ❌" buttons (`screen_requests`).
- **The parent** sees and changes everything in `/admin`, in parent mode on the phone (via the `PARENT_PIN` code) and through `scripts/screen.sh`.

## API for the phone client

Authorization: `Authorization: Bearer <device token>`. The token is issued once, at pairing.

| Method | Path | Body / response |
|---|---|---|
| POST | `/api/screen/pair` | `{code, appVersion}` → `{token, device, user}`. The parent gets the 6-digit code in `/admin` |
| GET | `/api/screen/policy` | → the `default` group's policy at the top level + `groups: {default, social}`, each with `budgetTodayMinutes`, `usedTodayMinutes`, `balanceMinutes`, `nextSessionReward`, `lockedOverride`; plus `parentCode` |
| POST | `/api/screen/usage` | `{bucket: "all" \| "allowed" \| "social", used}` — minutes since midnight (absolute value, the server keeps the maximum) |
| POST | `/api/screen/request` | `{group, minutes}` — ask for more time. `GET` returns the status of the latest request |
| POST | `/api/screen/parent-grant` | `{pin, group, minutes}` — a grant from parent mode |
| POST | `/api/screen/apns` | `{token}` — push token (Apple only for now) |
| POST | `/api/screen/log` | `{source, lines: []}` — device debug log (table `device_log`) |

The server computes the `default` group's usage as `all − allowed − social`. This is done because iOS cannot exclude apps from the counter. On Android it is probably easier to count per app and send the same thing.

## How to build an Android client

The server and the protocol do not need to change; what is needed is a client that fulfils the same contract:

1. Pairing with a 6-digit code (`/api/screen/pair`), the token stored in encrypted storage.
2. A WebView with the study site. When a session is over, the page calls `window.webkit.messageHandlers.studyapp.postMessage({event: "sessionFinished"})`. On Android it is convenient to expose a JS interface with the same object and re-read the policy after this event.
3. Usage accounting per bucket: `UsageStatsManager` / `UsageEvents`. Buckets: everything, always allowed, messengers.
4. Blocking: an overlay screen on top of the blocked app via `AccessibilityService` or Device Owner mode. The choice is up to the author of the Android client, each has its trade-offs.
5. Choosing apps for the buckets happens on the phone in parent mode (via `PARENT_PIN`). As on iOS, these are local device settings and are not sent to the server.
6. Policy refresh: when the app opens, periodically (WorkManager) and on push, if you add it. For FCM the server needs an equivalent of `src/lib/apns.ts`.

To start, you can lean on the iOS code: `ios/Sources/App/AppModel.swift` (policy and limits), `ios/Sources/Shared/SharedStore.swift` (local counters), `ios/Sources/Monitor` (background accounting).

## Running your own

The site and API address are currently hard-coded to `study.alexpihq.com` (for example `ios/Sources/App/API.swift`). For your own instance you need your own domain, database and `.env`.

```bash
npm install
cp .env.example .env.local      # fill it in
npm run db:migrate
npm run dev                     # http://localhost:3000
```

Neon: create a project, enable Neon Auth on the branch, add your domain to the trusted domains.
Registration is currently open: kids can be registered through the site.

## Contributing

- Branches and pull requests as you like. Pushing to this repository deploys nothing.
- Before a PR: `npx tsc --noEmit`, `npm run build`. For iOS: `cd ios && xcodegen generate` and build in Xcode.
- A new table or column goes into a new file in `src/db/migrations/` with the next number. Do not edit old migrations.
- Any new field in the JSON for the phone must be optional: older builds on phones must survive it.
