import { deliverDueReminders } from "@/features/reminders/service";

const jsonHeaders = {
  "Content-Type": "application/json",
};

function unauthorizedResponse() {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    status: 401,
    headers: jsonHeaders,
  });
}

function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    throw new Error("Missing required environment variable: CRON_SECRET");
  }

  return secret;
}

async function handleCronRequest(request: Request) {
  const authorizationHeader = request.headers.get("authorization");
  const cronSecret = getCronSecret();

  if (authorizationHeader !== `Bearer ${cronSecret}`) {
    return unauthorizedResponse();
  }

  try {
    const result = await deliverDueReminders(20);

    return new Response(
      JSON.stringify({
        ok: true,
        ...result,
      }),
      {
        status: 200,
        headers: jsonHeaders,
      }
    );
  } catch (error) {
    console.error("Reminder cron failed", { error });

    return new Response(JSON.stringify({ ok: false, error: "Reminder cron failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
}

export async function GET(request: Request) {
  return handleCronRequest(request);
}

export async function POST(request: Request) {
  return handleCronRequest(request);
}
