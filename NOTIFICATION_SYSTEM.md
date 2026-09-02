# CodingKida — Notification System Documentation

Production-grade, multi-platform notification system for CodingKida (Backend + Desktop + Mobile).

---

## 1. Architecture Overview

```
Business Events (payment, quiz, streak, leaderboard, course)
        │
        ▼
Notification Service (app/lib/notification.ts)
   • Idempotent creation (DB unique constraint)
   • Outbox pattern (reliable delivery)
        │
        ▼
PostgreSQL (Source of Truth)
   • Notification, NotificationOutbox, UserDevice tables
        │
        ├──────────────────────────┬──────────────────────┐
        ▼                          ▼                      ▼
  In-App Sync API          Outbox Processor         Device Registry
  POST /api/notifications   /api/cron/process-...    POST /api/devices/register
        │                          │
        ▼                          ▼
  Desktop + Mobile          Expo Push (mobile)
  (cursor sync)             Desktop (sync-based)
```

**Core principle:** DB is source of truth. Push = alert only. If push fails/missed, user sees notification on next app open via sync.

---

## 2. Files Created

### Backend (codingkeda)
| File | Purpose |
|------|---------|
| `app/lib/notification-types.ts` | Type registry (types, categories, priorities) |
| `app/lib/notification.ts` | Notification service (CRUD + event helpers) |
| `app/lib/push-adapters.ts` | Provider adapters (Expo Push, Desktop) |
| `app/api/notifications/route.ts` | Single client endpoint (action-based) |
| `app/api/devices/register/route.ts` | Device registration (POST/DELETE) |
| `app/api/cron/process-notifications/route.ts` | Outbox processor (GET/POST) |
| `vercel.json` | Vercel cron config (every 1 min) |

### Desktop (codingkidadesktop)
| File | Purpose |
|------|---------|
| `src/renderer/services/notifications.js` | API-backed notification service + UI |

### Mobile (CodingKidaApps)
| File | Purpose |
|------|---------|
| `src/services/notification.service.ts` | Push registration + sync + CRUD |
| `app/notifications.tsx` | Notification list screen |

---

## 3. Files Modified

### Backend
- `prisma/schema.prisma` — Added Notification, NotificationOutbox, UserDevice models
- `app/api/payment/webhook/route.ts` — notifyCourseEnrolled + notifyPaymentFailed
- `app/services/quiz-leaderboard.service.ts` — notifyAchievement
- `app/api/coding-problems/leaderboard/route.ts` — notifyLeaderboardWinner
- `app/api/weekly-streak/route.ts` — notifyWeeklyStreak
- `.env.example` — Added CRON_SECRET

### Desktop
- `main.js` — update-available/downloaded IPC + quit-and-install handler
- `preload.js` — exposed quitAndInstallUpdate
- `src/renderer/index.html` — notification bell + panel + script tag
- `src/renderer/app/init.js` — notifSync on focus + IPC listeners + notifInit
- `src/renderer/app/auth.js` — notifSync on dashboard refresh

### Mobile
- `app.json` — expo-notifications plugin
- `package.json` — expo-notifications + expo-device
- `app/_layout.tsx` — push registration + tap listener + route
- `app/(tabs)/dashboard.tsx` — notification bell + unread badge
- `src/hooks/useAuth.ts` — deregisterDevice + clearNotifState on logout

---

## 4. Database Schema

**Notification** — user notifications (source of truth)
- Unique constraint `[userId, idempotencyKey]` prevents duplicates

**NotificationOutbox** — delivery queue for push
- Status: pending → processing → delivered/failed/dead
- Retry with exponential backoff

**UserDevice** — registered devices per user
- Unique `[userId, deviceId]`, multi-device support

---

## 5. Notification Types

| Type | Category | Trigger |
|------|----------|---------|
| `course_enrolled` | payment | Payment webhook success |
| `payment_failed` | payment | Payment webhook failure |
| `achievement` | achievement | Quiz rank badge earned |
| `weekly_streak` | achievement | Streak challenge passed |
| `leaderboard_winner` | achievement | Coding problem rank ≤ 50 |
| `new_course` | announcement | Admin publishes course (helper ready) |
| `app_update` | system | Desktop-only (electron-updater) |
| `custom` | announcement | Admin custom (helper ready) |

---

## 6. API Reference

