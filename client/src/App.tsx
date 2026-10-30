import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Masukan = Record<string, unknown>;
type Item =
  | { k: "saya"; teks: string }
  | { k: "ai"; teks: string }
  | { k: "info"; teks: string }
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
type Izin = { id: string; alat: string; input: Masukan };

const KATA = ["Memahami pertanyaan", "Memproses", "Menyusun jawaban"];

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

function Diff({ lama, baru }: { lama: string; baru: string }) {
  const baris = (t: string) => (t === "" ? [] : t.split("\n"));
  return (
    <div className="max-h-72 overflow-auto rounded-lg bg-neutral-950 font-mono text-xs">
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
  if (nama === "Edit")
    return <Diff lama={str(input.old_string)} baru={str(input.new_string)} />;
  if (nama === "Write") return <Diff lama="" baru={str(input.content)} />;
  if (nama === "Bash")
    return (
      <pre className="max-h-48 overflow-auto rounded-lg bg-neutral-950 p-3 text-xs whitespace-pre-wrap">
        {str(input.command)}
      </pre>
    );
  return (
    <pre className="max-h-48 overflow-auto rounded-lg bg-neutral-950 p-3 text-xs whitespace-pre-wrap">
      {JSON.stringify(input, null, 2)}
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
  const ws = useRef<WebSocket | null>(null);
  const bawah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = new WebSocket(`ws://${location.host}/ws`);
    ws.current = s;
    s.onmessage = (e) => {
      const m = JSON.parse(e.data);
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
      }
      if (m.type === "error") {
        setItems((p) => [...p, { k: "info", teks: "[error] " + m.message }]);
        setSibuk(false);
        setStatus("");
      }
    };
    return () => s.close();
  }, []);

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

  const terakhir = items[items.length - 1];
  let label = "";
  if (sibuk) {
    if (izin) label = "Menunggu izin Anda";
    else if (terakhir?.k === "alat" && !terakhir.selesai) label = terakhir.ringkas;
    else if (status) label = status;
    else if (terakhir?.k === "ai") label = "Menulis jawaban";
    else label = KATA[Math.floor(detik / 2) % KATA.length];
  }

  function info(teks: string) {
    setItems((p) => [...p, { k: "info", teks }]);
  }

  function perintah(teks: string) {
    const [nama, ...sisa] = teks.trim().split(/\s+/);
    const arg = sisa.join(" ");
    if (nama === "/clear") {
      setItems([]);
      ws.current?.send(JSON.stringify({ type: "reset" }));
    } else if (nama === "/model") {
      if (arg) {
        setModel(arg);
        info(`Model diganti ke: ${arg}`);
      } else info(`Model saat ini: ${model}`);
    } else if (nama === "/help") {
      info("Perintah: /clear, /model [nama], /help");
    } else info(`Perintah tidak dikenal: ${nama}`);
  }

  function kirim() {
    if (!input.trim() || sibuk) return;
    if (input.startsWith("/")) {
      perintah(input);
      setInput("");
      return;
    }
    setItems((p) => [...p, { k: "saya", teks: input }]);
    ws.current?.send(JSON.stringify({ prompt: input, model }));
    setInput("");
    setStatus("");
    setSibuk(true);
  }

  function jawabIzin(izinkan: boolean) {
    if (!izin) return;
    ws.current?.send(JSON.stringify({ type: "izin", id: izin.id, izinkan }));
    setIzin(null);
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-900 text-neutral-100">
      <header className="px-4 py-3 border-b border-neutral-700 font-semibold">Vibe Code</header>
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
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
              <div key={i} className="flex">
                <div className="max-w-[85%] rounded-2xl bg-neutral-800 px-4 py-2">
                  <ReactMarkdown>{m.teks}</ReactMarkdown>
                </div>
              </div>
            );
          if (m.k === "info")
            return (
              <div key={i} className="text-sm italic text-neutral-400">
                {m.teks}
              </div>
            );
          return (
            <div key={i} className="max-w-[90%] space-y-1 text-sm">
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
                <div className="ml-1 break-all pl-4 font-mono text-xs text-neutral-400">
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
          <div className="max-w-[90%] space-y-3 rounded-2xl border border-yellow-600 bg-neutral-800 p-4">
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
              <button onClick={() => jawabIzin(true)} className="rounded-xl bg-green-600 px-4 py-2">
                Izinkan
              </button>
              <button onClick={() => jawabIzin(false)} className="rounded-xl bg-red-600 px-4 py-2">
                Tolak
              </button>
            </div>
          </div>
        )}

        {sibuk && (
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-600 border-t-orange-500" />
            <span>
              {label}… ({detik} dtk)
            </span>
          </div>
        )}
        <div ref={bawah} />
      </main>
      <footer className="flex gap-2 border-t border-neutral-700 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && kirim()}
          placeholder="Tanyakan sesuatu tentang proyek Anda..."
          className="flex-1 rounded-xl bg-neutral-800 px-4 py-2 outline-none"
        />
        <button
          onClick={kirim}
          disabled={sibuk}
          className="rounded-xl bg-orange-600 px-4 py-2 disabled:opacity-50"
        >
          Kirim
        </button>
      </footer>
    </div>
  );
}