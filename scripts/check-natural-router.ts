import assert from "node:assert/strict";

import { routeNaturalTelegramText } from "../src/features/telegram/natural-router.ts";

const reminderCases = [
  "8 июня напомнить Семешиной, что надо оплатить через СБП",
  "8 июня в 10:00 напомни написать Семешиной",
  "завтра в 10 напомни позвонить Маше",
  "через 2 часа напомни выпить воды",
  "в понедельник в 9 напомни отправить отчет",
  "напомни через 30 минут проверить духовку",
];

for (const input of reminderCases) {
  const routed = routeNaturalTelegramText(input);
  assert.equal(routed.kind, "command", `Expected command routing for: ${input}`);

  if (routed.kind === "command") {
    assert.equal(
      routed.messageText,
      `/remind ${input}`,
      `Expected /remind passthrough for: ${input}`
    );
  }
}

const saveCases = ["идея для поста про интервалы", "Семешиной надо через СБП оплачивать"];

for (const input of saveCases) {
  const routed = routeNaturalTelegramText(input);
  assert.equal(routed.kind, "save", `Expected save routing for: ${input}`);
}

console.log(
  `Natural router checks passed: ${reminderCases.length} remind routes, ${saveCases.length} save routes.`
);
