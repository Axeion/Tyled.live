# Tyled

Portrait digital signage for Masonic lodge entrances. Displayed on a TV near the front door — shows tonight's event, live attendance, upcoming calendar, Facebook photos, and AI-parsed meeting minutes. Members check in by scanning a QR code.

**Live:** `mizpah.tyled.live`

---

## Quick Start

```bash
cp .env.example .env
# Fill in VITE_N8N_BASE_URL with your n8n instance URL
npm install
npm run dev
# Opens at http://localhost:5173
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_N8N_BASE_URL` | `https://n8n.stationmind.cloud` | n8n base URL (no trailing slash) |
| `VITE_SLIDE_DURATION_MS` | `9000` | Time per slide in milliseconds |
| `VITE_WELCOME_DURATION_MS` | `7000` | Welcome slide duration in milliseconds |
| `VITE_CHECKIN_URL` | `https://mizpah.tyled.live/checkin` | URL the QR code points to |

## Five Slides

| Slide | Cycle | Source |
|---|---|---|
| Home | Default | Google Calendar + live check-ins |
| Upcoming Events | 9s | Google Calendar (next 60 days) |
| From the Lodge | 9s | Facebook Graph API |
| Tonight's Attendees | 9s | Neon DB (tyled_checkins) |
| Meeting Minutes | 9s | Neon DB (Claude-parsed PDFs) |

A **Welcome slide** interrupts rotation for 7 seconds when a new member checks in.

## n8n Webhook Endpoints

```
GET  /webhook/tyled/tonight    → tonight's event (polled every 30s)
GET  /webhook/tyled/attendees  → check-ins for today (polled every 8s)
GET  /webhook/tyled/events     → upcoming 60 days (polled every 5 min)
GET  /webhook/tyled/photos     → last 2 Facebook posts (polled every 5 min)
GET  /webhook/tyled/minutes    → latest parsed minutes (polled every 60s)
POST /webhook/tyled/checkin    → member check-in from QR PWA
```

## Database

Run `n8n/schema.sql` once against your Neon instance:

```bash
psql $DATABASE_URL < n8n/schema.sql
```

Creates: `tyled_minutes`, `tyled_checkins`, `tyled_photos`, `lodge_members`

## n8n Workflows

Import the 5 JSON files from `n8n/workflows/` into your n8n instance. Map credentials in the n8n UI after import.

| File | Trigger |
|---|---|
| `minutes-processor.json` | Discord #lodge-minutes PDF → Claude → DB |
| `facebook-poller.json` | Schedule 15 min → Facebook Graph → DB |
| `checkin-handler.json` | POST /webhook/tyled/checkin → DB → Discord |
| `tonight-and-events.json` | GET webhooks → Google Calendar |
| `calendar-digest.json` | Sunday + daily schedules → Discord |

## Deploy (Caddy + kiosk)

```
# /etc/caddy/Caddyfile
mizpah.tyled.live {
    root * /var/www/tyled/dist

    # Check-in PWA served as its own page — no SPA fallback for this path
    handle /checkin {
        rewrite * /checkin.html
        file_server
    }

    # Display app — SPA fallback for all other routes
    handle {
        file_server
        try_files {path} /index.html
    }
}
```

```bash
npm run build
# Builds both index.html (display app) and checkin.html (check-in PWA)
# Copy dist/ to /var/www/tyled/dist on your VPS

# TV kiosk mode
chromium-browser --kiosk https://mizpah.tyled.live
```

## Tech Stack

- **Display:** Vite + React, portrait 9:16, inline styles
- **Orchestration:** n8n (self-hosted)
- **Database:** Neon PostgreSQL
- **AI (minutes):** Claude API (`claude-sonnet-4-6`)
- **Calendar:** Google Calendar API via n8n
- **Social:** Facebook Graph API via n8n
- **Notifications:** Discord bot via n8n
- **Hosting:** Caddy on Hostinger VPS
