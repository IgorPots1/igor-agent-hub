export type NaturalTelegramRoute =
  | { kind: "command"; messageText: string }
  | { kind: "save"; rawText: string }
  | { kind: "ignore" };

const REMINDER_PATTERNS = [
  /^(?:пожалуйста\s+напомни)(?:,\s*|\s+|$)/iu,
  /^(?:напомни\s+пожалуйста)(?:,\s*|\s+|$)/iu,
  /^(?:напомнить)(?:,\s*|\s+|$)/iu,
  /^(?:напомни)(?:,\s*|\s+|$)/iu,
];

const SAVE_PATTERNS = [
  /^(?:сохрани)(?:\s+|$)/iu,
  /^(?:запиши)(?:\s+|$)/iu,
  /^(?:добавь\s+во\s+второй\s+мозг)(?:\s+|$)/iu,
  /^(?:добавь)(?:\s+|$)/iu,
];

const SEARCH_PATTERNS = [
  /^(?:найди\s+в\s+мозге)(?:\s+|$)/iu,
  /^(?:найди)(?:\s+|$)/iu,
  /^(?:поиск)(?:\s+|$)/iu,
  /^(?:поищи)(?:\s+|$)/iu,
  /^(?:покажи\s+записи\s+про)(?:\s+|$)/iu,
];

const LIST_MATCHES = new Set([
  "покажи последние записи",
  "последние записи",
  "что я сохранял",
]);

const INBOX_MATCHES = new Set(["покажи инбокс", "покажи неразобранное"]);

const LAST_MATCHES = new Set(["покажи последнюю запись", "последняя запись"]);

const REMINDERS_MATCHES = new Set([
  "покажи напоминания",
  "какие есть напоминания",
  "напоминания",
]);

const HELP_MATCHES = new Set(["помощь", "что ты умеешь", "покажи команды"]);

const STATS_MATCHES = new Set(["статистика", "статистика мозга"]);

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeForMatching(value: string): string {
  return normalizeWhitespace(
    value
      .toLocaleLowerCase("ru")
      .replace(/ё/g, "е")
      .replace(/[.,!?;:()[\]"]/g, " ")
  );
}

export function extractCommandPayload(text: string, pattern: RegExp): string | null {
  if (!pattern.test(text)) {
    return null;
  }

  const payload = normalizeWhitespace(text.replace(pattern, ""));
  return payload || null;
}

function toCommandRoute(messageText: string): NaturalTelegramRoute {
  return {
    kind: "command",
    messageText,
  };
}

function matchCommandPayload(
  text: string,
  patterns: RegExp[],
  commandName: "/save" | "/search" | "/remind"
): NaturalTelegramRoute | null {
  for (const pattern of patterns) {
    const payload = extractCommandPayload(text, pattern);

    if (payload) {
      return toCommandRoute(`${commandName} ${payload}`);
    }
  }

  return null;
}

function isSummaryToday(normalizedText: string): boolean {
  return (
    /^(?:summary|итоги|сводка)(?:\s+за)?\s+сегодня$/iu.test(normalizedText) ||
    /^(?:summary)\s+today$/iu.test(normalizedText)
  );
}

function isSummaryWeek(normalizedText: string): boolean {
  return (
    /^(?:summary|итоги|сводка)(?:\s+за)?\s+(?:эту\s+)?недел(?:ю|я)$/iu.test(normalizedText) ||
    /^(?:summary)\s+week$/iu.test(normalizedText)
  );
}

export function routeNaturalTelegramText(originalText: string): NaturalTelegramRoute {
  const normalizedText = normalizeWhitespace(originalText);

  if (!normalizedText) {
    return { kind: "ignore" };
  }

  const normalizedForMatchingText = normalizeForMatching(normalizedText);

  if (isSummaryToday(normalizedForMatchingText)) {
    return toCommandRoute("/summary today");
  }

  if (isSummaryWeek(normalizedForMatchingText)) {
    return toCommandRoute("/summary week");
  }

  if (REMINDERS_MATCHES.has(normalizedForMatchingText)) {
    return toCommandRoute("/reminders");
  }

  if (LIST_MATCHES.has(normalizedForMatchingText)) {
    return toCommandRoute("/list");
  }

  if (INBOX_MATCHES.has(normalizedForMatchingText)) {
    return toCommandRoute("/inbox");
  }

  if (LAST_MATCHES.has(normalizedForMatchingText)) {
    return toCommandRoute("/last");
  }

  if (HELP_MATCHES.has(normalizedForMatchingText)) {
    return toCommandRoute("/help");
  }

  if (STATS_MATCHES.has(normalizedForMatchingText)) {
    return toCommandRoute("/stats");
  }

  const reminderRoute = matchCommandPayload(normalizedText, REMINDER_PATTERNS, "/remind");

  if (reminderRoute) {
    return reminderRoute;
  }

  const searchRoute = matchCommandPayload(normalizedText, SEARCH_PATTERNS, "/search");

  if (searchRoute) {
    return searchRoute;
  }

  const saveRoute = matchCommandPayload(normalizedText, SAVE_PATTERNS, "/save");

  if (saveRoute) {
    return saveRoute;
  }

  return {
    kind: "save",
    rawText: normalizedText,
  };
}
