import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

type Masukan = Record<string, unknown>;
type Item =
  | { k: "saya"; teks: string }
  | { k: "ai"; teks: string }
  | { k: "info"; teks: string }
  | { k: "sesi"; daftar: Sesi[]; aktif: string | null }
  | {
      k: "alat";
      id: string;
      nama: string;
      ringkas: string;
      detail: string;
      input: Masukan;
      selesai: boolean;
      galat: boolean;
    };
type Sesi = { id: string; judul: string; waktu: string };
type Izin = { id: string; alat: string; input: Masukan };

const KATA = ["Memahami pertanyaan", "Memproses", "Menyusun jawaban"];

const PERINTAH = [
  { nama: "/help", ket: "Tampilkan daftar perintah" },
  { nama: "/new", ket: "Mulai sesi baru (riwayat lama tetap tersimpan)" },
  { nama: "/clear", ket: "Sama seperti /new" },
  { nama: "/resume", ket: "Pilih dan lanjutkan sesi lama di folder ini" },
  { nama: "/model", ket: "Lihat atau ganti model, contoh: /model kr/deepseek-3.2" },
  { nama: "/project", ket: "Lihat atau ganti folder proyek, contoh: /project D:\\proyek" },
  { nama: "/memory", ket: "Info file CLAUDE.md (ingatan proyek) di folder ini" },
];

const MAKS_TINGGI_INPUT = 260; // sekitar 10 baris

type Simpanan = Array<Record<string, unknown>>;
const pulihkan = (daftar: Simpanan): Item[] =>
  daftar.map((x) =>
    x.k === "alat"
      ? ({ ...x, ...ringkasAlat(String(x.nama), x.input as Masukan) } as Item)
      : (x as Item),
  );

const waktuSingkat = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

const str = (v: unknown) => (typeof v === "string" ? v : "");
const namaFile = (p: string) => p.split(/[\\/]/).pop() || p;

function ringkasAlat(nama: string, input: Masukan) {
  const f = str(input.file_path);
  switch (nama) {
    case "Read":
      return { ringkas: `Membaca ${namaFile(f)}`, detail: f };
    case "Write":
      return { ringkas: `Menulis ${namaFile(f)}`, detail: f };
    case "Edit":
      return { ringkas: `Mengubah ${namaFile(f)}`, detail: f };
    case "Glob":
      return { ringkas: "Mencari file", detail: str(input.pattern) };
    case "Grep":
      return { ringkas: "Mencari teks", detail: str(input.pattern) };
    case "Bash":
      return { ringkas: "Menjalankan perintah", detail: str(input.command) };
    default:
      return { ringkas: nama, detail: "" };
  }
}

// Tailwind menghapus gaya bawaan HTML, jadi tampilan Markdown perlu diatur manual.
const markdownKomponen: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>,
  h1: ({ children }) => <h1 className="mb-2 mt-4 text-xl font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-3 font-semibold">{children}</h3>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-orange-400 underline">
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 scroll-halus overflow-auto rounded-lg bg-neutral-950 p-3 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-neutral-700 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
};

function Diff({ lama, baru }: { lama: string; baru: string }) {
  const baris = (t: string) => (t === "" ? [] : t.split("\n"));
  return (
    <div className="scroll-halus max-h-72 overflow-auto rounded-lg bg-neutral-950 font-mono text-xs">
      {baris(lama).map((b, i) => (
        <div key={"l" + i} className="whitespace-pre-wrap bg-red-950 px-3 text-red-200">
          - {b}
        </div>
      ))}
      {baris(baru).map((b, i) => (
        <div key={"b" + i} className="whitespace-pre-wrap bg-green-950 px-3 text-green-200">
          + {b}
        </div>
      ))}
    </div>
  );
}

