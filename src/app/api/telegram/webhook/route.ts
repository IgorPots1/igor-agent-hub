const jsonHeaders = {
  "Content-Type": "application/json",
};

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: jsonHeaders,
  });
}

export async function GET() {
  return okResponse();
}

export async function POST(request: Request) {
  let update: unknown = null;

  try {
    update = await request.json();
  } catch {
    console.warn("Telegram webhook received invalid JSON payload");
  }

  console.info("Telegram update received", update);
  return okResponse();
}
