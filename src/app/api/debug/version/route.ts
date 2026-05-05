const jsonHeaders = {
  "Content-Type": "application/json",
};

export async function GET() {
  return new Response(
    JSON.stringify({
      app: "second-brain",
      commit: "e99b248",
      branch: "main",
      marker: "second-brain-full-2026-05-05",
    }),
    {
      status: 200,
      headers: jsonHeaders,
    }
  );
}