### `POST /api/notifications` (auth required)
```
{ "action": "sync", "after": "<ISO>", "limit": 30 }   → { items, nextCursor, unreadCount }
{ "action": "unread-count" }                           → { unreadCount }
{ "action": "mark-read", "id": "..." }                 → { success }
{ "action": "mark-all-read" }                          → { success, count }
{ "action": "delete", "id": "..." }                    → { success }
{ "action": "clear-all" }                              → { success, count }
```

### `POST /api/devices/register` (auth required)
```
{ "platform": "android|ios|desktop", "pushToken": "...", "deviceId": "..." }
```

### `DELETE /api/devices/register` (auth required)
```
{ "deviceId": "..." }
```

### `GET|POST /api/cron/process-notifications` (CRON_SECRET required)
Processes pending outbox entries, delivers push.

---

## 7. Environment Variables

```
CRON_SECRET=<random-string>   # e.g. openssl rand -hex 32
```

---

## 8. Deployment Setup

**Note:** Vercel Hobby (free) plan only allows daily cron jobs. Since notifications need
frequent delivery, we use an **external cron service** instead of Vercel Cron.

### Step 1: Add CRON_SECRET
Add `CRON_SECRET` env var in Vercel dashboard (Settings → Environment Variables).
Generate: `openssl rand -hex 32`

### Step 2: Set up external cron (cron-job.org — free)
1. Sign up at https://cron-job.org (free)
2. Create a new cron job:
   - **URL:** `https://www.codingkida.com/api/cron/process-notifications`
   - **Schedule:** Every 1 minute
   - **Method:** POST
   - **Header:** `x-cron-secret: YOUR_CRON_SECRET`
3. Save — notifications will now be delivered every minute

### EC2 (alternative)
Run a cron/node-cron job:
```bash
* * * * * curl -X POST https://www.codingkida.com/api/cron/process-notifications -H "x-cron-secret: YOUR_SECRET"
```

### Vercel Pro (alternative — if upgraded)
If you upgrade to Vercel Pro, you can use `vercel.json` cron instead:
```json
{ "crons": [{ "path": "/api/cron/process-notifications", "schedule": "* * * * *" }] }
```
(Vercel auto-sends `Authorization: Bearer $CRON_SECRET`)

---

## 9. Mobile Setup (Expo)

Install packages (run manually):
```bash
cd CodingKidaApps
npx expo install expo-notifications expo-device
```

Then rebuild the dev client:
```bash
eas build --profile development --platform android
```

**Note:** Push tokens require a real device (not simulator) and EAS project ID.

---

## 10. Duplicate Prevention (Idempotency Keys)

| Event | Key |
|-------|-----|
| Course enrolled | `course_enrolled:<userId>:<courseId>` |
| Payment failed | `payment_failed:<orderId>` |
| Achievement | `achievement:<userId>:<lessonId>:<badgeType>` |
| Weekly streak | `streak_pass:<userId>:<streakId>` |
| Leaderboard | `leaderboard:<problemId>:<userId>` |
| App update | `app_update_<version>` (desktop-local) |

DB unique constraint `[userId, idempotencyKey]` = same event never creates duplicate, even on webhook retries.

---

## 11. How to Add a New Notification Type (Future)

1. Add constant in `app/lib/notification-types.ts` → `NOTIF_TYPES`
2. Add helper in `app/lib/notification.ts` (e.g. `notifyContestReminder()`)
3. Call the helper from the relevant business event
4. Add icon in desktop `notifications.js` `_notifGetIcon()` + mobile `notifications.tsx` `getIcon()`
5. Add route mapping in `resolveNotifRoute()` (mobile) if new deep-link needed

**Core system needs zero changes** — fully extensible.

---

## 12. Known Limitations

- Desktop can't receive push when app is fully closed → syncs on next open (all missed notifications appear)
- Vercel cron minimum interval = 1 min → push may take up to 1 min
- Mobile push requires real device + EAS project ID (not simulator)
- App update notifications are desktop-only (mobile updates via store)

---

## 13. Security

- All notification queries scoped to authenticated `userId`
- Device registration requires valid JWT (can't register under another user)
- Push payload contains only `{ notificationId, type }` — full data fetched via authenticated API
- No provider credentials on client (Expo Push is open/free, no secret)
- Cron endpoint protected by `CRON_SECRET`

---

## 14. Cost

**₹0 additional** — Uses existing Neon PostgreSQL, free Expo Push, Vercel cron (included). No Redis, no Firebase, no FCM config.
