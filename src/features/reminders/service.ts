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
const REMINDER_TEXT_LIMIT = 90;

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export function getEveningReviewTag(): string {
  return EVENING_REVIEW_TAG;
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
        formatEveningReminderMessage(reminder.rawText)
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
