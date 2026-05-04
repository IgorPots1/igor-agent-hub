import type { AgentType } from "@/features/agents/types";

export function routeAgentInput(input: string): AgentType {
  const normalizedInput = input.trim().toLowerCase();

  if (
    normalizedInput.startsWith("/save") ||
    normalizedInput.startsWith("запомни")
  ) {
    return "memory";
  }

  if (
    normalizedInput.startsWith("/post") ||
    normalizedInput.startsWith("пост")
  ) {
    return "content";
  }

  if (
    normalizedInput.startsWith("/research") ||
    normalizedInput.startsWith("найди")
  ) {
    return "research";
  }

  return "unknown";
}
