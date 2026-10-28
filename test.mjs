import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const msg of query({
  prompt: "Balas dengan satu kalimat: halo dari Agent SDK.",
  options: { model: "Vibe_Code", maxTurns: 1 },
})) {
  if (msg.type === "assistant") {
    for (const b of msg.message.content) {
      if (b.type === "text") console.log(b.text);
    }
  }
  if (msg.type === "result") console.log("Selesai:", msg.subtype);
}
