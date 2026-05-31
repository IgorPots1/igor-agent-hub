import { normalizeForMatching } from "./natural-router.ts";

export type TelegramMenuRoute =
  | { kind: "command"; messageText: string }
  | { kind: "message"; text: string }
  | { kind: "ignore" };

export type TelegramReplyKeyboardMarkup = {
  keyboard: string[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  is_persistent?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
};

const START_COMMAND_PATTERN = /^\/start(?:@\w+)?(?:\s+|$)/;

export const TELEGRAM_MAIN_MENU_REPLY_KEYBOARD: TelegramReplyKeyboardMarkup = {
  keyboard: [
    ["Меню", "Как сохранить", "Как напомнить"],
    ["Инбокс", "Поиск", "Итоги"],
    ["Напоминания", "Последнее", "Статистика"],
  ],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: "Напиши заметку или выбери действие",
};

export function isTelegramStartCommand(text: string): boolean {
  return START_COMMAND_PATTERN.test(text);
}

export function getTelegramMainMenuMessage(): string {
  return [
    "🧠 Второй мозг",
    "",
    "Используй кнопки снизу для основных действий.",
    "Команды тоже работают: /save, /remind, /list, /inbox, /search, /summary today, /summary week, /reminders, /last, /stats.",
  ].join("\n");
}

function getSaveInstructionsMessage(): string {
  return [
    "Отправь текст обычным сообщением — я сохраню его в Second Brain.",
    "Или используй /save текст.",
  ].join("\n");
}

function getRemindInstructionsMessage(): string {
  return [
    "/remind завтра в 10:00 написать ученику",
    "/remind через 30 минут проверить отчет",
  ].join("\n");
}

export function routeTelegramMenuText(text: string): TelegramMenuRoute {
  const normalizedText = normalizeForMatching(text);

  switch (normalizedText) {
    case "меню":
      return {
        kind: "message",
        text: getTelegramMainMenuMessage(),
      };
    case "сохранить":
    case "как сохранить":
      return {
        kind: "message",
        text: getSaveInstructionsMessage(),
      };
    case "напомнить":
    case "как напомнить":
      return {
        kind: "message",
        text: getRemindInstructionsMessage(),
      };
    case "инбокс":
      return {
        kind: "command",
        messageText: "/inbox",
      };
    case "поиск":
      return {
        kind: "command",
        messageText: "/search",
      };
    case "итоги":
      return {
        kind: "command",
        messageText: "/summary today",
      };
    case "напоминания":
      return {
        kind: "command",
        messageText: "/reminders",
      };
    case "последнее":
      return {
        kind: "command",
        messageText: "/last",
      };
    case "статистика":
      return {
        kind: "command",
        messageText: "/stats",
      };
    default:
      return { kind: "ignore" };
  }
}
