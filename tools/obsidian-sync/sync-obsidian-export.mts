import { cp, mkdir, mkdtemp, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import JSZip from "jszip";

const DEFAULT_TARGET_FOLDER = "Second Brain";
const ZIP_SIGNATURE = "PK";

type SyncConfig = {
  exportSecret: string;
  exportUrl: string;
  targetFolder: string;
  targetPath: string;
  vaultPath: string;
};

function log(message: string) {
  console.log(`[obsidian-sync] ${message}`);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function assertSafeTargetPath(vaultPath: string, targetPath: string) {
  const relativeTargetPath = relative(vaultPath, targetPath);

  if (
    relativeTargetPath === "" ||
    relativeTargetPath === "." ||
    relativeTargetPath.startsWith("..") ||
    isAbsolute(relativeTargetPath)
  ) {
    throw new Error("OBSIDIAN_TARGET_FOLDER must resolve to a folder inside the vault");
  }
}

async function loadConfig(): Promise<SyncConfig> {
  const exportUrl = getRequiredEnv("OBSIDIAN_EXPORT_URL");
  const exportSecret = getRequiredEnv("EXPORT_SECRET");
  const rawVaultPath = getRequiredEnv("OBSIDIAN_VAULT_PATH");
  const targetFolder = process.env.OBSIDIAN_TARGET_FOLDER?.trim() || DEFAULT_TARGET_FOLDER;

  if (!(await pathExists(rawVaultPath))) {
    throw new Error(`Obsidian vault path does not exist: ${rawVaultPath}`);
  }

  const vaultStats = await stat(rawVaultPath);

  if (!vaultStats.isDirectory()) {
    throw new Error(`Obsidian vault path is not a directory: ${rawVaultPath}`);
  }

  const vaultPath = await realpath(rawVaultPath);
  const targetPath = resolve(vaultPath, targetFolder);
  assertSafeTargetPath(vaultPath, targetPath);

  return {
    exportSecret,
    exportUrl,
    targetFolder,
    targetPath,
    vaultPath,
  };
}

function isZipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer.subarray(0, 2).toString("utf8") === ZIP_SIGNATURE;
}

async function downloadArchive(config: SyncConfig, zipPath: string): Promise<Buffer> {
  log(`Downloading export from ${config.exportUrl}`);

  const response = await fetch(config.exportUrl, {
    headers: {
      authorization: `Bearer ${config.exportSecret}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Export request failed with status ${response.status}`);
  }

  const archiveBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";
  const looksLikeZip = contentType.includes("zip") || isZipBuffer(archiveBuffer);

  if (!looksLikeZip) {
    throw new Error(`Export response is not a ZIP (content-type: ${contentType || "unknown"})`);
  }

  await writeFile(zipPath, archiveBuffer);
  return archiveBuffer;
}

function toSafeRelativePath(entryName: string): string | null {
  const normalized = entryName.replaceAll("\\", "/");

  if (!normalized || normalized === "/") {
    return null;
  }

  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Unsafe zip entry path: ${entryName}`);
  }

  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  for (const part of parts) {
    if (part === "." || part === "..") {
      throw new Error(`Unsafe zip entry path: ${entryName}`);
    }
  }

  return parts.join("/");
}

async function extractArchive(archiveBuffer: Buffer, extractPath: string): Promise<{ fileCount: number; markdownCount: number }> {
  const zip = await JSZip.loadAsync(archiveBuffer);
  let fileCount = 0;
  let markdownCount = 0;

  for (const entry of Object.values(zip.files)) {
    const safeRelativePath = toSafeRelativePath(entry.name);

    if (!safeRelativePath) {
      continue;
    }

    const outputPath = join(extractPath, safeRelativePath);

    if (entry.dir) {
      await mkdir(outputPath, { recursive: true });
      continue;
    }

    const outputDir = dirname(outputPath);
    await mkdir(outputDir, { recursive: true });

    const content = await entry.async("nodebuffer");
    await writeFile(outputPath, content);

    fileCount += 1;
    if (safeRelativePath.toLowerCase().endsWith(".md")) {
      markdownCount += 1;
    }
  }

  return { fileCount, markdownCount };
}

async function listTopLevelEntries(path: string): Promise<string[]> {
  const dirEntries = await readdir(path, { withFileTypes: true });
  return dirEntries.map((entry) => entry.name).sort((left, right) => left.localeCompare(right));
}

async function stageExtractedFiles(extractPath: string, stagingPath: string) {
  await rm(stagingPath, { recursive: true, force: true });
  await cp(extractPath, stagingPath, {
    force: false,
    recursive: true,
  });
}

async function swapManagedFolder(targetPath: string, stagingPath: string) {
  const targetExists = await pathExists(targetPath);
  const backupPath = `${targetPath}.backup`;

  if (!targetExists) {
    await rename(stagingPath, targetPath);
    return;
  }

  await rm(backupPath, { recursive: true, force: true });
  await rename(targetPath, backupPath);

  try {
    await rename(stagingPath, targetPath);
  } catch (error) {
    await rm(targetPath, { recursive: true, force: true });
    await rename(backupPath, targetPath);
    throw error;
  }
}

async function syncObsidianExport() {
  const config = await loadConfig();
  const tempRoot = await mkdtemp(join(tmpdir(), "obsidian-sync-"));
  const zipPath = join(tempRoot, "obsidian-export.zip");
  const extractPath = join(tempRoot, "extracted");
  const targetParentPath = dirname(config.targetPath);
  const stagingPath = join(
    targetParentPath,
    `.${basename(config.targetPath)}.staging-${Date.now()}`
  );

  await mkdir(extractPath, { recursive: true });
  await mkdir(targetParentPath, { recursive: true });

  try {
    const archiveBuffer = await downloadArchive(config, zipPath);
    const { fileCount, markdownCount } = await extractArchive(archiveBuffer, extractPath);

    if (fileCount === 0 || markdownCount === 0) {
      throw new Error("Extracted export is empty or contains no Markdown files");
    }

    const topLevelEntries = await listTopLevelEntries(extractPath);
    await stageExtractedFiles(extractPath, stagingPath);
    await swapManagedFolder(config.targetPath, stagingPath);

    log(`Synced ${markdownCount} Markdown files into ${config.targetFolder}`);
    if (topLevelEntries.length > 0) {
      log(`Top-level entries: ${topLevelEntries.join(", ")}`);
    }
  } finally {
    await rm(stagingPath, { recursive: true, force: true }).catch(() => undefined);
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

try {
  await syncObsidianExport();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown sync error";
  console.error(`[obsidian-sync] ${message}`);
  process.exitCode = 1;
}
