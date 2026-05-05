import { buildObsidianExportArchive } from "@/features/obsidian-export/service";

export const runtime = "nodejs";

const jsonHeaders = {
  "Content-Type": "application/json",
};

function unauthorizedResponse() {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    status: 401,
    headers: jsonHeaders,
  });
}

function exportFailedResponse() {
  return new Response(JSON.stringify({ ok: false, error: "Obsidian export failed" }), {
    status: 500,
    headers: jsonHeaders,
  });
}

function getExportSecret(): string {
  const secret = process.env.EXPORT_SECRET;

  if (!secret) {
    throw new Error("Missing required environment variable: EXPORT_SECRET");
  }

  return secret;
}

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get("authorization");
    const exportSecret = getExportSecret();

    if (authorizationHeader !== `Bearer ${exportSecret}`) {
      return unauthorizedResponse();
    }

    const result = await buildObsidianExportArchive();
    const archiveBody = Buffer.from(result.archive);

    return new Response(archiveBody, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.archiveName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Obsidian export failed", { error });
    return exportFailedResponse();
  }
}
