// Stand-in for the OpenAI Responses API during E2E runs.
//
// The Next.js server calls OpenAI from the server, where Playwright can't
// intercept requests, so the E2E web server gets OPENAI_BASE_URL pointing
// here (the SDK reads it automatically). The reply echoes the movie title,
// so tests can check the fact belongs to the right movie. No real OpenAI
// calls, no cost, no flakiness from model output or rate limits.
import http from "node:http";

const port = Number(process.env.MOCK_OPENAI_PORT ?? 3199);

http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200).end("ok");
      return;
    }
    if (req.method !== "POST" || !req.url?.endsWith("/responses")) {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const { input = "", model } = JSON.parse(body || "{}");
      const title = /<movie_title>(.*?)<\/movie_title>/s.exec(input)?.[1] ?? "?";
      const text = `E2E fact about ${title}.`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: `resp_e2e_${Date.now()}`,
          object: "response",
          created_at: Math.floor(Date.now() / 1000),
          status: "completed",
          model,
          output: [
            {
              id: "msg_e2e",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text, annotations: [] }],
            },
          ],
        }),
      );
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`mock OpenAI on :${port}`));
