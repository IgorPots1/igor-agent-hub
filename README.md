# igor-agent-hub

Minimal production-safe foundation for a personal Telegram-controlled AI agent hub.

## Setup

```bash
npm install
npm run dev
```

## Webhook

Webhook endpoint path:

```text
/api/telegram/webhook
```

Example Telegram webhook setup command:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-domain.example/api/telegram/webhook"
```

## Reminders Cron

Vercel Hobby does not support the high-frequency cron schedule this project originally used, so production reminders should be triggered by an external cron service instead of `vercel.json`.

Recommended external cron setup:

- URL: `https://your-domain.example/api/cron/reminders`
- Method: `POST` (the endpoint also accepts `GET` for manual checks)
- Header: `Authorization: Bearer <CRON_SECRET>`
- Interval: every 5 minutes
- Keep real secrets out of the repo and configure `CRON_SECRET` only in your deployment/provider settings

Example request:

```bash
curl -X POST "https://your-domain.example/api/cron/reminders" \
  -H "Authorization: Bearer <CRON_SECRET>"
```
