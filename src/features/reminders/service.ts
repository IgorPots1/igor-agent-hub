import {
  claimPendingBrainReminder,
  createBrainReminders,
  listDueBrainReminders,
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
    .replace(/^(?:напомнить|напомни)(?:\s+|$)/i, "")
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

    const normalizedRawText = rawText.replace(/\s+/g, " ").trim();

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

  const todayEveningMatch = reminderText.match(/^сегодня\s+вечером(?:\s+|$)/i);

  if (todayEveningMatch) {
    return buildResult(
      todayEveningMatch[0],
      createBelgradeIsoIfFuture(today.year, today.month, today.day, 19, 0, now)
    );
  }

  const tomorrowEveningMatch = reminderText.match(/^завтра\s+вечером(?:\s+|$)/i);

  if (tomorrowEveningMatch) {
    return buildResult(
      tomorrowEveningMatch[0],
      createBelgradeIsoIfFuture(tomorrow.year, tomorrow.month, tomorrow.day, 19, 0, now)
    );
  }

  const eveningMatch = reminderText.match(/^вечером(?:\s+|$)/i);

  if (eveningMatch) {
    const targetDay = currentMinutes < 19 * 60 ? today : tomorrow;

    return buildResult(
      eveningMatch[0],
      createBelgradeIsoIfFuture(targetDay.year, targetDay.month, targetDay.day, 19, 0, now)
    );
  }

  const relativeMatch = reminderText.match(
    /^через\s+(\d+)\s+(минут(?:у|ы)?|минут|час(?:а|ов)?|час|день|дня|дней)(?:\s+|$)/i
  );

  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unitToken = relativeMatch[2].toLocaleLowerCase("ru");
    const unit =
      unitToken.startsWith("минут")
        ? "minute"
        : unitToken.startsWith("час")
          ? "hour"
          : "day";

    return buildResult(relativeMatch[0], getManualReminderRelativeIso(amount, unit, now));
  }

  const namedDayTimeMatch = reminderText.match(
    /^(сегодня|завтра|послезавтра)\s+(?:в\s+)?(\d{1,2}):(\d{2})(?:\s+|$)/i
  );

  if (namedDayTimeMatch) {
    const dayToken = namedDayTimeMatch[1].toLocaleLowerCase("ru");
    const targetDay =
      dayToken === "сегодня" ? today : dayToken === "завтра" ? tomorrow : dayAfterTomorrow;

    return buildResult(
      namedDayTimeMatch[0],
      createBelgradeIsoIfFuture(
        targetDay.year,
        targetDay.month,
        targetDay.day,
        Number(namedDayTimeMatch[2]),
        Number(namedDayTimeMatch[3]),
        now
      )
    );
  }

  const namedDayTrailingTimeMatch = reminderText.match(
    /^(сегодня|завтра|послезавтра)\s+(.+?)\s+(?:в\s+)?(\d{1,2}):(\d{2})$/i
  );

  if (namedDayTrailingTimeMatch) {
    const dayToken = namedDayTrailingTimeMatch[1].toLocaleLowerCase("ru");
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

  const isoDateTimeMatch = reminderText.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?:\s+|$)/
  );

  if (isoDateTimeMatch) {
    return buildResult(
      isoDateTimeMatch[0],
      createBelgradeIsoIfFuture(
        Number(isoDateTimeMatch[1]),
        Number(isoDateTimeMatch[2]),
        Number(isoDateTimeMatch[3]),
        Number(isoDateTimeMatch[4]),
        Number(isoDateTimeMatch[5]),
        now
      )
    );
  }

  const dottedDateTimeMatch = reminderText.match(
    /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?:\s+|$)/
  );

  if (dottedDateTimeMatch) {
    return buildResult(
      dottedDateTimeMatch[0],
      createBelgradeIsoIfFuture(
        Number(dottedDateTimeMatch[3]),
        Number(dottedDateTimeMatch[2]),
        Number(dottedDateTimeMatch[1]),
        Number(dottedDateTimeMatch[4]),
        Number(dottedDateTimeMatch[5]),
        now
      )
    );
  }

  const implicitTimeMatch = reminderText.match(/^в\s+(\d{1,2}):(\d{2})(?:\s+|$)/i);

  if (implicitTimeMatch) {
    const hour = Number(implicitTimeMatch[1]);
    const minute = Number(implicitTimeMatch[2]);
    const remindAt =
      createBelgradeIsoIfFuture(today.year, today.month, today.day, hour, minute, now) ??
      createBelgradeIsoIfFuture(tomorrow.year, tomorrow.month, tomorrow.day, hour, minute, now);

    return buildResult(implicitTimeMatch[0], remindAt);
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

export async function deliverDueReminders(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const dueReminders = await listDueBrainReminders(new Date().toISOString(), limit);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of dueReminders) {
    const claimed = await claimPendingBrainReminder(reminder.id, reminder.updatedAt);

    if (!claimed) {
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
      await markBrainReminderFailed(reminder.id, getErrorMessage(error));
    }
  }

  return {
    processed: dueReminders.length,
    sent,
    failed,
    skipped,
  };
}
