import JSZip from "jszip";
import { getAllActiveKnowledgeBrainItems } from "@/features/brain/service";
import { getArchivePath, toMarkdownDocument } from "@/features/obsidian-export/formatter";

const ZIP_FILENAME = "obsidian-export.zip";

export type ObsidianExportResult = {
  archive: Uint8Array<ArrayBufferLike>;
  fileCount: number;
  archiveName: string;
};

export async function buildObsidianExportArchive(): Promise<ObsidianExportResult> {
  const items = await getAllActiveKnowledgeBrainItems();
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
