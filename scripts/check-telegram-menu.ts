import assert from "node:assert/strict";

import {
  routeTelegramMenuText,
  TELEGRAM_MAIN_MENU_REPLY_KEYBOARD,
} from "../src/features/telegram/menu-routes.ts";

const keyboardLabels = TELEGRAM_MAIN_MENU_REPLY_KEYBOARD.keyboard.flat();

const expectedRoutes: Record<
  string,
  | { kind: "command"; messageText: string }
  | { kind: "message"; includes: string }
> = {
  Меню: { kind: "message", includes: "Второй мозг" },
  "Как сохранить": { kind: "message", includes: "Second Brain" },
  "Как напомнить": { kind: "message", includes: "/remind" },
  Инбокс: { kind: "command", messageText: "/inbox" },
  Поиск: { kind: "command", messageText: "/search" },
  Итоги: { kind: "command", messageText: "/summary today" },
  Напоминания: { kind: "command", messageText: "/reminders" },
  Последнее: { kind: "command", messageText: "/last" },
  Статистика: { kind: "command", messageText: "/stats" },
};

assert.equal(keyboardLabels.length, Object.keys(expectedRoutes).length);

for (const label of keyboardLabels) {
  const expected = expectedRoutes[label];
  assert.ok(expected, `Unexpected keyboard label: ${label}`);

  const routed = routeTelegramMenuText(label);
  assert.equal(routed.kind, expected.kind, `Route kind mismatch for: ${label}`);

  if (expected.kind === "command" && routed.kind === "command") {
    assert.equal(routed.messageText, expected.messageText, `Command mismatch for: ${label}`);
  }

  if (expected.kind === "message" && routed.kind === "message") {
    assert.ok(
      routed.text.includes(expected.includes),
      `Message mismatch for: ${label}`
    );
  }
}

const legacyLabels: Array<[string, string]> = [
  ["Сохранить", "Second Brain"],
  ["Напомнить", "/remind"],
];

for (const [label, includes] of legacyLabels) {
  const routed = routeTelegramMenuText(label);
  assert.equal(routed.kind, "message", `Expected legacy message route for: ${label}`);

  if (routed.kind === "message") {
    assert.ok(routed.text.includes(includes), `Legacy message mismatch for: ${label}`);
  }
}

console.log(
  `Telegram menu checks passed: ${keyboardLabels.length} keyboard labels and ${legacyLabels.length} legacy labels.`
);
