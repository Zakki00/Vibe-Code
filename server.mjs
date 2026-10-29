import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = process.env.VIBE_PROJECT_DIR || process.cwd();

const app = express();
app.use(express.static(path.join(APP_DIR, "client", "dist")));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  let sessionId = null;
  const menunggu = new Map();

  ws.on("close", () => {
    for (const jawab of menunggu.values()) jawab(false);
  });

  ws.on("message", async (raw) => {
    const data = JSON.parse(raw);

    if (data.type === "izin") {
      menunggu.get(data.id)?.(data.izinkan);
      menunggu.delete(data.id);
      return;
    }

    const { prompt, cwd } = data;
    try {
      for await (const msg of query({
        prompt,
        options: {
          model: "Vibe_Code",
          cwd: cwd || PROJECT_DIR,
          includePartialMessages: true,
          resume: sessionId ?? undefined,
          canUseTool: (namaAlat, input) =>
            new Promise((selesai) => {
              const id = randomUUID();
              menunggu.set(id, (izinkan) =>
                selesai(
                  izinkan
                    ? { behavior: "allow", updatedInput: input }
                    : { behavior: "deny", message: "Ditolak oleh pengguna." },
                ),
              );
              ws.send(
                JSON.stringify({ type: "izin", id, alat: namaAlat, input }),
              );
            }),
        },
      })) {
        if (msg.session_id) sessionId = msg.session_id;

        if (
          msg.type === "stream_event" &&
          msg.event.type === "content_block_delta" &&
          msg.event.delta.type === "text_delta"
        ) {
          ws.send(JSON.stringify({ type: "text", text: msg.event.delta.text }));
        }
        if (msg.type === "result") ws.send(JSON.stringify({ type: "done" }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: String(e) }));
    }
  });
});

server.listen(3000, () => console.log("Buka http://localhost:3000"));
