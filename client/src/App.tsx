import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

type Masukan = Record<string, unknown>;
type Lampiran = {
  nama: string;
  tipe: string;
  data: string;
  pratinjau?: string;
};
type Item =
  | { k: "saya"; teks: string; lampiran?: string[] }
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
type Sesi = { id: string; judul: string; waktu: string };
type Izin = { id: string; alat: string; input: Masukan };

const KATA = ["Memahami pertanyaan", "Memproses", "Menyusun jawaban"];
const DAFTAR_EFFORT = ["low", "medium", "high", "xhigh"];

const MAKS_BYTE = 10 * 1024 * 1024;
const MAKS_LAMPIRAN = 5;
const TIPE_GAMBAR = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const BATAS_PANJANG_PESAN = 200; // batas untuk "Tampilkan Lebih Banyak"

const bacaBerkas = (f: File) =>
  new Promise<Lampiran>((ok, gagal) => {
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      ok({
        nama: f.name || "gambar.png",
        tipe: f.type,
        data: url.split(",")[1] ?? "",
        pratinjau: TIPE_GAMBAR.includes(f.type) ? url : undefined,
      });
    };
    r.onerror = () => gagal(r.error);
    r.readAsDataURL(f);
  });

const PERINTAH = [
  { nama: "/help", ket: "Tampilkan daftar perintah" },
  { nama: "/new", ket: "Mulai sesi baru (riwayat lama tetap tersimpan)" },
  { nama: "/clear", ket: "Sama seperti /new" },
  { nama: "/effort", ket: "Lihat atau ganti effort, contoh: /effort medium" },
  { nama: "/resume", ket: "Pilih dan lanjutkan sesi lama di folder ini" },
  {
    nama: "/model",
    ket: "Lihat atau ganti model, contoh: /model kr/deepseek-3.2",
  },
  {
    nama: "/project",
    ket: "Lihat atau ganti folder proyek, contoh: /project D:\\proyek",
  },
  {
    nama: "/memory",
    ket: "Info file CLAUDE.md (ingatan proyek) di folder ini",
  },
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
  new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const str = (v: unknown) => (typeof v === "string" ? v : "");
const namaFile = (p: string) => p.split(/[\\/]/).pop() || p;

// Component untuk render thinking blocks
function RenderWithThinking({ teks }: { teks: string }) {
  const parts = teks.split(/(<thinking>[\s\S]*?<\/thinking>)/);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("<thinking>")) {
          const content = part
            .replace(/<thinking>/g, "")
            .replace(/<\/thinking>/g, "")
            .trim();
          return (
            <div
              key={i}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-xs text-neutral-400"
            >
              <div className="mb-1 font-semibold text-neutral-500">
                💭 Thinking
              </div>
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          );
        }
        return (
          <div key={i}>
            <ReactMarkdown components={markdownKomponen}>{part}</ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}

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
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-xl font-bold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-lg font-bold">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mb-2 mt-3 font-semibold">{children}</h3>,
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-orange-400 underline"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 scroll-halus overflow-auto rounded-lg bg-neutral-950 p-3 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-neutral-700 px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  // Custom table rendering for AI output tables
  // table: (props) => {
  //   const convertChildren = (children: React.ReactNode): React.ReactNode => {
  //     const arrays: React.ReactNode[] = [];
  //     React.Children.forEach(children, (child) => {
  //       if (child && typeof child === 'object') {
  //         arrays.push(child);
  //       }
  //     });
  //     return arrays.length > 0 ? arrays : children;
  //   };

  //   const rows = convertChildren(props.children);
  //   if (!rows || rows.length === 0) return null;

  //   return (
  //     <div className="overflow-x-auto rounded-lg bg-neutral-800 my-4">
  //       <table className="w-full text-sm text-neutral-100">
  //         <tbody>
  //           {rows.map((row, rowIndex) => {
  //             const cells = React.Children.toArray(row?.props?.children ?? row).children;
  //             return (
  //               <tr key={rowIndex} className="border-b border-neutral-700">
  //                 {Array.from(cells).map((cell, cellIndex) => (
  //                   <td key={cellIndex} className="py-2 whitespace-pre min-w-[120px] text-neutral-300">
  //                     {cell}
  //                   </td>
  //                 ))}
  //               </tr>
  //             );
  //           })}
  //         </tbody>
  //       </table>
  //     </div>
  //   );
  // },

  // ----- maintenance ------
};

