import express from "express";
import http from "node:http";
import { WebSocketServer } from "ws";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
let PROJECT_DIR = process.env.VIBE_PROJECT_DIR || process.cwd();

const PORT = 3000;
const HOST = "127.0.0.1";
const MODEL_DEFAULT = "Vibe_Code";
// Sesuaikan dengan nama combo/model yang ada di dashboard 9Router Anda.
const DAFTAR_MODEL = [
  "Vibe_Code",
  "kr/claude-sonnet-4.5",
  "kr/claude-haiku-4.5",
  "kr/deepseek-3.2",
  "kr/qwen3-coder-next",
];

// ---------- Penyimpanan sesi (per proyek, di folder .vibe) ----------
// Isi percakapan untuk dilanjutkan disimpan sendiri oleh Claude Code (lewat ID sesi).
// Di sini kita hanya mencatat ID + judul sesi, dan riwayat tampilan (pesan & kartu alat).
const MAKS_SESI = 50;
const MAKS_ITEM = 300;
const MAKS_TEKS = 4000;

const folderVibe = () => path.join(PROJECT_DIR, ".vibe");
const fileSesi = () => path.join(folderVibe(), "sesi.json");
const fileRiwayat = (id) => path.join(folderVibe(), "riwayat", `${id}.json`);
const idAman = (id) => typeof id === "string" && /^[\w-]{1,64}$/.test(id);

async function bacaSesi() {
  try {
    const d = JSON.parse(await fs.readFile(fileSesi(), "utf-8"));
    return {
      terakhir: d.terakhir ?? null,
      daftar: Array.isArray(d.daftar) ? d.daftar : [],
    };
  } catch {
    return { terakhir: null, daftar: [] };
  }
}

async function tulisSesi(data) {
  await fs.mkdir(path.join(folderVibe(), "riwayat"), { recursive: true });
  await fs.writeFile(fileSesi(), JSON.stringify(data, null, 2), "utf-8");
}

async function catatSesi(id, judul) {
  if (!idAman(id)) return;
  const data = await bacaSesi();
  const ada = data.daftar.find((s) => s.id === id);
  if (ada) ada.waktu = new Date().toISOString();
  else data.daftar.push({ id, judul, waktu: new Date().toISOString() });
  while (data.daftar.length > MAKS_SESI) {
    const lama = data.daftar.shift();
    if (idAman(lama?.id)) await fs.unlink(fileRiwayat(lama.id)).catch(() => {});
  }
  data.terakhir = id;
  await tulisSesi(data);
}

async function bacaRiwayat(id) {
  if (!idAman(id)) return [];
  try {
    const d = JSON.parse(await fs.readFile(fileRiwayat(id), "utf-8"));
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

async function tulisRiwayat(id, items) {
  if (!idAman(id)) return;
  await fs.mkdir(path.join(folderVibe(), "riwayat"), { recursive: true });
  await fs.writeFile(
    fileRiwayat(id),
    JSON.stringify(items.slice(-MAKS_ITEM)),
    "utf-8",
  );
}

// Memotong isi yang terlalu panjang (misalnya file besar) agar riwayat tetap ringan.
function ringankan(input) {
  const hasil = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    hasil[k] =
      typeof v === "string" && v.length > MAKS_TEKS
        ? v.slice(0, MAKS_TEKS) + "\n... (dipotong)"
        : v;
  }
  return hasil;
}

async function infoClaudeMd() {
  const p = path.join(PROJECT_DIR, "CLAUDE.md");
  try {
    const isi = await fs.readFile(p, "utf-8");
    return {
      ada: true,
      path: p,
      baris: isi.split("\n").length,
      kb: Math.round(Buffer.byteLength(isi, "utf-8") / 1024),
    };
  } catch {
    return { ada: false, path: p, baris: 0, kb: 0 };
  }
}

async function gantiProject(jalur) {
  try {
    const abs = path.resolve(String(jalur || ""));
    const st = await fs.stat(abs);
    if (!st.isDirectory()) return false;
    PROJECT_DIR = abs;
    return true;
  } catch {
    return false;
  }
}

// ---------- Keamanan: hanya halaman dari komputer ini yang boleh tersambung ----------
function originAman(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

const app = express();
app.use(express.static(path.join(APP_DIR, "client", "dist")));
const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/ws",
  verifyClient: ({ origin }) => originAman(origin),
});

