#!/usr/bin/env node
import { spawn, exec, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = process.env.VIBE_PROJECT_DIR || process.cwd();
const ALAMAT = process.env.VIBE_SERVER_ADDRESS || "http://localhost:3000";
const ALAMAT_ROUTER = "http://localhost:20128";
const ALAMAT_TAMPILAN = "http://localhost:5173";
const proses = [];

async function aktif(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function tunggu(url, detik) {
  for (let i = 0; i < detik * 2; i++) {
    if (await aktif(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function jalankanServer(nama, perintah, cwd, env = {}) {
  const p = spawn(perintah, {
    shell: true,
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "inherit", "inherit"],
  });
  p.on("exit", (kode) => console.log(`${nama} keluar dengan kode ${kode}`));
  proses.push(p);
  return p;
}

function hentikanSemuaServer() {
  for (const p of proses) {
    if (p.pid) {
      try {
        execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: "ignore" });
      } catch {}
    }
  }
}

process.on("exit", hentikanSemuaServer);
for (const sinyal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(sinyal, () => process.exit(0));
}

if (await aktif(ALAMAT)) {
  console.log(`Server sudah berjalan di ${ALAMAT}`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn(
    "Peringatan: ANTHROPIC_AUTH_TOKEN belum diatur, jawaban kemungkinan gagal.",
  );
}

if (await aktif(ALAMAT_ROUTER)) {
  console.log("9Router sudah menyala.");
} else {
  console.log("Menyalakan 9Router di latar belakang...");
  spawn("9router --tray --no-browser --skip-update", {
    shell: true,
    stdio: "ignore",
    detached: true,
    windowsHide: true,
  }).unref();
  if (!(await tunggu(ALAMAT_ROUTER, 30))) {
    console.error(
      "9Router tidak merespons. Coba nyalakan manual dengan perintah: 9router",
    );
    process.exit(1);
  }
}

console.log("Folder proyek: " + PROJECT_DIR);
jalankanServer("backend", "node server.mjs", APP_DIR, {
  VIBE_PROJECT_DIR: PROJECT_DIR,
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || ALAMAT_ROUTER,
});

if (!(await tunggu(ALAMAT, 20))) {
  console.error("Backend tidak merespons. Periksa pesan error di atas.");
}

jalankanServer("tampilan", "npm run dev", path.join(APP_DIR, "client"));

if (await tunggu(ALAMAT_TAMPILAN, 20)) {
  exec(`start msedge --app=${ALAMAT_TAMPILAN}`);
}
console.log(`Tampilan: ${ALAMAT_TAMPILAN}  |  Backend: ${ALAMAT}`);
console.log("Tekan Ctrl+C untuk menghentikan backend dan tampilan.");
