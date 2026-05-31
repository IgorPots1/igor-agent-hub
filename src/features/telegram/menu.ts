import {
  getTelegramMainMenuMessage,
  isTelegramStartCommand,
  routeTelegramMenuText,
  TELEGRAM_MAIN_MENU_REPLY_KEYBOARD,
  type TelegramMenuRoute,
} from "@/features/telegram/menu-routes";
import { sendTelegramMessage } from "@/features/telegram/telegram-client";

export type { TelegramMenuRoute };
export {
  getTelegramMainMenuMessage,
  isTelegramStartCommand,
  routeTelegramMenuText,
  TELEGRAM_MAIN_MENU_REPLY_KEYBOARD,
};

export async function sendTelegramMenuMessage(chatId: string | number, text: string): Promise<void> {
  await sendTelegramMessage(chatId, text, {
    replyMarkup: TELEGRAM_MAIN_MENU_REPLY_KEYBOARD,
  });
}
