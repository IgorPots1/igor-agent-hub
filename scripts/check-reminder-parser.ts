import assert from "node:assert/strict";

import { parseManualReminder } from "../src/features/reminders/service";

const NOW = new Date("2026-05-05T08:00:00.000Z");
const REMINDER_TEXT = "купить подарок";

type SuccessfulCase = {
  input: string;
  expectedRawText?: string;
  expectedLocalDateTime: string;
};

const successCases: SuccessfulCase[] = [
  {
    input: `первого мая ${REMINDER_TEXT}`,
    expectedLocalDateTime: "01.05.2027 10:00",
  },
  {
    input: `пятнадцатого июня ${REMINDER_TEXT}`,
    expectedLocalDateTime: "15.06.2026 10:00",
  },
  {
    input: `двадцать третьего сентября ${REMINDER_TEXT}`,
    expectedLocalDateTime: "23.09.2026 10:00",
  },
  {
    input: `тридцать первого декабря ${REMINDER_TEXT}`,
    expectedLocalDateTime: "31.12.2026 10:00",
  },
  {
    input: `пятнадцатого июня в 11 ${REMINDER_TEXT}`,
    expectedLocalDateTime: "15.06.2026 11:00",
  },
  {
    input: `двадцать третьего сентября в 10.30 ${REMINDER_TEXT}`,
    expectedLocalDateTime: "23.09.2026 10:30",
  },
  {
    input: `первого мая 2027 ${REMINDER_TEXT}`,
    expectedLocalDateTime: "01.05.2027 10:00",
  },
  {
    input: `завтра ${REMINDER_TEXT}`,
    expectedLocalDateTime: "06.05.2026 10:00",
  },
  {
    input: `завтра в 10 ${REMINDER_TEXT}`,
    expectedLocalDateTime: "06.05.2026 10:00",
  },
  {
    input: `через 3 дня ${REMINDER_TEXT}`,
    expectedLocalDateTime: "08.05.2026 10:00",
  },
  {
    input: `через месяц ${REMINDER_TEXT}`,
    expectedLocalDateTime: "05.06.2026 10:00",
  },
  {
    input: `в пятницу ${REMINDER_TEXT}`,
    expectedLocalDateTime: "08.05.2026 10:00",
  },
  {
    input: `15 июня ${REMINDER_TEXT}`,
    expectedLocalDateTime: "15.06.2026 10:00",
  },
  {
    input: `15.06 ${REMINDER_TEXT}`,
    expectedLocalDateTime: "15.06.2026 10:00",
  },
  {
    input: `15.06.2026 ${REMINDER_TEXT}`,
    expectedLocalDateTime: "15.06.2026 10:00",
  },
];

const failureCases = [
  `тридцать первого февраля ${REMINDER_TEXT}`,
  "первого мая",
  "двадцать третьего сентября в 10.30",
];

for (const testCase of successCases) {
  const parsed = parseManualReminder(testCase.input, NOW);

  assert.ok(parsed, `Expected parser to accept: ${testCase.input}`);
  assert.equal(parsed.rawText, testCase.expectedRawText ?? REMINDER_TEXT);
  assert.equal(parsed.formattedLocalDateTime, testCase.expectedLocalDateTime);
}

for (const input of failureCases) {
  assert.equal(parseManualReminder(input, NOW), null, `Expected parser to reject: ${input}`);
}

console.log(`Reminder parser checks passed: ${successCases.length} accepted, ${failureCases.length} rejected.`);
