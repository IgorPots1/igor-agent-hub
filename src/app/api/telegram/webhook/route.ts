import { NextResponse } from "next/server";
import { routeAgentInput } from "@/features/agents/router-agent";
import { parseTelegramUpdate } from "@/features/telegram/parser";
import type { TelegramUpdate } from "@/features/telegram/types";

function safeSerializeUpdate(update: TelegramUpdate): string {
  try {
    return JSON.stringify(update);
  } catch {
    return "[unserializable telegram update]";
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/telegram/webhook"
  });
}

export async function POST(request: Request) {
  try {
    const update = (await request.json()) as TelegramUpdate;

    console.info("Telegram update received", safeSerializeUpdate(update));

    const parsedUpdate = parseTelegramUpdate(update);
    const messageText = parsedUpdate?.text ?? null;
    const agentType = messageText ? routeAgentInput(messageText) : "unknown";

    console.info("Telegram message text", messageText);
    console.info("Telegram route result", agentType);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error", error);

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
