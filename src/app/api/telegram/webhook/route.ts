import { handleTelegramCommand } from "@/features/telegram/command-handler";
import { routeNaturalTelegramText } from "@/features/telegram/natural-router";
import { parseTelegramUpdate } from "@/features/telegram/parser";
import type { TelegramUpdate } from "@/features/telegram/types";
import { handleTelegramVoiceMessage } from "@/features/telegram/voice";

export const runtime = "nodejs";

const jsonHeaders = {
  "Content-Type": "application/json",
};
function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: jsonHeaders,
  });
}

export async function GET() {
  return okResponse();
}

export async function POST(request: Request) {
  let update: TelegramUpdate | null = null;

  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    console.warn("Telegram webhook received invalid JSON payload");
    return okResponse();
  }

  const parsedMessage = parseTelegramUpdate(update);

  if (!parsedMessage) {
    console.info("Telegram update ignored: no message");
    return okResponse();
  }

  if (parsedMessage.voice) {
    await handleTelegramVoiceMessage(parsedMessage);
    return okResponse();
  }

  if (parsedMessage.text && !parsedMessage.text.startsWith("/")) {
    const naturalRoute = routeNaturalTelegramText(parsedMessage.text);

    if (naturalRoute.kind === "command") {
      await handleTelegramCommand(parsedMessage, {
        messageText: naturalRoute.messageText,
      });
      return okResponse();
    }

    if (naturalRoute.kind === "save") {
      await handleTelegramCommand(parsedMessage, {
        fallbackSave: {
          rawText: naturalRoute.rawText,
          source: "telegram",
          tags: [],
          successMessage: "✅ Сохранил во второй мозг",
        },
      });
      return okResponse();
    }
  }

  await handleTelegramCommand(parsedMessage);

  return okResponse();
}
