import { handleTelegramCommand } from "@/features/telegram/command-handler";
import { parseTelegramUpdate } from "@/features/telegram/parser";
import type { TelegramUpdate } from "@/features/telegram/types";
import { handleTelegramVoiceMessage } from "@/features/telegram/voice";

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

  await handleTelegramCommand(parsedMessage);

  return okResponse();
}
