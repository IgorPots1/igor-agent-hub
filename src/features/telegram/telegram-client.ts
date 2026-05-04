export async function sendTelegramMessage(chatId: string | number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Telegram sendMessage failed", {
        chatId,
        status: response.status,
        error: errorText,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while sending Telegram message";

    console.error("Telegram sendMessage request failed", {
      chatId,
      error: message,
    });
  }
}
