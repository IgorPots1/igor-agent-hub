import {
  createBrainItemFromTelegram,
  getBrainItemsForStats,
  getRecentBrainItems,
  getSearchQuery,
  getInboxBrainItems,
  getLatestBrainItem,
  getLatestBrainItems,
  getSavedTelegramText,
  getSummaryPeriod,
  isHelpCommand,
  isInboxCommand,
  isLastCommand,
  isListCommand,
  isSearchCommand,
  isSaveCommand,
  isStatsCommand,
  isSummaryCommand,
  searchBrainItems,
  tryClassifyBrainItem,
} from "@/features/brain/service";
import {
  type BrainItem,
  DEFAULT_BRAIN_ITEM_CATEGORY,
  DEFAULT_BRAIN_ITEM_TYPE,
} from "@/features/brain/types";
import { sendTelegramMessage } from "@/features/telegram/telegram-client";
import { parseTelegramUpdate } from "@/features/telegram/parser";
import type { TelegramUpdate } from "@/features/telegram/types";

const jsonHeaders = {
  "Content-Type": "application/json",
};
const TELEGRAM_ITEM_TEXT_LIMIT = 90;
const SUMMARY_ITEM_LIMIT = 50;
const SUMMARY_BULLET_LIMIT = 5;
const STATS_ITEM_LIMIT = 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: jsonHeaders,
  });
}

export async function GET() {
  return okResponse();
}

function formatBrainItemsList(
  items: { rawText: string; category: string; type: string }[]
): string {
  const lines = items.map((item, index) => {
    const compactText = item.rawText.replace(/\s+/g, " ").trim();
    const category = item.category || DEFAULT_BRAIN_ITEM_CATEGORY;
    const type = item.type || DEFAULT_BRAIN_ITEM_TYPE;

    return `${index + 1}. [${category}/${type}] ${compactText}`;
  });

  return ["🧠 Последние записи:", ...lines].join("\n");
}

function formatHelpMessage(): string {
  return [
    "🧠 Второй мозг",
    "",
    "/save текст — сохранить запись",
    "/list — последние записи",
    "/inbox — неразобранное",
    "/last — последняя запись подробно",
    "/search запрос — поиск",
    "/summary today — итоги за сегодня",
    "/summary week — итоги за неделю",
    "/stats — статистика мозга",
  ].join("\n");
}

function truncateTelegramItemText(text: string, maxLength: number): string {
  const symbols = Array.from(text);

  if (symbols.length <= maxLength) {
    return text;
  }

  return `${symbols.slice(0, maxLength - 1).join("").trimEnd()}…`;
}

function formatInboxItemsList(items: { rawText: string; type: string }[]): string {
  const lines = items.map((item, index) => {
    const compactText = truncateTelegramItemText(
      item.rawText.replace(/\s+/g, " ").trim(),
      TELEGRAM_ITEM_TEXT_LIMIT
    );
    const type = item.type || DEFAULT_BRAIN_ITEM_TYPE;

    return `${index + 1}. [${type}] ${compactText}`;
  });

  return ["📥 Inbox:", ...lines].join("\n");
}

function formatSearchResults(
  query: string,
  items: { rawText: string; category: string; type: string }[]
): string {
  const lines = items.map((item, index) => {
    const compactText = truncateTelegramItemText(
      item.rawText.replace(/\s+/g, " ").trim(),
      TELEGRAM_ITEM_TEXT_LIMIT
    );
    const category = item.category || DEFAULT_BRAIN_ITEM_CATEGORY;
    const type = item.type || DEFAULT_BRAIN_ITEM_TYPE;

    return `${index + 1}. [${category}/${type}] ${compactText}`;
  });

  return [`🔎 Результаты поиска: ${query}`, "", ...lines].join("\n");
}

function formatBrainItemValue(value: string | null | undefined, fallback: string): string {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : fallback;
}

function formatBrainItemTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) {
    return "—";
  }

  const normalizedTags = tags.map((tag) => tag.trim()).filter(Boolean);
  return normalizedTags.length > 0 ? normalizedTags.join(", ") : "—";
}

function formatBrainItemSummary(summary: string | null | undefined): string {
  const normalizedSummary = summary?.trim();
  return normalizedSummary ? normalizedSummary : "—";
}

function formatLatestBrainItem(item: BrainItem): string {
  return [
    "🧠 Последняя запись",
    "",
    "Текст:",
    formatBrainItemValue(item.rawText, "—"),
    "",
    `Категория: ${formatBrainItemValue(item.category, DEFAULT_BRAIN_ITEM_CATEGORY)}`,
    `Тип: ${formatBrainItemValue(item.type, DEFAULT_BRAIN_ITEM_TYPE)}`,
    `Теги: ${formatBrainItemTags(item.tags)}`,
    "Summary:",
    formatBrainItemSummary(item.summary),
  ].join("\n");
}

function getSummaryText(item: BrainItem): string {
  return item.summary?.trim() || item.rawText.replace(/\s+/g, " ").trim();
}

function isDecisionItem(item: BrainItem): boolean {
  return item.type === "decision";
}

