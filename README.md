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

Call the existing reminders endpoint with the shared secret:

```bash
curl -X POST "https://your-domain.example/api/cron/reminders" \
  -H "Authorization: Bearer <CRON_SECRET>"
```