function Diff({ lama, baru }: { lama: string; baru: string }) {
  const baris = (t: string) => (t === "" ? [] : t.split("\n"));
  const lamaLines = baris(lama);
  const baruLines = baris(baru);
  const maxNum = Math.max(lamaLines.length, baruLines.length);
  const numWidth = String(maxNum).length;

  return (
    <div className="scroll-halus max-h-72 overflow-auto rounded-lg bg-neutral-950 font-mono text-xs">
      <div className="flex">
        {/* Kolom lama (removed) */}
        <div className="flex-1">
          {lamaLines.map((b, i) => (
            <div
              key={"l" + i}
              className="flex bg-red-950/30 border-l-2 border-red-700"
            >
              <span className="w-12 shrink-0 select-none bg-red-950/50 px-2 py-1 text-right text-red-600">
                {i + 1}
              </span>
              <span className="px-3 py-1 text-red-200 whitespace-pre-wrap flex-1">
                - {b}
              </span>
            </div>
          ))}
        </div>

        {/* Kolom baru (added) */}
        <div className="flex-1">
          {baruLines.map((b, i) => (
            <div
              key={"b" + i}
              className="flex bg-green-950/30 border-l-2 border-green-700"
            >
              <span className="w-12 shrink-0 select-none bg-green-950/50 px-2 py-1 text-right text-green-600">
                {i + 1}
              </span>
              <span className="px-3 py-1 text-green-200 whitespace-pre-wrap flex-1">
                + {b}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IsiAlat({ nama, input }: { nama: string; input: Masukan }) {
  if (nama === "Edit")
    return <Diff lama={str(input.old_string)} baru={str(input.new_string)} />;
  if (nama === "Write") return <Diff lama="" baru={str(input.content)} />;
  const teks =
    nama === "Bash" ? str(input.command) : JSON.stringify(input, null, 2);
  return (
    <pre className="scroll-halus max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-950 p-3 font-mono text-xs">
      {teks}
    </pre>
  );
}

const ikonProps = {
  viewBox: "0 0 24 24",
  className: "h-4 w-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IkonUlang = () => (
  <svg {...ikonProps}>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);
const IkonEdit = () => (
  <svg {...ikonProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IkonSalin = () => (
  <svg {...ikonProps}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IkonCentang = () => (
  <svg {...ikonProps}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function TombolAksi({
  judul,
  onClick,
  children,
}: {
  judul: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={judul}
      className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
    >
      {children}
    </button>
  );
}
function PesanUser({
  teks,
  lampiran,
  expanded,
  onToggleExpand,
  onEdit,
  onCopy,
  onRegenerate,
}: {
  teks: string;
  lampiran?: string[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit?: (teksBaru: string) => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
}) {
  const [mengedit, setMengedit] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const [draf, setDraf] = useState(teks);
  const panjang = teks.length;
  const cukupPanjang = panjang > BATAS_PANJANG_PESAN;
  const tampilkan = expanded
    ? teks
    : teks.slice(0, BATAS_PANJANG_PESAN) + "...";

  if (mengedit)
    return (
      <div className="mb-4 flex justify-end">
        <div className="w-full max-w-[85%] space-y-2 rounded-2xl bg-neutral-700 p-3">
          <textarea
            autoFocus
            value={draf}
            onChange={(e) => setDraf(e.target.value)}
            rows={Math.min(10, draf.split("\n").length + 1)}
            className="w-full resize-none rounded-lg bg-neutral-800 px-3 py-2 outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setMengedit(false);
                setDraf(teks);
              }}
              className="rounded-lg bg-neutral-600 px-3 py-1 text-xs hover:bg-neutral-500"
            >
              Batal
            </button>
            <button
              onClick={() => {
                const t = draf.trim();
                if (t && t !== teks) onEdit?.(t);
                setMengedit(false);
              }}
              className="rounded-lg bg-orange-600 px-3 py-1 text-xs hover:bg-orange-500"
            >
              Kirim Ulang
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="group mb-4 flex flex-col items-end gap-1">
      <div className="max-w-[85%] space-y-2 rounded-2xl bg-neutral-700 px-4 py-2">
        {lampiran && lampiran.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lampiran.map((n, j) => (
              <span
                key={j}
                className="rounded-md bg-neutral-600 px-2 py-0.5 text-xs"
              >
                📎 {n}
              </span>
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap">{tampilkan}</div>
        {cukupPanjang && (
          <button
            onClick={onToggleExpand}
            className="text-xs text-neutral-300 hover:text-neutral-100 hover:underline"
          >
            {expanded
              ? "Tampilkan Lebih Sedikit"
              : `Tampilkan Lebih Banyak (${panjang} karakter)`}
          </button>
        )}
      </div>

      {/* Baris tombol: selalu menempati ruang, hanya transparansinya yang berubah */}
      <div className="flex gap-0.5 pr-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {onRegenerate && (
          <TombolAksi judul="Ulangi" onClick={onRegenerate}>
            <IkonUlang />
          </TombolAksi>
        )}
        {onEdit && (
          <TombolAksi
            judul="Edit pesan"
            onClick={() => {
              setDraf(teks);
              setMengedit(true);
            }}
          >
            <IkonEdit />
          </TombolAksi>
        )}
        {onCopy && (
          <TombolAksi
            judul="Salin"
            onClick={() => {
              onCopy();
              setTersalin(true);
              window.setTimeout(() => setTersalin(false), 1500);
            }}
          >
            {tersalin ? <IkonCentang /> : <IkonSalin />}
          </TombolAksi>
        )}
      </div>
    </div>
  );
}
function PesanAI({
  teks,
  expanded,
  onToggleExpand,
  onCopy,
  onRegenerate,
}: {
  teks: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
}) {
  const panjang = teks.length;
  const cukupPanjang = panjang > BATAS_PANJANG_PESAN;
  const tampilkan = expanded
    ? teks
    : teks.slice(0, panjang) + "...";

  return (
    <div className="min-w-0 text-neutral-200 space-y-2 group">
      <RenderWithThinking teks={tampilkan} />
      {cukupPanjang && (
        <button
          onClick={onToggleExpand}
          className="text-xs text-neutral-400 hover:text-neutral-300 hover:underline"
        >
          {expanded
            ? "Tampilkan Lebih Sedikit"
            : `Tampilkan Lebih Banyak (${panjang} karakter)`}
        </button>
      )}
      <div className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {onCopy && (
          <TombolAksi judul="Salin" onClick={onCopy}>
            <IkonSalin />
          </TombolAksi>
        )}
        {onRegenerate && (
          <TombolAksi judul="Ulangi" onClick={onRegenerate}>
            <IkonUlang />
          </TombolAksi>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [izin, setIzin] = useState<Izin | null>(null);
  const [status, setStatus] = useState("");
  const [detik, setDetik] = useState(0);
  const [model, setModel] = useState(
    () => localStorage.getItem("vibe-model") || "Vibe_Code",
  );
  const [effort, setEffort] = useState(
    () => localStorage.getItem("vibe-effort") || "medium",
  );
  const [daftarModel, setDaftarModel] = useState<string[]>([]);
  const [pilihModel, setPilihModel] = useState<number | null>(null);
  const [idxSaran, setIdxSaran] = useState(0);
  const [daftarSesi, setDaftarSesi] = useState<Sesi[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(
    new Set(),
  );
  const [pilihSesi, setPilihSesi] = useState<number | null>(null);
  const [projectPath, setProjectPath] = useState("");
  const [aplikasiSendiri, setAplikasiSendiri] = useState(false);
  const [terhubung, setTerhubung] = useState(false);
  const [lampiran, setLampiran] = useState<Lampiran[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const izinkanSelaluRef = useRef<Set<string>>(new Set());
  const ws = useRef<WebSocket | null>(null);
  const bawah = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const info = useCallback(
    (teks: string) => setItems((p) => [...p, { k: "info", teks }]),
    [],
  );

  const kirimWs = useCallback((obj: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN)
      ws.current.send(JSON.stringify(obj));
  }, []);

  const gantiModel = useCallback(
    (nama: string) => {
      setModel(nama);
      localStorage.setItem("vibe-model", nama);
      info(`Model diganti ke: ${nama}`);
    },
    [info],
  );

  const gantiEffort = useCallback(
    (nilai: string) => {
      setEffort(nilai);
      localStorage.setItem("vibe-effort", nilai);
      info(`Effort diganti ke: ${nilai}`);
    },
    [info],
  );

  const segarkanDaftarModel = useCallback(
    () => kirimWs({ type: "command", command: "model_list" }),
    [kirimWs],
  );

  useEffect(() => {
    window.addEventListener("focus", segarkanDaftarModel);
    return () => window.removeEventListener("focus", segarkanDaftarModel);
  }, [segarkanDaftarModel]);

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
          setModel((lama) =>
            m.models?.length && !m.models.includes(lama) ? m.models[0] : lama,
          );
        }
        if (m.type === "models") {
          setDaftarModel(m.models ?? []);
          if (m.buka && m.models?.length) setPilihModel(0);
        }
        if (m.type === "riwayat") {
          // Dikirim server saat tersambung, ganti proyek, atau melanjutkan sesi.
          const dipulihkan = pulihkan(m.items ?? []);
          setItems(
            m.pesan
              ? [...dipulihkan, { k: "info", teks: m.pesan }]
              : dipulihkan,
          );
          setStatus("");
        }
        if (m.type === "text") {
          setStatus("");
          setItems((p) => {
            const akhir = p[p.length - 1];
            if (akhir?.k === "ai")
              return [
                ...p.slice(0, -1),
                { k: "ai", teks: akhir.teks + m.text },
              ];
            return [...p, { k: "ai", teks: m.text }];
          });
        }
        if (m.type === "status") setStatus(m.label);
        if (m.type === "tool") {
          setStatus("");
          const r = ringkasAlat(m.nama, m.input);
          setItems((p) => [
            ...p,
            {
              k: "alat",
              id: m.id,
              nama: m.nama,
              input: m.input,
              ...r,
              selesai: false,
              galat: false,
            },
          ]);
        }
        if (m.type === "tool_result") {
          setItems((p) =>
            p.map((x) =>
              x.k === "alat" && x.id === m.id
                ? { ...x, selesai: true, galat: !!m.galat }
                : x,
            ),
          );
        }
        if (m.type === "izin") {
          // Cek jika alat sudah di-"Izinkan Selalu" menggunakan ref untuk latest state
          if (izinkanSelaluRef.current.has(m.alat)) {
            kirimWs({ type: "izin", id: m.id, izinkan: true });
          } else {
            setIzin({ id: m.id, alat: m.alat, input: m.input });
          }
        }
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
            } else
              info(
                d.sibuk
                  ? "Tunggu asisten selesai dulu."
                  : "Gagal: folder tidak ditemukan.",
              );
          }
          if (m.command === "session_list") {
            if (d.daftar.length === 0)
              info("Belum ada sesi tersimpan di folder ini.");
            else {
              setDaftarSesi(d.daftar);
              setPilihSesi(
                Math.max(
                  0,
                  d.daftar.findIndex((s: Sesi) => s.id === d.aktif),
                ),
              );
            }
          }
          if (m.command === "session_resume" && !d.success)
            info(
              d.sibuk
                ? "Tunggu asisten selesai dulu."
                : "Sesi tidak ditemukan.",
            );
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
    const t = setInterval(
      () => setDetik(Math.floor((Date.now() - awal) / 1000)),
      1000,
    );
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
    else if (terakhir?.k === "alat" && !terakhir.selesai)
      label = terakhir.ringkas;
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
        izinkanSelaluRef.current.clear(); // Reset permission cache ref
        kirimWs({ type: "reset" });
        break;
      case "/resume":
        kirimWs({ type: "command", command: "session_list" });
        break;
      case "/model":
        if (arg) gantiModel(arg);
        else kirimWs({ type: "command", command: "model_list", arg: "buka" });
        break;
      case "/effort":
        if(DAFTAR_EFFORT.includes(arg)) gantiEffort(arg);
        else info(`Effort saat ini: ${effort}\nPilihan: ${DAFTAR_EFFORT.join(", ")}`);
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
        info(
          `Perintah tidak dikenal: ${nama}. Ketik /help untuk daftar perintah.`,
        );
    }
  }

  function kirim() {
    const teks = input.trim();
    if ((!teks && lampiran.length === 0) || sibuk) return;
    setInput("");
    if (teks.startsWith("/") && lampiran.length === 0) {
      perintah(teks);
      return;
    }
    setItems((p) => [
      ...p,
      { k: "saya", teks, lampiran: lampiran.map((l) => l.nama) },
    ]);
    kirimWs({
      prompt: teks,
      model,
      effort,
      lampiran: lampiran.map(({ nama, tipe, data }) => ({ nama, tipe, data })),
    });
    setLampiran([]);
    setStatus("");
    setSibuk(true);
  }

  async function tambahBerkas(files: File[]) {
    const lolos: File[] = [];
    for (const f of files) {
      if (f.size > MAKS_BYTE)
        info(`"${f.name}" dilewati: ukuran lebih dari 10 MB.`);
      else lolos.push(f);
    }
    const sisa = MAKS_LAMPIRAN - lampiran.length;
    if (lolos.length > sisa)
      info(`Maksimal ${MAKS_LAMPIRAN} lampiran per pesan.`);
    const baru = await Promise.all(
      lolos.slice(0, Math.max(0, sisa)).map(bacaBerkas),
    );
    setLampiran((p) => [...p, ...baru]);
  }

  function berhenti() {
    kirimWs({ type: "stop" });
  }

  function kirimUlang(idx: number, teksBaru: string) {
    if (sibuk) return;
    const asli = items[idx];
    if (!asli || asli.k !== "saya") return;
    setItems((prev) => [...prev.slice(0, idx), { k: "saya", teks: teksBaru }]);
    kirimWs({ prompt: teksBaru, model, effort });
    setStatus("");
    setSibuk(true);
  }

  function regenerateFromIndex(userMsgIndex: number) {
    if (sibuk) return;
    let targetIndex = userMsgIndex;
    while (targetIndex >= 0 && items[targetIndex]?.k !== "saya") {
      targetIndex--;
    }
    if (targetIndex < 0) return;

    const userMsg = items[targetIndex];
    if (!userMsg || userMsg.k !== "saya") return;

    setItems((prev) => prev.slice(0, targetIndex + 1));

    kirimWs({
      prompt: userMsg.teks,
      model,
      effort,
      lampiran: (userMsg.lampiran || []).map((n) => ({
        nama: n,
        tipe: "",
        data: "",
      })),
    });
    setStatus("");
    setSibuk(true);
  }

  function jawabIzin(izinkan: boolean, selalu: boolean = false) {
    if (!izin) return;
    kirimWs({ type: "izin", id: izin.id, izinkan });

    // Jika "Izinkan Selalu", tambahkan ke cache
    if (izinkan && selalu) {
      izinkanSelaluRef.current.add(izin.alat);
      info(`Izin untuk "${izin.alat}" akan diberikan otomatis di session ini.`);
    }

    setIzin(null);
  }

  // Penanganan umum untuk daftar yang bisa dipilih dengan panah.
  function navigasi(
    e: KeyboardEvent<HTMLTextAreaElement>,
    n: number,
    idx: number,
    setIdx: (i: number) => void,
    pilih: (i: number) => void,
    tutup: () => void,
  ): boolean {
    if (n === 0) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((idx + 1) % n);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((idx - 1 + n) % n);
      return true;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      pilih(idx);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      tutup();
      return true;
    }
    return false;
  }

  function tekan(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      pilihSesi !== null &&
      navigasi(
        e,
        daftarSesi.length,
        pilihSesi,
        setPilihSesi,
        (i) => {
          kirimWs({
            type: "command",
            command: "session_resume",
            arg: daftarSesi[i].id,
          });
          setPilihSesi(null);
        },
        () => setPilihSesi(null),
      )
    )
      return;

    if (
      pilihModel !== null &&
      navigasi(
        e,
        daftarModel.length,
        pilihModel,
        setPilihModel,
        (i) => {
          gantiModel(daftarModel[i]);
          setPilihModel(null);
        },
        () => setPilihModel(null),
      )
    )
      return;

    if (saran.length > 0) {
      if (e.key === "Tab") {
        e.preventDefault();
        setInput(saran[Math.min(idxSaran, saran.length - 1)].nama + " ");
        return;
      }
      if (
        navigasi(
          e,
          saran.length,
          idxSaran,
          setIdxSaran,
          (i) => {
            setInput("");
            perintah(saran[i].nama);
          },
          () => setInput(""),
        )
      )
        return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      kirim();
    }
  }
  return (
    <div
      className="flex h-full flex-col bg-neutral-900 text-[15px] leading-relaxed text-neutral-100"
      style={{
        fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
      }}
    >
      <header className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
        <span className="text-base font-semibold tracking-tight flex items-center gap-2">
          <span className="text-xl">🤖</span>
          Claude Code
        </span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-500"
          title={projectPath}
        >
          {projectPath}
        </span>

        <div className="flex items-center gap-1">
          <div className="relative">
            <select
              value={model}
              onMouseDown={segarkanDaftarModel}
              onChange={(e) => gantiModel(e.target.value)}
              className="appearance-none rounded-lg bg-neutral-800 pl-3 pr-8 py-1.5 font-mono text-xs text-neutral-300 outline-none hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 cursor-pointer transition-colors"
            >
              {(daftarModel.includes(model)
                ? daftarModel
                : [model, ...daftarModel]
              ).map((n) => (
                <option key={n} value={n}>
                  Model: {n}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400">
              ▼
            </span>
          </div>
          <button
            onClick={segarkanDaftarModel}
            title="Muat ulang daftar model dari 9Router"
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          >
            <IkonUlang />
          </button>
        </div>
        <div className="relative" title="Tingkat usaha berpikir model">
          <select
            value={effort}
            onChange={(e) => gantiEffort(e.target.value)}
            className="appearance-none rounded-lg bg-neutral-800 pl-3 pr-8 py-1.5 font-mono text-xs text-neutral-300 outline-none hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 cursor-pointer transition-colors"
          >
            {DAFTAR_EFFORT.map((n) => (
              <option key={n} value={n}>
                Effort: {n}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400">
            ▼
          </span>
        </div>

        <span
          className={
            "h-2 w-2 rounded-full " +
            (terhubung ? "bg-green-500" : "bg-red-500")
          }
          title={terhubung ? "Terhubung" : "Terputus"}
        />
      </header>

      {!terhubung && (
        <div className="bg-red-950 px-4 py-1.5 text-sm text-red-200">
          Terputus dari server, mencoba menyambung kembali...
        </div>
      )}

      <main
        className={
          "tanpa-scrollbar flex-1 overflow-y-auto px-4 py-6 transition-colors " +
          (dragOver ? "bg-neutral-800" : "")
        }
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) tambahBerkas(files);
        }}
      >
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {items.length === 0 && (
            <div className="pt-16 text-center text-neutral-500">
              Tanyakan sesuatu tentang proyek Anda, atau ketik / untuk melihat
              perintah.
            </div>
          )}
          {items.map((m, i) => {
            if (m.k === "saya")
              return (
                <PesanUser
                  key={i}
                  teks={m.teks}
                  lampiran={m.lampiran}
                  expanded={expandedMessages.has(i)}
                  onToggleExpand={() => {
                    setExpandedMessages((prev) => {
                      const newSet = new Set(prev);
                      if (newSet.has(i)) newSet.delete(i);
                      else newSet.add(i);
                      return newSet;
                    });
                  }}
                  onEdit={(teksBaru) => kirimUlang(i, teksBaru)}
                  onCopy={() => navigator.clipboard.writeText(m.teks)}
                  onRegenerate={() => regenerateFromIndex(i)}
                />
              );
            if (m.k === "ai")
              return (
                <PesanAI
                  key={i}
                  teks={m.teks}
                  expanded={expandedMessages.has(i)}
                  onToggleExpand={() => {
                    setExpandedMessages((prev) => {
                      const newSet = new Set(prev);
                      if (newSet.has(i)) newSet.delete(i);
                      else newSet.add(i);
                      return newSet;
                    });
                  }}
                  onCopy={() => navigator.clipboard.writeText(m.teks)}
                  onRegenerate={() => regenerateFromIndex(i - 1)}
                />
              );
            if (m.k === "info")
              return (
                <div
                  key={i}
                  className="whitespace-pre-wrap text-sm italic text-neutral-400"
                >
                  {m.teks}
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
                {m.selesai &&
                  !m.galat &&
                  (m.nama === "Edit" || m.nama === "Write") && (
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
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => jawabIzin(true)}
                  className="rounded-xl bg-green-600 px-4 py-2 hover:bg-green-500"
                >
                  Izinkan
                </button>
                <button
                  onClick={() => jawabIzin(true, true)}
                  className="rounded-xl bg-green-700 px-4 py-2 hover:bg-green-600"
                  title="Izinkan tindakan ini dan semua tindakan serupa di session ini"
                >
                  Izinkan Selalu
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
        {pilihModel !== null && (
          <div className="absolute inset-x-3 bottom-full mx-auto mb-2 max-w-3xl overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 shadow-lg">
            <div className="border-b border-neutral-700 px-4 py-1.5 text-xs text-neutral-400">
              Pilih model · ↑↓ untuk memilih · Enter untuk konfirmasi · Esc
              untuk batal
            </div>
            {daftarModel.map((nama, i) => (
              <button
                key={nama}
                onMouseEnter={() => setPilihModel(i)}
                onClick={() => {
                  gantiModel(nama);
                  setPilihModel(null);
                  inputRef.current?.focus();
                }}
                className={
                  "flex w-full items-center justify-between gap-3 px-4 py-2 text-left font-mono text-sm " +
                  (i === pilihModel ? "bg-neutral-700" : "")
                }
              >
                <span>{nama}</span>
                {nama === model && (
                  <span className="text-xs text-orange-400">dipakai</span>
                )}
              </button>
            ))}
          </div>
        )}
        {saran.length > 0 && (
          <div className="absolute inset-x-3 bottom-full mx-auto mb-2 max-w-3xl overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 shadow-lg">
            {saran.map((p, i) => (
              <button
                key={p.nama}
                onMouseEnter={() => setIdxSaran(i)}
                onClick={() => {
                  setInput("");
                  perintah(p.nama);
                }}
                className={
                  "flex w-full gap-3 px-4 py-2 text-left " +
                  (i === idxSaran ? "bg-neutral-700" : "")
                }
              >
                <span className="w-24 shrink-0 font-mono text-orange-400">
                  {p.nama}
                </span>
                <span className="text-sm text-neutral-300">{p.ket}</span>
              </button>
            ))}
          </div>
        )}

        {pilihSesi !== null && (
          <div className="absolute inset-x-3 bottom-full mx-auto mb-2 max-w-3xl overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 shadow-lg">
            <div className="border-b border-neutral-700 px-4 py-1.5 text-xs text-neutral-400">
              Pilih sesi · ↑↓ untuk memilih · Enter untuk melanjutkan · Esc
              untuk batal
            </div>
            {daftarSesi.map((s, i) => (
              <button
                key={s.id}
                onMouseEnter={() => setPilihSesi(i)}
                onClick={() => {
                  kirimWs({
                    type: "command",
                    command: "session_resume",
                    arg: s.id,
                  });
                  setPilihSesi(null);
                  inputRef.current?.focus();
                }}
                className={
                  "flex w-full items-center justify-between gap-3 px-4 py-2 text-left " +
                  (i === pilihSesi ? "bg-neutral-700" : "")
                }
              >
                <span className="truncate">{s.judul}</span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {waktuSingkat(s.waktu)}
                </span>
              </button>
            ))}
          </div>
        )}
        {lampiran.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
            {lampiran.map((l, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-neutral-800 py-1 pl-2 pr-1 text-xs"
              >
                {l.pratinjau ? (
                  <img
                    src={l.pratinjau}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <span>📄</span>
                )}
                <span className="max-w-40 truncate">{l.nama}</span>
                <button
                  onClick={() =>
                    setLampiran((p) => p.filter((_, j) => j !== i))
                  }
                  className="rounded px-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                  title="Hapus lampiran"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-3xl">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              tambahBerkas(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <div className="flex-1 flex items-end gap-2 rounded-xl bg-neutral-800 px-3 py-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={sibuk}
              title="Lampirkan gambar atau file"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-lg text-neutral-400 transition-all hover:text-neutral-200 disabled:opacity-40"
            >
              +
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setIdxSaran(0);
                setPilihModel(null);
                setPilihSesi(null);
              }}
              onKeyDown={tekan}
              onPaste={(e) => {
                const f = Array.from(e.clipboardData.files);
                if (f.length > 0) {
                  e.preventDefault();
                  tambahBerkas(f);
                }
              }}
              rows={1}
              placeholder="Tanyakan sesuatu... (Enter kirim, Shift+Enter baris baru)"
              className="tanpa-scrollbar flex-1 resize-none overflow-y-auto bg-transparent outline-none placeholder:text-neutral-500"
            />
            {sibuk ? (
              <button
                onClick={berhenti}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-neutral-400 transition-all hover:text-neutral-200"
                title="Stop"
              >
                ⏹
              </button>
            ) : (
              <button
                onClick={kirim}
                disabled={
                  !terhubung || (!input.trim() && lampiran.length === 0)
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-neutral-400 transition-all hover:text-orange-400 disabled:opacity-40"
                title="Kirim (Enter)"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