function isIdeaItem(item: BrainItem): boolean {
  return item.type === "idea" || item.type === "insight" || item.type === "product_note";
}

function isTaskOrReminderItem(item: BrainItem): boolean {
  return item.type === "task" || item.type === "reminder";
}

function isContentItem(item: BrainItem): boolean {
  return item.type === "content_idea" || item.category === "Контент";
}

function formatSummaryGroup(title: string, items: BrainItem[]): string[] {
  const lines = [`${title}:`];

  if (items.length === 0) {
    return [...lines, "- нет"];
  }

  return [
    ...lines,
    ...items
      .slice(0, SUMMARY_BULLET_LIMIT)
      .map((item) => `- ${truncateTelegramItemText(getSummaryText(item), TELEGRAM_ITEM_TEXT_LIMIT)}`),
  ];
}

function formatBrainSummary(period: "today" | "week", items: BrainItem[]): string {
  const decisions = items.filter(isDecisionItem);
  const ideas = items.filter(isIdeaItem);
  const tasksAndReminders = items.filter(isTaskOrReminderItem);
  const content = items.filter(isContentItem);
  const groupedItemIds = new Set(
    [...decisions, ...ideas, ...tasksAndReminders, ...content].map((item) => item.id)
  );
  const other = items.filter((item) => !groupedItemIds.has(item.id));
  const periodLabel = period === "today" ? "сегодня" : "неделю";

  return [
    `🧠 Summary за ${periodLabel}`,
    "",
    `Записей: ${items.length}`,
    "",
    ...formatSummaryGroup("Решения", decisions),
    "",
    ...formatSummaryGroup("Идеи", ideas),
    "",
    ...formatSummaryGroup("Задачи/напоминания", tasksAndReminders),
    "",
    ...formatSummaryGroup("Контент", content),
    "",
    ...formatSummaryGroup("Прочее", other),
  ].join("\n");
}

