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
