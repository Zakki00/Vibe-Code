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
  const kirim = (obj) => ws.send(JSON.stringify(obj));

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
    if (data.type === "reset") {
      sessionId = null;
      return;
    }

    const { prompt, cwd, model } = data;
    try {
      for await (const msg of query({
        prompt,
        options: {
          model: model || "Vibe_Code",
          cwd: cwd || PROJECT_DIR,
          includePartialMessages: true,
          resume: sessionId ?? undefined,
          allowedTools: ["Read", "Glob", "Grep"],
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
              kirim({ type: "izin", id, alat: namaAlat, input });
            }),
        },
      })) {
        if (msg.session_id) sessionId = msg.session_id;

        if (msg.type === "stream_event") {
          const ev = msg.event;
          if (ev.type === "content_block_start" && ev.content_block?.type === "thinking") {
            kirim({ type: "status", label: "Berpikir" });
          }
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            kirim({ type: "text", text: ev.delta.text });
          }
        }

        if (msg.type === "assistant") {
          for (const b of msg.message.content) {
            if (b.type === "tool_use") {
              kirim({ type: "tool", id: b.id, nama: b.name, input: b.input });
            }
          }
        }

        if (msg.type === "user" && Array.isArray(msg.message?.content)) {
          for (const b of msg.message.content) {
            if (b.type === "tool_result") {
              kirim({ type: "tool_result", id: b.tool_use_id, galat: !!b.is_error });
            }
          }
        }

        if (msg.type === "result") kirim({ type: "done" });
      }
    } catch (e) {
      kirim({ type: "error", message: String(e) });
    }
  });
});

server.listen(3000, () => {
  console.log("Buka http://localhost:3000");
  console.log("Folder kerja asisten:", PROJECT_DIR);
});
