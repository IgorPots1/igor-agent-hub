import {
  archiveCompletedReminderBrainItems,
  claimPendingBrainReminder,
  createBrainReminders,
  listDueBrainReminders,
  rescheduleBrainReminder,
  listUpcomingBrainRemindersForChat,
  markBrainReminderFailed,
  markBrainReminderSent,
} from "@/features/reminders/repository";
import type { BrainReminderWithItem } from "@/features/reminders/types";
import {
  sendTelegramMessage,
  sendTelegramMessageOrThrow,
} from "@/features/telegram/telegram-client";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const EVENING_REVIEW_TAG = "вечерний-разбор";
const MANUAL_REMINDER_TAG = "напоминание";
const REMINDER_TEXT_LIMIT = 90;
const REMINDER_CLAIM_LEASE_MS = 60_000;
const REMINDER_RETRY_DELAY_MS = 5 * 60_000;
const COMPLETED_REMINDER_ARCHIVE_DELAY_MS = 24 * 60 * 60 * 1000;
const MAX_REMINDER_DELIVERY_ATTEMPTS = 3;
const DEFAULT_REMINDER_HOUR = 10;
const DEFAULT_REMINDER_MINUTE = 0;
const EVENING_REMINDER_HOUR = 19;
const EVENING_REMINDER_MINUTE = 0;

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type ParsedManualReminder = {
  rawText: string;
  remindAt: string;
  formattedLocalDateTime: string;
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

type ParsedTimeToken = {
  hour: number;
  minute: number;
  matchedText: string;
};

type ParsedCalendarDateToken = {
  day: number;
  month: number;
  year: number | null;
  matchedText: string;
};

const RUSSIAN_NUMBER_WORDS: Record<string, number> = {
  один: 1,
  одну: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  двадцать: 20,
  тридцать: 30,
};

const RUSSIAN_MONTHS: Record<string, number> = {
  январь: 1,
  января: 1,
  янв: 1,
  февраль: 2,
  февраля: 2,
  фев: 2,
  март: 3,
  марта: 3,
  мар: 3,
  апрель: 4,
  апреля: 4,
  апр: 4,
  май: 5,
  мая: 5,
  июнь: 6,
  июня: 6,
  июн: 6,
  июль: 7,
  июля: 7,
  июл: 7,
  август: 8,
  августа: 8,
  авг: 8,
  сентябрь: 9,
  сентября: 9,
  сент: 9,
  сен: 9,
  октябрь: 10,
  октября: 10,
  окт: 10,
  ноябрь: 11,
  ноября: 11,
  ноя: 11,
  декабрь: 12,
  декабря: 12,
  дек: 12,
};

const RUSSIAN_ORDINAL_DAYS: Record<string, number> = {
  первого: 1,
  второго: 2,
  третьего: 3,
  четвертого: 4,
  четвёртого: 4,
  пятого: 5,
  шестого: 6,
  седьмого: 7,
  восьмого: 8,
  девятого: 9,
  десятого: 10,
  одиннадцатого: 11,
  двенадцатого: 12,
  тринадцатого: 13,
  четырнадцатого: 14,
  пятнадцатого: 15,
  шестнадцатого: 16,
  семнадцатого: 17,
  восемнадцатого: 18,
  девятнадцатого: 19,
  двадцатого: 20,
  "двадцать первого": 21,
  "двадцать второго": 22,
  "двадцать третьего": 23,
  "двадцать четвертого": 24,
  "двадцать четвёртого": 24,
  "двадцать пятого": 25,
  "двадцать шестого": 26,
  "двадцать седьмого": 27,
  "двадцать восьмого": 28,
  "двадцать девятого": 29,
  тридцатого: 30,
  "тридцать первого": 31,
};

const RUSSIAN_ORDINAL_DAY_PATTERN = Object.keys(RUSSIAN_ORDINAL_DAYS)
  .sort((left, right) => right.length - left.length)
  .map((phrase) => escapeRegExp(phrase))
  .join("|");

const RUSSIAN_WEEKDAYS: Record<string, number> = {
  понедельник: 1,
  понедельника: 1,
  вторник: 2,
  вторника: 2,
  среда: 3,
  среду: 3,
  четверг: 4,
  четверга: 4,
  пятница: 5,
  пятницу: 5,
  суббота: 6,
  субботу: 6,
  воскресенье: 0,
};

const zonedDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BELGRADE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const timeZoneOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BELGRADE_TIME_ZONE,
  timeZoneName: "shortOffset",
});

