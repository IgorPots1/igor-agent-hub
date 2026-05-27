type OpsLogSignal = {
  detected: boolean;
  reason: string;
};

type OpsLogDetectionResult = {
  isOpsLog: boolean;
  reasons: string[];
};

const MIN_TEXT_LENGTH = 140;
const MIN_LINES_FOR_TERMINAL_DUMP = 10;
const MIN_COMMAND_LIKE_LINES = 6;
const MIN_PATH_LINES = 8;
const MIN_CSV_LINES = 4;
const MIN_JSON_BRACE_COUNT = 8;
const MIN_JSON_QUOTE_PAIRS = 12;

const GIT_DIFF_SIGNAL =
  /(diff --git\s+a\/|^@@\s|^\+\+\+\s|^---\s|index [0-9a-f]+\.\.[0-9a-f]+)/gim;
const GIT_COMMAND_SIGNAL =
  /(^|\n)\s*(git (status|add|commit|push|fetch|pull|merge|rebase|checkout|switch|branch|restore)\b)/i;
const BUILD_TOOL_SIGNAL =
  /(^|\n)\s*(?:[$>#]\s*)?((npm|pnpm|yarn)\s+(run\s+)?(build|lint|test|typecheck|check)\b|next build\b|tsc\b)/i;
const BUILD_OUTPUT_SIGNAL =
  /(Creating an optimized production build|Compiled successfully|Failed to compile|error Command failed|✖ \d+ problems)/i;
const LINT_OR_TS_SIGNAL =
  /(ESLint|TypeScript error|TS\d{3,5}|Failed to compile|error Command failed|Found \d+ (error|warning))/i;
const STACK_TRACE_SIGNAL =
  /(UnhandledPromiseRejection|uncaught exception|stack trace|Error:\s|ERR_MODULE_NOT_FOUND|fatal:\s|at .+\(.+\))/i;
const COMMAND_PROMPT_LINE = /^\s*(\$|>|#)\s+\S+/;
const PATH_LIKE_LINE = /^\s*(\.{0,2}\/|\/|[A-Za-z]:\\).+|^\s*[\w.-]+\/[\w./-]+/;
const CSV_HEADER_LINE = /^[\w.-]+(?:,[\w.\- ]+){2,}$/;
const CSV_DATA_LINE = /^[^,\n]+(?:,[^,\n]+){2,}$/;
const CODE_FENCE_BLOCK = /```[\s\S]{80,}?```/;

function normalizeText(rawText: string): string {
  return rawText.replace(/\r\n?/g, "\n").trim();
}

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

function detectGitDiff(text: string): OpsLogSignal {
  return {
    detected: GIT_DIFF_SIGNAL.test(text),
    reason: "git_diff_markers",
  };
}

function detectGitCommands(text: string): OpsLogSignal {
  return {
    detected: GIT_COMMAND_SIGNAL.test(text),
    reason: "git_command_transcript",
  };
}

function detectBuildLogs(text: string): OpsLogSignal {
  return {
    detected: BUILD_TOOL_SIGNAL.test(text) && (LINT_OR_TS_SIGNAL.test(text) || BUILD_OUTPUT_SIGNAL.test(text)),
    reason: "build_or_lint_output",
  };
}

function detectStackTrace(text: string): OpsLogSignal {
  return {
    detected: STACK_TRACE_SIGNAL.test(text),
    reason: "stack_trace_or_runtime_error",
  };
}

function detectLongTerminalTranscript(text: string, lines: string[]): OpsLogSignal {
  if (lines.length < MIN_LINES_FOR_TERMINAL_DUMP) {
    return { detected: false, reason: "long_terminal_transcript" };
  }

  const commandLikeLines = lines.filter(
    (line) =>
      COMMAND_PROMPT_LINE.test(line) ||
      /^(git|npm|pnpm|yarn|node|npx|tsc|eslint|next|docker|kubectl)\b/.test(line.trim())
  ).length;

  return {
    detected: commandLikeLines >= MIN_COMMAND_LIKE_LINES,
    reason: "long_terminal_transcript",
  };
}

function detectJsonDump(text: string): OpsLogSignal {
  const braceCount = (text.match(/[{}]/g) ?? []).length;
  const quoteCount = (text.match(/"/g) ?? []).length;
  const newlineCount = (text.match(/\n/g) ?? []).length;
  const keyValueCount = (text.match(/"\w[\w.-]*"\s*:/g) ?? []).length;

  return {
    detected:
      braceCount >= MIN_JSON_BRACE_COUNT &&
      quoteCount >= MIN_JSON_QUOTE_PAIRS &&
      keyValueCount >= 6 &&
      newlineCount >= 4,
    reason: "json_dump",
  };
}

function detectCsvDump(lines: string[]): OpsLogSignal {
  if (lines.length < MIN_CSV_LINES) {
    return { detected: false, reason: "csv_dump" };
  }

  const headerLine = lines[0]?.trim() ?? "";
  const csvRows = lines.filter((line) => CSV_DATA_LINE.test(line.trim())).length;

  return {
    detected: CSV_HEADER_LINE.test(headerLine) && csvRows >= MIN_CSV_LINES - 1,
    reason: "csv_dump",
  };
}

function detectFileList(lines: string[]): OpsLogSignal {
  if (lines.length < MIN_PATH_LINES) {
    return { detected: false, reason: "file_list_dump" };
  }

  const pathLines = lines.filter((line) => PATH_LIKE_LINE.test(line)).length;

  return {
    detected: pathLines >= MIN_PATH_LINES,
    reason: "file_list_dump",
  };
}

function detectCodeOrLogBlock(text: string): OpsLogSignal {
  if (!CODE_FENCE_BLOCK.test(text)) {
    return { detected: false, reason: "machine_output_block" };
  }

  const machineMarkers = [
    "npm ERR!",
    "error TS",
    "eslint",
    "diff --git",
    "stack trace",
    "at ",
    "ERR_MODULE_NOT_FOUND",
  ];
  const markerHits = machineMarkers.filter((marker) => text.includes(marker)).length;

  return {
    detected: markerHits >= 2,
    reason: "machine_output_block",
  };
}

export function detectBrainItemOpsLog(rawText: string): OpsLogDetectionResult {
  const normalizedText = normalizeText(rawText);

  if (!normalizedText || normalizedText.length < MIN_TEXT_LENGTH) {
    return { isOpsLog: false, reasons: [] };
  }

  const lines = splitLines(normalizedText);
  const checks: OpsLogSignal[] = [
    detectGitDiff(normalizedText),
    detectGitCommands(normalizedText),
    detectBuildLogs(normalizedText),
    detectStackTrace(normalizedText),
    detectLongTerminalTranscript(normalizedText, lines),
    detectJsonDump(normalizedText),
    detectCsvDump(lines),
    detectFileList(lines),
    detectCodeOrLogBlock(normalizedText),
  ];

  const reasons = checks.filter((check) => check.detected).map((check) => check.reason);

  return {
    isOpsLog: reasons.length > 0,
    reasons,
  };
}
