export type NaturalTelegramRoute =
  | { kind: "command"; messageText: string }
  | { kind: "save"; rawText: string }
  | { kind: "ignore" };

const REMINDER_PATTERNS = [
  /^(?:пожалуйста\s+напомни)(?:,\s*|\s+|$)/iu,
  /^(?:пожалуйста\s+напомню)(?:,\s*|\s+|$)/iu,
  /^(?:напомни\s+пожалуйста)(?:,\s*|\s+|$)/iu,
  /^(?:напомню\s+пожалуйста)(?:,\s*|\s+|$)/iu,
  /^(?:напомнить)(?:,\s*|\s+|$)/iu,
  /^(?:напомню)(?:,\s*|\s+|$)/iu,
  /^(?:напомни)(?:,\s*|\s+|$)/iu,
];

const REMINDER_VERB_PATTERN =
  /(?:^|[\s,.;:!?()[\]{}"'«»„“”`-])(?:напомни|напомнить|напомню)(?=$|[\s,.;:!?()[\]{}"'«»„“”`-])/iu;
const REMINDER_TOKEN_BOUNDARY = String.raw`(?=$|[\s,.;:!?()[\]{}"'«»„“”` + "`" + String.raw`-])`;
const REMINDER_MONTH_PATTERN =
  "(?:январ(?:ь|я)|янв|феврал(?:ь|я)|фев|март|марта|мар|апрел(?:ь|я)|апр|ма[йя]|июн(?:ь|я)?|июл(?:ь|я)?|август|авг|сентябр(?:ь|я)|сент|сен|октябр(?:ь|я)|окт|ноябр(?:ь|я)|ноя|декабр(?:ь|я)|дек)";
const REMINDER_WEEKDAY_PATTERN =
  "(?:понедельник(?:а)?|вторник(?:а)?|среда|среду|четверг(?:а)?|пятница|пятницу|суббота|субботу|воскресенье)";
const LEADING_REMINDER_TIME_MARKER_PATTERN = new RegExp(
  `^(?:` +
    `(?:сегодня|завтра|послезавтра)${REMINDER_TOKEN_BOUNDARY}` +
    `|через${REMINDER_TOKEN_BOUNDARY}` +
    `|(?:в|во)\\s+${REMINDER_WEEKDAY_PATTERN}${REMINDER_TOKEN_BOUNDARY}` +
    `|\\d{1,2}\\s*[./]\\s*\\d{1,2}(?:\\s*[./]\\s*\\d{2,4})?\\b` +
    `|\\d{1,2}(?:\\s*-?(?:го|ое|е))?\\s+${REMINDER_MONTH_PATTERN}${REMINDER_TOKEN_BOUNDARY}` +
    `)`,
  "iu"
);

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

function hasStrongReminderIntent(text: string): boolean {
  if (REMINDER_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  return LEADING_REMINDER_TIME_MARKER_PATTERN.test(text) && REMINDER_VERB_PATTERN.test(text);
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

  if (hasStrongReminderIntent(normalizedText)) {
    return toCommandRoute(`/remind ${normalizedText}`);
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