function getZonedDateParts(date: Date): ZonedDateParts {
  const parts = zonedDateFormatter.formatToParts(date);
  const mappedParts = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;

  return {
    year: mappedParts.year,
    month: mappedParts.month,
    day: mappedParts.day,
    hour: mappedParts.hour,
    minute: mappedParts.minute,
    second: mappedParts.second,
  };
}

function getTimeZoneOffsetMinutes(date: Date): number {
  const offsetPart = timeZoneOffsetFormatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (!offsetPart) {
    throw new Error("Unable to resolve Europe/Belgrade offset");
  }

  if (offsetPart === "GMT" || offsetPart === "UTC") {
    return 0;
  }

  const match = offsetPart.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/);

  if (!match) {
    throw new Error(`Unsupported Europe/Belgrade offset format: ${offsetPart}`);
  }

  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return sign * (hours * 60 + minutes);
}

function toUtcIsoForBelgradeLocalTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): string {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcMs));
    const adjustedUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offsetMinutes * 60_000;

    if (adjustedUtcMs === utcMs) {
      break;
    }

    utcMs = adjustedUtcMs;
  }

  return new Date(utcMs).toISOString();
}

function isValidClockTime(hour: number, minute: number): boolean {
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

function isValidLocalDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function isFutureIso(remindAt: string, now = new Date()): boolean {
  return new Date(remindAt).getTime() > now.getTime();
}

function createBelgradeIsoIfFuture(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  now = new Date()
): string | null {
  if (!isValidLocalDate(year, month, day) || !isValidClockTime(hour, minute)) {
    return null;
  }

  const remindAt = toUtcIsoForBelgradeLocalTime(year, month, day, hour, minute);
  return isFutureIso(remindAt, now) ? remindAt : null;
}

function addLocalDays(year: number, month: number, day: number, daysToAdd: number) {
  const nextDate = new Date(Date.UTC(year, month - 1, day + daysToAdd));

  return {
    year: nextDate.getUTCFullYear(),
    month: nextDate.getUTCMonth() + 1,
    day: nextDate.getUTCDate(),
  };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addLocalMonths(year: number, month: number, day: number, monthsToAdd: number): LocalDateParts {
  const baseMonthIndex = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(baseMonthIndex / 12);
  const normalizedMonthIndex = ((baseMonthIndex % 12) + 12) % 12;
  const targetMonth = normalizedMonthIndex + 1;
  const targetDay = Math.min(day, getDaysInMonth(targetYear, targetMonth));

  return {
    year: targetYear,
    month: targetMonth,
    day: targetDay,
  };
}

function normalizeRussianText(value: string): string {
  return value.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRussianNumberToken(token: string | undefined): number | null {
  if (!token) {
    return null;
  }

  const normalizedToken = normalizeRussianText(token);

  if (/^\d+$/u.test(normalizedToken)) {
    const numericValue = Number(normalizedToken);
    return Number.isInteger(numericValue) ? numericValue : null;
  }

  return RUSSIAN_NUMBER_WORDS[normalizedToken] ?? null;
}

function resolveRussianMonth(token: string): number | null {
  return RUSSIAN_MONTHS[normalizeRussianText(token)] ?? null;
}

function resolveRussianWeekday(token: string): number | null {
  return RUSSIAN_WEEKDAYS[normalizeRussianText(token)] ?? null;
}

function resolveRussianOrdinalDay(token: string): number | null {
  return RUSSIAN_ORDINAL_DAYS[normalizeRussianText(token)] ?? null;
}

function parseLeadingRussianCalendarDate(value: string): ParsedCalendarDateToken | null {
  const numericDateMatch = value.match(
    /^[\s,.;:!-]*(\d{1,2})(?:\s*-?(?:го|ое|е))?\s+([а-яё]+)(?:\s+(\d{4})(?:\s*г(?:од(?:а)?)?)?)?(?:[\s,.;:!?-]+|$)/iu
  );

  if (numericDateMatch) {
    const month = resolveRussianMonth(numericDateMatch[2]);

    if (!month) {
      return null;
    }

    return {
      day: Number(numericDateMatch[1]),
      month,
      year: numericDateMatch[3] ? Number(numericDateMatch[3]) : null,
      matchedText: numericDateMatch[0],
    };
  }

  const ordinalDateMatch = value.match(
    new RegExp(
      String.raw`^[\s,.;:!-]*(${RUSSIAN_ORDINAL_DAY_PATTERN})\s+([а-яё]+)(?:\s+(\d{4})(?:\s*г(?:од(?:а)?)?)?)?(?:[\s,.;:!?-]+|$)`,
      "iu"
    )
  );

  if (!ordinalDateMatch) {
    return null;
  }

  const day = resolveRussianOrdinalDay(ordinalDateMatch[1]);
  const month = resolveRussianMonth(ordinalDateMatch[2]);

  if (!day || !month) {
    return null;
  }

  return {
    day,
    month,
    year: ordinalDateMatch[3] ? Number(ordinalDateMatch[3]) : null,
    matchedText: ordinalDateMatch[0],
  };
}

function normalizeMeridiemHour(hour: number, meridiem: string | undefined): number {
  if (!meridiem) {
    return hour;
  }

  const normalizedMeridiem = normalizeRussianText(meridiem);

  if (normalizedMeridiem === "утра") {
    return hour === 12 ? 0 : hour;
  }

  if (normalizedMeridiem === "вечера" && hour < 12) {
    return hour + 12;
  }

  return hour;
}

function extractLeadingTime(
  value: string,
  options: { allowSeparatedHourMinute?: boolean } = {}
): ParsedTimeToken | null {
  const { allowSeparatedHourMinute = false } = options;

  const eveningMatch = value.match(/^[\s,.;:!-]*вечером(?:[\s,.;:!?-]+|$)/iu);

  if (eveningMatch) {
    return {
      hour: EVENING_REMINDER_HOUR,
      minute: EVENING_REMINDER_MINUTE,
      matchedText: eveningMatch[0],
    };
  }

  const timeWithSeparatorMatch = value.match(
    /^[\s,.;:!-]*(?:в\s+)?(\d{1,2})[:.](\d{2})(?:\s+(утра|вечера))?(?:[\s,.;:!?-]+|$)/iu
  );

  if (timeWithSeparatorMatch) {
    return {
      hour: normalizeMeridiemHour(
        Number(timeWithSeparatorMatch[1]),
        timeWithSeparatorMatch[3]
      ),
      minute: Number(timeWithSeparatorMatch[2]),
      matchedText: timeWithSeparatorMatch[0],
    };
  }

  if (allowSeparatedHourMinute) {
    const separatedTimeMatch = value.match(
      /^[\s,.;:!-]*(?:в\s+)?(\d{1,2})\s+(\d{2})(?:\s+(утра|вечера))?(?:[\s,.;:!?-]+|$)/iu
    );

    if (separatedTimeMatch) {
      return {
        hour: normalizeMeridiemHour(Number(separatedTimeMatch[1]), separatedTimeMatch[3]),
        minute: Number(separatedTimeMatch[2]),
        matchedText: separatedTimeMatch[0],
      };
    }
  }

  const hoursWordMatch = value.match(
    /^[\s,.;:!-]*(?:в\s+)?(\d{1,2})\s*час(?:ов|а)?(?:\s+(утра|вечера))?(?:[\s,.;:!?-]+|$)/iu
  );

  if (hoursWordMatch) {
    return {
      hour: normalizeMeridiemHour(Number(hoursWordMatch[1]), hoursWordMatch[2]),
      minute: 0,
      matchedText: hoursWordMatch[0],
    };
  }

  const bareHourMatch = value.match(
    /^[\s,.;:!-]*(?:в\s+)?(\d{1,2})(?:\s+(утра|вечера))?(?:[\s,.;:!?-]+|$)/iu
  );

  if (bareHourMatch) {
    return {
      hour: normalizeMeridiemHour(Number(bareHourMatch[1]), bareHourMatch[2]),
      minute: 0,
      matchedText: bareHourMatch[0],
    };
  }

  return null;
}

function cleanupReminderRawText(value: string): string {
  return value
    .replace(
      /^(?:напомнить|напомни|напомню)(?:\s+мне)?(?:\s*[,.:;-]\s*|\s+|$)/iu,
      ""
    )
    .replace(
      /^[\s,.;:!?-]*(?:напомнить|напомни|напомню)(?:\s+мне)?(?:\s*[,.:;-]\s*|\s+|$)/iu,
      ""
    )
    .replace(/^(?:мне)(?:\s*[,.:;-]\s*|\s+|$)/iu, "")
    .replace(/^[\s,.;:!?-]+/u, "")
    .replace(/^(?:что|чтобы)(?:\s+|$)/iu, "")
    .replace(/^[\s,.;:!?-]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveNearestFutureDateWithoutYear(
  month: number,
  day: number,
  hour: number,
  minute: number,
  now = new Date()
): string | null {
  const localNow = getZonedDateParts(now);

  return (
    createBelgradeIsoIfFuture(localNow.year, month, day, hour, minute, now) ??
    createBelgradeIsoIfFuture(localNow.year + 1, month, day, hour, minute, now)
  );
}

function resolveNearestFutureWeekday(
  weekday: number,
  hour: number,
  minute: number,
  now = new Date()
): string | null {
  const localNow = getZonedDateParts(now);
  const currentWeekday = new Date(
    Date.UTC(localNow.year, localNow.month - 1, localNow.day)
  ).getUTCDay();
  const daysUntilWeekday = (weekday - currentWeekday + 7) % 7;
  const candidateDate = addLocalDays(localNow.year, localNow.month, localNow.day, daysUntilWeekday);
  const remindAt = createBelgradeIsoIfFuture(
    candidateDate.year,
    candidateDate.month,
    candidateDate.day,
    hour,
    minute,
    now
  );

  if (remindAt) {
    return remindAt;
  }

  const nextWeekDate = addLocalDays(candidateDate.year, candidateDate.month, candidateDate.day, 7);
  return createBelgradeIsoIfFuture(
    nextWeekDate.year,
    nextWeekDate.month,
    nextWeekDate.day,
    hour,
    minute,
    now
  );
}

function truncateReminderText(text: string, maxLength: number): string {
  const compactText = text.replace(/\s+/g, " ").trim();
  const symbols = Array.from(compactText);

  if (symbols.length <= maxLength) {
    return compactText;
  }

  return `${symbols.slice(0, maxLength - 1).join("").trimEnd()}…`;
}

function getRelativeReminderDayLabel(remindAt: string, now = new Date()): string {
  const reminderDate = getZonedDateParts(new Date(remindAt));
  const today = getZonedDateParts(now);
  const tomorrow = addLocalDays(today.year, today.month, today.day, 1);

  if (
    reminderDate.year === today.year &&
    reminderDate.month === today.month &&
    reminderDate.day === today.day
  ) {
    return "Сегодня";
  }

  if (
    reminderDate.year === tomorrow.year &&
    reminderDate.month === tomorrow.month &&
    reminderDate.day === tomorrow.day
  ) {
    return "Завтра";
  }

  return `${String(reminderDate.day).padStart(2, "0")}.${String(reminderDate.month).padStart(2, "0")}`;
}

function formatReminderTime(remindAt: string): string {
  const reminderDate = getZonedDateParts(new Date(remindAt));
  return `${String(reminderDate.hour).padStart(2, "0")}:${String(reminderDate.minute).padStart(2, "0")}`;
}

export function formatBelgradeLocalDateTime(remindAt: string): string {
  const reminderDate = getZonedDateParts(new Date(remindAt));

  return `${String(reminderDate.day).padStart(2, "0")}.${String(reminderDate.month).padStart(2, "0")}.${String(reminderDate.year).padStart(4, "0")} ${String(reminderDate.hour).padStart(2, "0")}:${String(reminderDate.minute).padStart(2, "0")}`;
}

function getEveningReviewReminderTimes(now = new Date()): string[] {
  const localNow = getZonedDateParts(now);
  const currentMinutes = localNow.hour * 60 + localNow.minute;
  const today = {
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
  };
  const tomorrow = addLocalDays(localNow.year, localNow.month, localNow.day, 1);

  if (currentMinutes < 19 * 60) {
    return [
      toUtcIsoForBelgradeLocalTime(today.year, today.month, today.day, 19, 0),
      toUtcIsoForBelgradeLocalTime(today.year, today.month, today.day, 20, 0),
    ];
  }

  if (currentMinutes < 20 * 60) {
    return [toUtcIsoForBelgradeLocalTime(today.year, today.month, today.day, 20, 0)];
  }

  return [
    toUtcIsoForBelgradeLocalTime(tomorrow.year, tomorrow.month, tomorrow.day, 19, 0),
    toUtcIsoForBelgradeLocalTime(tomorrow.year, tomorrow.month, tomorrow.day, 20, 0),
  ];
}

function formatEveningReminderMessage(rawText: string): string {
  return ["⏰ Вечерний разбор", "", rawText.trim()].join("\n");
}

function formatManualReminderMessage(rawText: string): string {
  return ["⏰ Напоминание", "", rawText.trim()].join("\n");
}

function isEveningReviewReminder(reminder: BrainReminderWithItem): boolean {
  return (
    reminder.brainItemSource === "telegram_forward" ||
    reminder.brainItemTags.includes(EVENING_REVIEW_TAG)
  );
}

function formatDeliveryReminderMessage(reminder: BrainReminderWithItem): string {
  return isEveningReviewReminder(reminder)
    ? formatEveningReminderMessage(reminder.rawText)
    : formatManualReminderMessage(reminder.rawText);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export function getEveningReviewTag(): string {
  return EVENING_REVIEW_TAG;
}

export function getManualReminderTag(): string {
  return MANUAL_REMINDER_TAG;
}

export function getForwardedTaskCategory(rawText: string): string {
  const normalizedText = rawText.toLocaleLowerCase("ru");
  const reschedulePattern =
    /(тренировк|заняти|пробежк|план|перенес|переноси|перестав|поменяй|сдвин|замени)/i;

  return reschedulePattern.test(normalizedText) ? "Ученики" : "Inbox";
}

export async function createEveningReviewReminders(
  brainItemId: string,
  telegramChatId: string,
  now = new Date()
) {
  const remindTimes = getEveningReviewReminderTimes(now);

  return createBrainReminders(
    remindTimes.map((remindAt) => ({
      brainItemId,
      telegramChatId,
      remindAt,
      status: "pending",
    }))
  );
}

export async function createManualReminder(
  brainItemId: string,
  telegramChatId: string,
  remindAt: string
) {
  const [reminder] = await createBrainReminders([
    {
      brainItemId,
      telegramChatId,
      remindAt,
      status: "pending",
    },
  ]);

  return reminder;
}

function getManualReminderRelativeIso(
  amount: number,
  unit: "minute" | "hour" | "day",
  now = new Date()
): string | null {
  if (!Number.isInteger(amount) || amount <= 0) {
    return null;
  }

  const multiplier =
    unit === "minute" ? 60_000 : unit === "hour" ? 60 * 60_000 : 24 * 60 * 60_000;

  return new Date(now.getTime() + amount * multiplier).toISOString();
}

export function parseManualReminder(text: string, now = new Date()): ParsedManualReminder | null {
  const normalizedText = text.trim().replace(/[.,!?]+$/u, "").trim();

  if (!normalizedText) {
    return null;
  }

  const reminderText = normalizedText
    .replace(/^(?:напомнить|напомни|напомню)(?:\s+мне)?(?:\s*[,.:;-]\s*|\s+|$)/iu, "")
    .trim();

  if (!reminderText) {
    return null;
  }

  const localNow = getZonedDateParts(now);
  const currentMinutes = localNow.hour * 60 + localNow.minute;
  const today = {
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
  };
  const tomorrow = addLocalDays(today.year, today.month, today.day, 1);
  const dayAfterTomorrow = addLocalDays(today.year, today.month, today.day, 2);

  const buildResultFromRawText = (
    rawText: string,
    remindAt: string | null
  ): ParsedManualReminder | null => {
    if (!remindAt) {
      return null;
    }

    const normalizedRawText = cleanupReminderRawText(rawText);

    if (!normalizedRawText) {
      return null;
    }

    return {
      rawText: normalizedRawText,
      remindAt,
      formattedLocalDateTime: formatBelgradeLocalDateTime(remindAt),
    };
  };

  const buildResult = (matchedPrefix: string, remindAt: string | null): ParsedManualReminder | null =>
    buildResultFromRawText(reminderText.slice(matchedPrefix.length), remindAt);

  const buildDatedResult = (
    remainingText: string,
    resolveRemindAt: (hour: number, minute: number) => string | null,
    options: { defaultHour?: number; defaultMinute?: number } = {}
  ): ParsedManualReminder | null => {
    const {
      defaultHour = DEFAULT_REMINDER_HOUR,
      defaultMinute = DEFAULT_REMINDER_MINUTE,
    } = options;

    const parsedTime = extractLeadingTime(remainingText, {
      allowSeparatedHourMinute: true,
    });

    if (parsedTime) {
      return buildResultFromRawText(
        remainingText.slice(parsedTime.matchedText.length),
        resolveRemindAt(parsedTime.hour, parsedTime.minute)
      );
    }

    return buildResultFromRawText(remainingText, resolveRemindAt(defaultHour, defaultMinute));
  };

  const eveningMatch = reminderText.match(/^вечером(?:\s+|$)/iu);

  if (eveningMatch) {
    const targetDay = currentMinutes < 19 * 60 ? today : tomorrow;

    return buildResult(
      eveningMatch[0],
      createBelgradeIsoIfFuture(
        targetDay.year,
        targetDay.month,
        targetDay.day,
        EVENING_REMINDER_HOUR,
        EVENING_REMINDER_MINUTE,
        now
      )
    );
  }

  const relativeMinuteHourMatch = reminderText.match(
    /^через\s+(\d+|[а-яё]+)\s+(минут(?:у|ы)?|минут|час(?:а|ов)?|час)(?:\s+|$)/iu
  );

  if (relativeMinuteHourMatch) {
    const amount = parseRussianNumberToken(relativeMinuteHourMatch[1]);
    const unitToken = normalizeRussianText(relativeMinuteHourMatch[2]);

    if (!amount) {
      return null;
    }

    const unit = unitToken.startsWith("минут") ? "minute" : "hour";
    return buildResult(relativeMinuteHourMatch[0], getManualReminderRelativeIso(amount, unit, now));
  }

  const relativeDateMatch = reminderText.match(
    /^через\s+(?:(\d+|[а-яё]+)\s+)?(день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев)(?:\s+|$)/iu
  );

  if (relativeDateMatch) {
    const amount = relativeDateMatch[1] ? parseRussianNumberToken(relativeDateMatch[1]) : 1;
    const unitToken = normalizeRussianText(relativeDateMatch[2]);

    if (!amount || amount <= 0) {
      return null;
    }

    const targetDate = unitToken.startsWith("меся")
      ? addLocalMonths(today.year, today.month, today.day, amount)
      : addLocalDays(
          today.year,
          today.month,
          today.day,
          unitToken.startsWith("недел") ? amount * 7 : amount
        );

    return buildDatedResult(
      reminderText.slice(relativeDateMatch[0].length),
      (hour, minute) =>
        createBelgradeIsoIfFuture(targetDate.year, targetDate.month, targetDate.day, hour, minute, now)
    );
  }

  const namedDayTrailingTimeMatch = reminderText.match(
    /^(сегодня|завтра|послезавтра)\s+(.+?)\s+(?:в\s+)?(\d{1,2})[:.](\d{2})$/iu
  );

  if (namedDayTrailingTimeMatch) {
    const dayToken = normalizeRussianText(namedDayTrailingTimeMatch[1]);
    const targetDay =
      dayToken === "сегодня" ? today : dayToken === "завтра" ? tomorrow : dayAfterTomorrow;

    return buildResultFromRawText(
      namedDayTrailingTimeMatch[2],
      createBelgradeIsoIfFuture(
        targetDay.year,
        targetDay.month,
        targetDay.day,
        Number(namedDayTrailingTimeMatch[3]),
        Number(namedDayTrailingTimeMatch[4]),
        now
      )
    );
  }

  const namedDayMatch = reminderText.match(/^(сегодня|завтра|послезавтра)(?:\s+|$)/iu);

  if (namedDayMatch) {
    const dayToken = normalizeRussianText(namedDayMatch[1]);
    const targetDay =
      dayToken === "сегодня" ? today : dayToken === "завтра" ? tomorrow : dayAfterTomorrow;

    return buildDatedResult(
      reminderText.slice(namedDayMatch[0].length),
      (hour, minute) =>
        createBelgradeIsoIfFuture(targetDay.year, targetDay.month, targetDay.day, hour, minute, now)
    );
  }

  const weekdayMatch = reminderText.match(
    /^(?:в\s+)?(понедельник(?:а)?|вторник(?:а)?|среда|среду|четверг(?:а)?|пятница|пятницу|суббота|субботу|воскресенье)(?:\s+|$)/iu
  );

  if (weekdayMatch) {
    const weekday = resolveRussianWeekday(weekdayMatch[1]);

    if (weekday === null) {
      return null;
    }

    return buildDatedResult(
      reminderText.slice(weekdayMatch[0].length),
      (hour, minute) => resolveNearestFutureWeekday(weekday, hour, minute, now)
    );
  }

  const isoDateMatch = reminderText.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+|$)/u);

  if (isoDateMatch) {
    return buildDatedResult(
      reminderText.slice(isoDateMatch[0].length),
      (hour, minute) =>
        createBelgradeIsoIfFuture(
          Number(isoDateMatch[1]),
          Number(isoDateMatch[2]),
          Number(isoDateMatch[3]),
          hour,
          minute,
          now
        )
    );
  }

  const dottedDateWithYearMatch = reminderText.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+|$)/u);

  if (dottedDateWithYearMatch) {
    return buildDatedResult(
      reminderText.slice(dottedDateWithYearMatch[0].length),
      (hour, minute) =>
        createBelgradeIsoIfFuture(
          Number(dottedDateWithYearMatch[3]),
          Number(dottedDateWithYearMatch[2]),
          Number(dottedDateWithYearMatch[1]),
          hour,
          minute,
          now
        )
    );
  }

  const dottedDateWithoutYearMatch = reminderText.match(/^(\d{2})\.(\d{2})(?:\s+|$)/u);

  if (dottedDateWithoutYearMatch) {
    return buildDatedResult(
      reminderText.slice(dottedDateWithoutYearMatch[0].length),
      (hour, minute) =>
        resolveNearestFutureDateWithoutYear(
          Number(dottedDateWithoutYearMatch[2]),
          Number(dottedDateWithoutYearMatch[1]),
          hour,
          minute,
          now
        )
    );
  }

  const monthNameDateMatch = parseLeadingRussianCalendarDate(reminderText);

  if (monthNameDateMatch) {
    const explicitYear = monthNameDateMatch.year;

    return buildDatedResult(
      reminderText.slice(monthNameDateMatch.matchedText.length),
      (hour, minute) =>
        explicitYear === null
          ? resolveNearestFutureDateWithoutYear(
              monthNameDateMatch.month,
              monthNameDateMatch.day,
              hour,
              minute,
              now
            )
          : createBelgradeIsoIfFuture(
              explicitYear,
              monthNameDateMatch.month,
              monthNameDateMatch.day,
              hour,
              minute,
              now
            )
    );
  }

  const implicitTimeMatch = extractLeadingTime(reminderText);

  if (implicitTimeMatch) {
    const remindAt =
      createBelgradeIsoIfFuture(
        today.year,
        today.month,
        today.day,
        implicitTimeMatch.hour,
        implicitTimeMatch.minute,
        now
      ) ??
      createBelgradeIsoIfFuture(
        tomorrow.year,
        tomorrow.month,
        tomorrow.day,
        implicitTimeMatch.hour,
        implicitTimeMatch.minute,
        now
      );

    return buildResultFromRawText(
      reminderText.slice(implicitTimeMatch.matchedText.length),
      remindAt
    );
  }

  return null;
}

export function formatUpcomingRemindersMessage(
  reminders: BrainReminderWithItem[],
  now = new Date()
): string {
  if (reminders.length === 0) {
    return "Активных напоминаний нет.";
  }

  const lines = reminders.map((reminder, index) => {
    const label = getRelativeReminderDayLabel(reminder.remindAt, now);
    const time = formatReminderTime(reminder.remindAt);
    const text = truncateReminderText(reminder.rawText, REMINDER_TEXT_LIMIT);

    return `${index + 1}. ${label} ${time} — ${text}`;
  });

  return ["⏰ Ближайшие напоминания:", ...lines].join("\n");
}

export async function sendForwardedMessageUnsupportedReply(chatId: string | number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    "Пока могу добавить в вечерний разбор только текстовые сообщения."
  );
}

export async function getUpcomingRemindersMessageForChat(
  telegramChatId: string,
  now = new Date()
): Promise<string> {
  const reminders = await listUpcomingBrainRemindersForChat(telegramChatId, now.toISOString(), 10);
  return formatUpcomingRemindersMessage(reminders, now);
}

export async function archiveStaleCompletedReminderBrainItems(now = new Date()): Promise<number> {
  return archiveCompletedReminderBrainItems(
    new Date(now.getTime() - COMPLETED_REMINDER_ARCHIVE_DELAY_MS).toISOString()
  );
}

export async function deliverDueReminders(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  archived: number;
}> {
  const now = new Date();
  const dueReminders = await listDueBrainReminders(
    now.toISOString(),
    // Treat a recent updated_at as an active delivery lease to reduce duplicate sends.
    new Date(now.getTime() - REMINDER_CLAIM_LEASE_MS).toISOString(),
    limit
  );
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of dueReminders) {
    const attemptCount = await claimPendingBrainReminder(
      reminder.id,
      reminder.updatedAt,
      reminder.attemptCount
    );

    if (attemptCount === null) {
      skipped += 1;
      continue;
    }

    try {
      if (!reminder.rawText.trim()) {
        throw new Error("Reminder is missing brain item text");
      }

      await sendTelegramMessageOrThrow(
        reminder.telegramChatId,
        formatDeliveryReminderMessage(reminder)
      );
      await markBrainReminderSent(reminder.id, new Date().toISOString());
      sent += 1;
    } catch (error) {
      failed += 1;
      const errorMessage = getErrorMessage(error);

      if (attemptCount < MAX_REMINDER_DELIVERY_ATTEMPTS) {
        await rescheduleBrainReminder(
          reminder.id,
          errorMessage,
          new Date(Date.now() + REMINDER_RETRY_DELAY_MS).toISOString()
        );
      } else {
        await markBrainReminderFailed(reminder.id, errorMessage);
      }
    }
  }

  const archived = await archiveStaleCompletedReminderBrainItems(now);

  return {
    processed: dueReminders.length,
    sent,
    failed,
    skipped,
    archived,
  };
}