function incrementCount(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function formatTopCounts(counts: Map<string, number>): string[] {
  const sortedCounts = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ru"))
    .slice(0, 8);

  if (sortedCounts.length === 0) {
    return ["- нет"];
  }

  return sortedCounts.map(([name, count]) => `- ${name}: ${count}`);
}

function formatBrainStats(items: BrainItem[]): string {
  const now = Date.now();
  const categoryCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  let lastDayCount = 0;
  let lastWeekCount = 0;

  for (const item of items) {
    const createdAt = new Date(item.createdAt).getTime();
    const age = now - createdAt;

    if (Number.isFinite(createdAt) && age <= ONE_DAY_MS) {
      lastDayCount += 1;
    }

    if (Number.isFinite(createdAt) && age <= 7 * ONE_DAY_MS) {
      lastWeekCount += 1;
    }

    incrementCount(categoryCounts, item.category || DEFAULT_BRAIN_ITEM_CATEGORY);
    incrementCount(typeCounts, item.type || DEFAULT_BRAIN_ITEM_TYPE);
  }

  return [
    "📊 Статистика второго мозга",
    "",
    `Всего активных записей: ${items.length}`,
    `Inbox: ${categoryCounts.get(DEFAULT_BRAIN_ITEM_CATEGORY) ?? 0}`,
    `За 24 часа: ${lastDayCount}`,
    `За 7 дней: ${lastWeekCount}`,
    "",
    "Категории:",
    ...formatTopCounts(categoryCounts),
    "",
    "Типы:",
    ...formatTopCounts(typeCounts),
  ].join("\n");
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
    console.info("Telegram update ignored: no text message");
    return okResponse();
  }

  const isSave = isSaveCommand(parsedMessage.text);
  const isList = isListCommand(parsedMessage.text);
  const isInbox = isInboxCommand(parsedMessage.text);
  const isLast = isLastCommand(parsedMessage.text);
  const isSearch = isSearchCommand(parsedMessage.text);
  const isHelp = isHelpCommand(parsedMessage.text);
  const isSummary = isSummaryCommand(parsedMessage.text);
  const isStats = isStatsCommand(parsedMessage.text);

  if (!isSave && !isList && !isInbox && !isLast && !isSearch && !isHelp && !isSummary && !isStats) {
    console.info("Telegram message ignored: unsupported command", {
      chatId: parsedMessage.chatId,
      messageId: parsedMessage.messageId,
    });
    return okResponse();
  }

  if (isSave) {
    const rawText = getSavedTelegramText(parsedMessage.text);

    if (!rawText) {
      await sendTelegramMessage(parsedMessage.chatId, "Напиши так: /save идея или мысль");
      return okResponse();
    }

    try {
      const brainItem = await createBrainItemFromTelegram(parsedMessage);
      const chatId = parsedMessage.chatId;

      await sendTelegramMessage(chatId, "✅ Сохранил во второй мозг");
      await tryClassifyBrainItem(brainItem);

      console.info("Telegram brain item saved", {
        chatId,
        messageId: parsedMessage.messageId,
        brainItemId: brainItem.id,
      });
    } catch (error) {
      console.error("Telegram /save failed", {
        chatId: parsedMessage.chatId,
        messageId: parsedMessage.messageId,
        error,
      });

      await sendTelegramMessage(
        parsedMessage.chatId,
        "Не смог сохранить. Попробуй ещё раз."
      );
    }

    return okResponse();
  }

  if (isHelp) {
    await sendTelegramMessage(parsedMessage.chatId, formatHelpMessage());
    return okResponse();
  }

  if (isInbox) {
    try {
      const items = await getInboxBrainItems(10);

      if (items.length === 0) {
        await sendTelegramMessage(
          parsedMessage.chatId,
          "📥 Inbox пуст. Новые неразобранные записи появятся здесь."
        );
        return okResponse();
      }

      await sendTelegramMessage(parsedMessage.chatId, formatInboxItemsList(items));
    } catch (error) {
      console.error("Telegram /inbox failed", {
        chatId: parsedMessage.chatId,
        messageId: parsedMessage.messageId,
        error,
      });

      await sendTelegramMessage(
        parsedMessage.chatId,
        "Не смог загрузить Inbox. Попробуй позже."
      );
    }

    return okResponse();
  }

  if (isSummary) {
    const period = getSummaryPeriod(parsedMessage.text);

    if (!period) {
      await sendTelegramMessage(
        parsedMessage.chatId,
        "Напиши так: /summary today или /summary week"
      );
      return okResponse();
    }

    try {
      const items = await getRecentBrainItems(period, SUMMARY_ITEM_LIMIT);

      if (items.length === 0) {
        await sendTelegramMessage(
          parsedMessage.chatId,
          period === "today" ? "За сегодня новых записей нет." : "За неделю новых записей нет."
        );
        return okResponse();
      }

      await sendTelegramMessage(parsedMessage.chatId, formatBrainSummary(period, items));
    } catch (error) {
      console.error(`Telegram /summary ${period} failed`, {
        chatId: parsedMessage.chatId,
        messageId: parsedMessage.messageId,
        error,
      });

      await sendTelegramMessage(
        parsedMessage.chatId,
        period === "today"
          ? "Не смог собрать summary за сегодня. Попробуй позже."
          : "Не смог собрать summary за неделю. Попробуй позже."
      );
    }

    return okResponse();
  }

  if (isStats) {
    try {
      const items = await getBrainItemsForStats(STATS_ITEM_LIMIT);

      await sendTelegramMessage(parsedMessage.chatId, formatBrainStats(items));
    } catch (error) {
      console.error("Telegram /stats failed", {
        chatId: parsedMessage.chatId,
        messageId: parsedMessage.messageId,
        error,
      });

      await sendTelegramMessage(
        parsedMessage.chatId,
        "Не смог загрузить статистику. Попробуй позже."
      );
    }

    return okResponse();
  }

  if (isLast) {
    try {
      const item = await getLatestBrainItem();

      if (!item) {
        await sendTelegramMessage(
          parsedMessage.chatId,
          "Во втором мозге пока нет записей. Добавь первую через /save"
        );
        return okResponse();
      }

      await sendTelegramMessage(parsedMessage.chatId, formatLatestBrainItem(item));
    } catch (error) {
      console.error("Telegram /last failed", {
        chatId: parsedMessage.chatId,
        messageId: parsedMessage.messageId,
        error,
      });

      await sendTelegramMessage(
        parsedMessage.chatId,
        "Не смог загрузить последнюю запись. Попробуй позже."
      );
    }

    return okResponse();
  }

  if (isSearch) {
    const query = getSearchQuery(parsedMessage.text);

    if (!query) {
      await sendTelegramMessage(parsedMessage.chatId, "Напиши так: /search что искать");
      return okResponse();
    }

    try {
      const items = await searchBrainItems(query, 10);

      if (items.length === 0) {
        await sendTelegramMessage(
          parsedMessage.chatId,
          "Ничего не нашёл. Попробуй другой запрос."
        );
        return okResponse();
      }

      await sendTelegramMessage(parsedMessage.chatId, formatSearchResults(query, items));
    } catch (error) {
      console.error("Telegram /search failed", {
        chatId: parsedMessage.chatId,
        messageId: parsedMessage.messageId,
        query,
        error,
      });

      await sendTelegramMessage(
        parsedMessage.chatId,
        "Не смог выполнить поиск. Попробуй позже."
      );
    }

    return okResponse();
  }

  try {
    const items = await getLatestBrainItems(5);

    if (items.length === 0) {
      await sendTelegramMessage(
        parsedMessage.chatId,
        "Пока во втором мозге пусто. Добавь первую запись через /save"
      );
      return okResponse();
    }

    await sendTelegramMessage(parsedMessage.chatId, formatBrainItemsList(items));
  } catch (error) {
    console.error("Telegram /list failed", {
      chatId: parsedMessage.chatId,
      messageId: parsedMessage.messageId,
      error,
    });

    await sendTelegramMessage(
      parsedMessage.chatId,
      "Не смог загрузить список. Попробуй позже."
    );
  }

  return okResponse();
}
