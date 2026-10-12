# Multiplication Cats — how it works

A kid solves "6 × 8 = ?" cards in the web app. A finished session gives a cat sticker and minutes of screen time, and a Telegram bot tells the parents how much to add. The parent sees everything in the admin page and can add or take away time.

This repository is the website and its API only. The original app by Alex Pisarevsky also has an iOS client that enforces the screen time on the phone; it is not included here, so screen time is handed out by the parents by hand (that is what the Telegram bot is for). The phone API is kept, so a phone client can be added later.

## What it consists of (all in this repository)

| Part | Where | What it does |
|---|---|---|
| Web app | `src/app` | Study (cards, sessions), the kid's progress, the parent admin page `/admin` |
| Study logic | `src/lib/study.ts`, `src/lib/srs.ts`, `src/lib/hints.ts` | Card selection, spaced repetition, hints, rules for counting a session |
| Screen-time logic | `src/lib/screen.ts` | App groups, daily budget, session rewards, "more time" requests, device pairing |
| HTTP API | `src/app/api/**/route.ts` | For the web (`/api/study/*`) and for the phone (`/api/screen/*`) |
| Database | `src/db/migrations/*.sql` | Postgres (Neon). Applied in order: `npm run db:migrate` |
| Telegram bot | `src/app/api/telegram/webhook/route.ts`, `src/lib/telegram.ts` | Session notifications and "more time" requests in the parents' group |
| Utilities | `scripts/` | `migrate.ts`, `screen.sh` (screen-time control from the terminal) |

Stack: Next.js 16 (App Router, standalone), React 19, Tailwind 4, Neon Postgres via `@neondatabase/serverless`, no ORM.
Authentication via Neon Auth (managed Better Auth).

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

## API for a phone client (optional)

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

## Building a phone client

The original iOS client (Swift, Screen Time API) lives in Alex's repository, not here. If you want a phone app that blocks apps until the minutes are earned, the server contract above is all it needs: pair with a 6-digit code, open the study site in a WebView, report usage per bucket, and block apps locally. On Android that means `UsageStatsManager` for accounting and an overlay via `AccessibilityService` or Device Owner mode for blocking.

## Running your own

You need your own database and `.env`; the site address comes from `APP_URL`.

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
- Before a PR: `npx tsc --noEmit`, `npm run build`.
- A new table or column goes into a new file in `src/db/migrations/` with the next number. Do not edit old migrations.
- Any new field in the JSON for the phone must be optional: older builds on phones must survive it.
