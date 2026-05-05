import JSZip from "jszip";
import { getAllActiveBrainItems } from "@/features/brain/service";
import type { BrainItem } from "@/features/brain/types";

const ZIP_FILENAME = "obsidian-export.zip";
const MARKDOWN_EXTENSION = ".md";
const SLUG_MAX_LENGTH = 60;
const CATEGORY_MAX_LENGTH = 80;

export type ObsidianExportResult = {
  archive: Uint8Array<ArrayBufferLike>;
  fileCount: number;
  archiveName: string;
};

function toSafePathSegment(value: string, maxLength: number): string {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\p{Letter}\p{Number}\- ]+/gu, "")
    .replace(/ /g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

function getDatePrefix(createdAt: string): string {
  return createdAt.slice(0, 10);
}

function getSlugSource(item: BrainItem): string {
  return item.summary?.trim() || item.rawText.trim() || item.id;
}

function getSafeCategoryFolder(category: string): string {
  return toSafePathSegment(category, CATEGORY_MAX_LENGTH) || "Inbox";
}

function getSafeMarkdownFilename(item: BrainItem): string {
  const datePrefix = getDatePrefix(item.createdAt);
  const slug = toSafePathSegment(getSlugSource(item), SLUG_MAX_LENGTH) || item.id;
  const shortId = item.id.slice(0, 8);

  return `${datePrefix}-${slug}-${shortId}${MARKDOWN_EXTENSION}`;
}

function toYamlString(value: string | null): string {
  return value === null ? "null" : JSON.stringify(value);
}

function toFrontmatter(item: BrainItem): string {
  return [
    "---",
    `id: ${toYamlString(item.id)}`,
    `type: ${toYamlString(item.type)}`,
    `category: ${toYamlString(item.category)}`,
    `tags: ${JSON.stringify(item.tags)}`,
    `status: ${toYamlString(item.status)}`,
    `source: ${toYamlString(item.source)}`,
    `created_at: ${toYamlString(item.createdAt)}`,
    `summary: ${toYamlString(item.summary)}`,
    "---",
  ].join("\n");
}

function toMarkdownDocument(item: BrainItem): string {
  return `${toFrontmatter(item)}\n\n${item.rawText.trim()}\n`;
}

function getArchivePath(item: BrainItem): string {
  return `${getSafeCategoryFolder(item.category)}/${getSafeMarkdownFilename(item)}`;
}

export async function buildObsidianExportArchive(): Promise<ObsidianExportResult> {
  const items = await getAllActiveBrainItems();
  const zip = new JSZip();

  for (const item of items) {
    zip.file(getArchivePath(item), toMarkdownDocument(item));
  }

  const archive = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6,
    },
  });

  return {
    archive,
    fileCount: items.length,
    archiveName: ZIP_FILENAME,
  };
}