function IsiAlat({ nama, input }: { nama: string; input: Masukan }) {
  if (nama === "Edit") return <Diff lama={str(input.old_string)} baru={str(input.new_string)} />;
  if (nama === "Write") return <Diff lama="" baru={str(input.content)} />;
  const teks = nama === "Bash" ? str(input.command) : JSON.stringify(input, null, 2);
  return (
    <pre className="scroll-halus max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-950 p-3 font-mono text-xs">
      {teks}
    </pre>
  );
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [izin, setIzin] = useState<Izin | null>(null);
  const [status, setStatus] = useState("");
  const [detik, setDetik] = useState(0);
  const [model, setModel] = useState("Vibe_Code");
  const [daftarModel, setDaftarModel] = useState<string[]>([]);
  const [projectPath, setProjectPath] = useState("");
  const [aplikasiSendiri, setAplikasiSendiri] = useState(false);
  const [terhubung, setTerhubung] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const bawah = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const info = useCallback(
    (teks: string) => setItems((p) => [...p, { k: "info", teks }]),
    [],
  );

  const kirimWs = useCallback((obj: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(obj));
  }, []);

  useEffect(() => {
    let tutup = false;
    let timer: number | undefined;

    function sambung() {
      const s = new WebSocket(`ws://${location.host}/ws`);
      ws.current = s;
      s.onopen = () => setTerhubung(true);
      s.onclose = () => {
        setTerhubung(false);
        setSibuk(false);
        setIzin(null);
        if (!tutup) timer = window.setTimeout(sambung, 1500);
      };
      s.onmessage = (e) => {
        const m = JSON.parse(e.data as string);

        if (m.type === "init") {
          setProjectPath(m.project);
          setDaftarModel(m.models ?? []);
          setAplikasiSendiri(!!m.aplikasiSendiri);
        }
        if (m.type === "riwayat") {
          // Dikirim server saat tersambung, ganti proyek, atau melanjutkan sesi.
          const dipulihkan = pulihkan(m.items ?? []);
          setItems(m.pesan ? [...dipulihkan, { k: "info", teks: m.pesan }] : dipulihkan);
          setStatus("");
        }
        if (m.type === "text") {
          setStatus("");
          setItems((p) => {
            const akhir = p[p.length - 1];
            if (akhir?.k === "ai")
              return [...p.slice(0, -1), { k: "ai", teks: akhir.teks + m.text }];
            return [...p, { k: "ai", teks: m.text }];
          });
        }
        if (m.type === "status") setStatus(m.label);
        if (m.type === "tool") {
          setStatus("");
          const r = ringkasAlat(m.nama, m.input);
          setItems((p) => [
            ...p,
            { k: "alat", id: m.id, nama: m.nama, input: m.input, ...r, selesai: false, galat: false },
          ]);
        }
        if (m.type === "tool_result") {
          setItems((p) =>
            p.map((x) =>
              x.k === "alat" && x.id === m.id ? { ...x, selesai: true, galat: !!m.galat } : x,
            ),
          );
        }
        if (m.type === "izin") setIzin({ id: m.id, alat: m.alat, input: m.input });
        if (m.type === "done") {
          setSibuk(false);
          setStatus("");
          setIzin(null);
        }
        if (m.type === "error") {
          info("[error] " + m.message);
          setSibuk(false);
          setStatus("");
        }
        if (m.type === "command_result") {
          const d = m.data;
          if (m.command === "memory_info")
            info(
              d.ada
                ? `CLAUDE.md: ${d.baris} baris, ${d.kb} KB (dibaca otomatis oleh asisten)\n${d.path}`
                : `Belum ada CLAUDE.md di folder ini.\nBuat file itu untuk menyimpan ingatan proyek: teknologi yang dipakai, aturan, dan keputusan penting.`,
            );
          if (m.command === "project_current") info(`Folder proyek: ${d.path}`);
          if (m.command === "project_change") {
            if (d.success) {
              setProjectPath(d.path);
              setAplikasiSendiri(!!d.aplikasiSendiri);
            } else info(d.sibuk ? "Tunggu asisten selesai dulu." : "Gagal: folder tidak ditemukan.");
          }
          if (m.command === "session_list") {
            if (d.daftar.length === 0) info("Belum ada sesi tersimpan di folder ini.");
            else setItems((p) => [...p, { k: "sesi", daftar: d.daftar, aktif: d.aktif }]);
          }
          if (m.command === "session_resume" && !d.success)
            info(d.sibuk ? "Tunggu asisten selesai dulu." : "Sesi tidak ditemukan.");
        }
      };
    }

    sambung();
    return () => {
      tutup = true;
      window.clearTimeout(timer);
      ws.current?.close();
    };
  }, [info]);

  useEffect(() => {
    if (!sibuk) return;
    const awal = Date.now();
    setDetik(0);
    const t = setInterval(() => setDetik(Math.floor((Date.now() - awal) / 1000)), 1000);
    return () => clearInterval(t);
  }, [sibuk]);

  useEffect(() => {
    bawah.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, izin, status]);

  useEffect(() => {
    if (!sibuk) inputRef.current?.focus();
  }, [sibuk]);

  // Kolom input melebar ke atas mengikuti isi, sampai batas sekitar 10 baris, lalu bisa digulir.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAKS_TINGGI_INPUT) + "px";
  }, [input]);

  const terakhir = items[items.length - 1];
  let label = "";
  if (sibuk) {
    if (izin) label = "Menunggu izin Anda";
    else if (terakhir?.k === "alat" && !terakhir.selesai) label = terakhir.ringkas;
    else if (status) label = status;
    else if (terakhir?.k === "ai") label = "Menulis jawaban";
    else label = KATA[Math.floor(detik / 2) % KATA.length];
  }

  const saran =
    input.startsWith("/") && !input.includes(" ")
      ? PERINTAH.filter((p) => p.nama.startsWith(input.toLowerCase()))
      : [];

  function perintah(teks: string) {
    const [nama, ...sisa] = teks.trim().split(/\s+/);
    const arg = sisa.join(" ");
    switch (nama.toLowerCase()) {
      case "/new":
      case "/clear":
        setItems([]);
        kirimWs({ type: "reset" });
        break;
      case "/resume":
        kirimWs({ type: "command", command: "session_list" });
        break;
      case "/model":
        if (arg) {
          setModel(arg);
          info(`Model diganti ke: ${arg}`);
        } else {
          info(`Model saat ini: ${model}\nTersedia: ${daftarModel.join(", ")}`);
        }
        break;
      case "/project":
        kirimWs(
          arg
            ? { type: "command", command: "project_change", arg }
            : { type: "command", command: "project_current" },
        );
        break;
      case "/memory":
        kirimWs({ type: "command", command: "memory_info" });
        break;
      case "/help":
        info(PERINTAH.map((p) => `${p.nama}  -  ${p.ket}`).join("\n"));
        break;
      default:
        info(`Perintah tidak dikenal: ${nama}. Ketik /help untuk daftar perintah.`);
    }
  }

  function kirim() {
    const teks = input.trim();
    if (!teks || sibuk) return;
    setInput("");
    if (teks.startsWith("/")) {
      perintah(teks);
      return;
    }
    setItems((p) => [...p, { k: "saya", teks }]);
    kirimWs({ prompt: teks, model });
    setStatus("");
    setSibuk(true);
  }

  function berhenti() {
    kirimWs({ type: "stop" });
  }

  function jawabIzin(izinkan: boolean) {
    if (!izin) return;
    kirimWs({ type: "izin", id: izin.id, izinkan });
    setIzin(null);
  }

  function tekan(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab" && saran.length > 0) {
      e.preventDefault();
      setInput(saran[0].nama + " ");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (saran.length > 0 && !PERINTAH.some((p) => p.nama === input.trim())) {
        setInput(saran[0].nama + " ");
        return;
      }
      kirim();
    }
  }

  return (
    <div
      className="flex h-full flex-col bg-neutral-900 text-[15px] leading-relaxed text-neutral-100"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif' }}
    >
      <header className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
        <span className="text-base font-semibold tracking-tight">Vibe Code</span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-500"
          title={projectPath}
        >
          {projectPath}
        </span>
        <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 font-mono text-xs text-neutral-300">
          {model}
        </span>
        <span
          className={"h-2 w-2 rounded-full " + (terhubung ? "bg-green-500" : "bg-red-500")}
          title={terhubung ? "Terhubung" : "Terputus"}
        />
      </header>

      {!terhubung && (
        <div className="bg-red-950 px-4 py-1.5 text-sm text-red-200">
          Terputus dari server, mencoba menyambung kembali...
        </div>
      )}
      {aplikasiSendiri && (
        <div className="bg-yellow-950 px-4 py-1.5 text-sm text-yellow-200">
          Folder kerja adalah folder aplikasi ini sendiri. Jika asisten mengubah file di sini,
          halaman bisa dimuat ulang dan percakapan terputus.
        </div>
      )}

      <main className="tanpa-scrollbar flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {items.length === 0 && (
            <div className="pt-16 text-center text-neutral-500">
              Tanyakan sesuatu tentang proyek Anda, atau ketik / untuk melihat perintah.
            </div>
          )}
          {items.map((m, i) => {
            if (m.k === "saya")
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-orange-600 px-4 py-2">
                    {m.teks}
                  </div>
                </div>
              );
            if (m.k === "ai")
              return (
                <div key={i} className="min-w-0 text-neutral-200">
                  <ReactMarkdown components={markdownKomponen}>{m.teks}</ReactMarkdown>
                </div>
              );
            if (m.k === "info")
              return (
                <div key={i} className="whitespace-pre-wrap text-sm italic text-neutral-400">
                  {m.teks}
                </div>
              );
            if (m.k === "sesi")
              return (
                <div key={i} className="space-y-1">
                  <div className="text-sm text-neutral-400">Pilih sesi untuk dilanjutkan:</div>
                  <div className="overflow-hidden rounded-xl border border-neutral-700">
                    {m.daftar.map((s) => (
                      <button
                        key={s.id}
                        onClick={() =>
                          kirimWs({ type: "command", command: "session_resume", arg: s.id })
                        }
                        className={
                          "flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-neutral-800 " +
                          (s.id === m.aktif ? "bg-neutral-800" : "")
                        }
                      >
                        <span className="truncate">{s.judul}</span>
                        <span className="shrink-0 text-xs text-neutral-500">
                          {s.id === m.aktif ? "sesi ini  ·  " : ""}
                          {waktuSingkat(s.waktu)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            return (
              <div key={i} className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "h-2.5 w-2.5 rounded-full " +
                      (m.galat
                        ? "bg-red-500"
                        : m.selesai
                          ? "bg-green-500"
                          : "animate-pulse bg-neutral-400")
                    }
                  />
                  <span className="font-semibold">{m.ringkas}</span>
                </div>
                {m.detail && (
                  <div className="ml-1 break-all pl-4 font-mono text-xs text-neutral-500">
                    └ {m.detail}
                  </div>
                )}
                {m.selesai && !m.galat && (m.nama === "Edit" || m.nama === "Write") && (
                  <div className="pl-4">
                    <IsiAlat nama={m.nama} input={m.input} />
                  </div>
                )}
              </div>
            );
          })}

          {izin && (
            <div className="space-y-3 rounded-2xl border border-yellow-600 bg-neutral-800 p-4">
              <div className="font-semibold text-yellow-400">
                Claude meminta izin memakai alat: {izin.alat}
              </div>
              {str(izin.input.file_path) && (
                <div className="break-all font-mono text-xs text-neutral-300">
                  {str(izin.input.file_path)}
                </div>
              )}
              <IsiAlat nama={izin.alat} input={izin.input} />
              <div className="flex gap-2">
                <button
                  onClick={() => jawabIzin(true)}
                  className="rounded-xl bg-green-600 px-4 py-2 hover:bg-green-500"
                >
                  Izinkan
                </button>
                <button
                  onClick={() => jawabIzin(false)}
                  className="rounded-xl bg-red-600 px-4 py-2 hover:bg-red-500"
                >
                  Tolak
                </button>
              </div>
            </div>
          )}

          {sibuk && (
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-600 border-t-orange-500" />
              <span>
                {label}... ({detik} dtk)
              </span>
            </div>
          )}
          <div ref={bawah} />
        </div>
      </main>

      <footer className="relative border-t border-neutral-800 p-3">
        {saran.length > 0 && (
          <div className="absolute inset-x-3 bottom-full mx-auto mb-2 max-w-3xl overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 shadow-lg">
            {saran.map((p) => (
              <button
                key={p.nama}
                onClick={() => {
                  setInput(p.nama + " ");
                  inputRef.current?.focus();
                }}
                className="flex w-full gap-3 px-4 py-2 text-left hover:bg-neutral-700"
              >
                <span className="w-24 shrink-0 font-mono text-orange-400">{p.nama}</span>
                <span className="text-sm text-neutral-300">{p.ket}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={tekan}
            rows={1}
            placeholder="Tanyakan sesuatu... (Enter kirim, Shift+Enter baris baru)"
            className="tanpa-scrollbar flex-1 resize-none overflow-y-auto rounded-xl bg-neutral-800 px-4 py-2 outline-none placeholder:text-neutral-500"
          />
          {sibuk ? (
            <button
              onClick={berhenti}
              className="rounded-xl bg-neutral-700 px-4 py-2 hover:bg-neutral-600"
            >
              Berhenti
            </button>
          ) : (
            <button
              onClick={kirim}
              disabled={!terhubung}
              className="rounded-xl bg-orange-600 px-4 py-2 hover:bg-orange-500 disabled:opacity-50"
            >
              Kirim
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