wss.on("connection", (ws) => {
  let sessionId = null;
  let judulSesi = "";
  let riwayat = [];
  let sedangJalan = null; // AbortController untuk permintaan yang sedang berjalan
  const menunggu = new Map();
  const kirim = (obj) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  };

  const tolakSemuaIzin = () => {
    for (const jawab of menunggu.values()) jawab(false);
    menunggu.clear();
  };

  async function muatSesiTerakhir(awalan = "") {
    const data = await bacaSesi();
    const sesi = data.daftar.find((s) => s.id === data.terakhir);
    if (sesi) {
      sessionId = sesi.id;
      judulSesi = sesi.judul;
      riwayat = await bacaRiwayat(sesi.id);
    } else {
      sessionId = null;
      judulSesi = "";
      riwayat = [];
    }
    const pesan = [
      awalan,
      sesi
        ? `Melanjutkan sesi terakhir: ${sesi.judul}\nKetik /new untuk sesi baru atau /resume untuk memilih sesi lain.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    kirim({ type: "riwayat", items: riwayat, pesan });
  }

  ws.on("close", () => {
    tolakSemuaIzin();
    sedangJalan?.abort();
  });

  kirim({
    type: "init",
    project: PROJECT_DIR,
    models: DAFTAR_MODEL,
    aplikasiSendiri: PROJECT_DIR === APP_DIR,
  });
  const siap = muatSesiTerakhir();

  ws.on("message", async (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    await siap;

    if (data.type === "izin") {
      menunggu.get(data.id)?.(!!data.izinkan);
      menunggu.delete(data.id);
      return;
    }

    if (data.type === "stop") {
      tolakSemuaIzin();
      sedangJalan?.abort();
      return;
    }

    if (data.type === "reset") {
      if (sedangJalan) return;
      sessionId = null;
      judulSesi = "";
      riwayat = [];
      const d = await bacaSesi();
      if (d.terakhir !== null) {
        d.terakhir = null;
        await tulisSesi(d).catch(() => {});
      }
      return;
    }

    if (data.type === "command") {
      const { command, arg } = data;
      const balas = (isi) =>
        kirim({ type: "command_result", command, data: isi });

      if (command === "memory_info") {
        balas(await infoClaudeMd());
      } else if (command === "project_current") {
        balas({ path: PROJECT_DIR });
      } else if (command === "session_list") {
        const d = await bacaSesi();
        balas({ daftar: [...d.daftar].reverse(), aktif: sessionId });
      } else if (command === "session_resume") {
        if (sedangJalan) return balas({ success: false, sibuk: true });
        const d = await bacaSesi();
        const sesi = d.daftar.find((s) => s.id === arg);
        if (!sesi) return balas({ success: false });
        sessionId = sesi.id;
        judulSesi = sesi.judul;
        riwayat = await bacaRiwayat(sesi.id);
        d.terakhir = sesi.id;
        await tulisSesi(d).catch(() => {});
        kirim({
          type: "riwayat",
          items: riwayat,
          pesan: `Melanjutkan sesi: ${sesi.judul}`,
        });
        balas({ success: true });
      } else if (command === "project_change") {
        if (sedangJalan) return balas({ success: false, sibuk: true });
        const success = await gantiProject(arg);
        balas({
          success,
          path: PROJECT_DIR,
          aplikasiSendiri: PROJECT_DIR === APP_DIR,
        });
        if (success)
          await muatSesiTerakhir(`Folder proyek diganti ke: ${PROJECT_DIR}`);
      }
      return;
    }

    // ---------- Pertanyaan baru ----------
    const { prompt, model } = data;
    if (typeof prompt !== "string" || !prompt.trim() || sedangJalan) return;

    const ac = new AbortController();
    sedangJalan = ac;
    if (!sessionId) judulSesi = prompt.trim().replace(/\s+/g, " ").slice(0, 60);
    riwayat.push({ k: "saya", teks: prompt.trim() });

    try {
      for await (const msg of query({
        prompt,
        options: {
          model: model || MODEL_DEFAULT,
          cwd: PROJECT_DIR,
          abortController: ac,
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
          if (
            ev.type === "content_block_start" &&
            ev.content_block?.type === "thinking"
          ) {
            kirim({ type: "status", label: "Berpikir" });
          }
          if (
            ev.type === "content_block_delta" &&
            ev.delta?.type === "text_delta"
          ) {
            const akhir = riwayat[riwayat.length - 1];
            if (akhir?.k === "ai") akhir.teks += ev.delta.text;
            else riwayat.push({ k: "ai", teks: ev.delta.text });
            kirim({ type: "text", text: ev.delta.text });
          }
        }

        if (msg.type === "assistant") {
          for (const b of msg.message.content) {
            if (b.type === "tool_use") {
              riwayat.push({
                k: "alat",
                id: b.id,
                nama: b.name,
                input: ringankan(b.input),
                selesai: false,
                galat: false,
              });
              kirim({ type: "tool", id: b.id, nama: b.name, input: b.input });
            }
          }
        }

        if (msg.type === "user" && Array.isArray(msg.message?.content)) {
          for (const b of msg.message.content) {
            if (b.type === "tool_result") {
              const t = riwayat.find(
                (x) => x.k === "alat" && x.id === b.tool_use_id,
              );
              if (t) {
                t.selesai = true;
                t.galat = !!b.is_error;
              }
              kirim({
                type: "tool_result",
                id: b.tool_use_id,
                galat: !!b.is_error,
              });
            }
          }
        }
      }
    } catch (e) {
      if (!ac.signal.aborted) {
        riwayat.push({ k: "info", teks: "[error] " + String(e) });
        kirim({ type: "error", message: String(e) });
      }
    } finally {
      sedangJalan = null;
      for (const x of riwayat) {
        if (x.k === "alat" && !x.selesai) {
          x.selesai = true;
          x.galat = true;
        }
      }
      if (sessionId) {
        try {
          await catatSesi(sessionId, judulSesi);
          await tulisRiwayat(sessionId, riwayat);
        } catch (e) {
          console.error("Gagal menyimpan sesi:", e.message);
        }
      }
      kirim({ type: "done" });
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Buka http://localhost:${PORT}`);
  console.log("Folder kerja asisten:", PROJECT_DIR);
});
