import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Pesan = { peran: "saya" | "ai"; teks: string };
type Izin = { id: string; alat: string; input: unknown };

export default function App() {
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [input, setInput] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [izin, setIzin] = useState<Izin | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const bawah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = new WebSocket(`ws://${location.host}/ws`);
    ws.current = s;
    s.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "text") {
        setPesan((p) => {
          const salinan = [...p];
          salinan[salinan.length - 1] = {
            peran: "ai",
            teks: salinan[salinan.length - 1].teks + m.text,
          };
          return salinan;
        });
      }
      if (m.type === "izin") setIzin({ id: m.id, alat: m.alat, input: m.input });
      if (m.type === "done") setSibuk(false);
      if (m.type === "error") {
        setPesan((p) => [...p, { peran: "ai", teks: "[error] " + m.message }]);
        setSibuk(false);
      }
    };
    return () => s.close();
  }, []);

  useEffect(() => {
    bawah.current?.scrollIntoView({ behavior: "smooth" });
  }, [pesan, izin]);

  function kirim() {
    if (!input.trim() || sibuk) return;
    setPesan((p) => [...p, { peran: "saya", teks: input }, { peran: "ai", teks: "" }]);
    ws.current?.send(JSON.stringify({ prompt: input }));
    setInput("");
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
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {pesan.map((m, i) => (
          <div key={i} className={m.peran === "saya" ? "flex justify-end" : "flex"}>
            <div
              className={
                "max-w-[85%] rounded-2xl px-4 py-2 whitespace-pre-wrap " +
                (m.peran === "saya" ? "bg-orange-600" : "bg-neutral-800")
              }
            >
              {m.peran === "ai" ? <ReactMarkdown>{m.teks}</ReactMarkdown> : m.teks}
            </div>
          </div>
        ))}

        {izin && (
          <div className="max-w-[85%] rounded-2xl border border-yellow-600 bg-neutral-800 p-4 space-y-3">
            <div className="font-semibold text-yellow-400">
              Claude meminta izin memakai alat: {izin.alat}
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-950 p-3 text-xs whitespace-pre-wrap">
              {JSON.stringify(izin.input, null, 2)}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => jawabIzin(true)}
                className="rounded-xl bg-green-600 px-4 py-2"
              >
                Izinkan
              </button>
              <button
                onClick={() => jawabIzin(false)}
                className="rounded-xl bg-red-600 px-4 py-2"
              >
                Tolak
              </button>
            </div>
          </div>
        )}
        <div ref={bawah} />
      </main>
      <footer className="p-3 border-t border-neutral-700 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && kirim()}
          placeholder="Tanyakan sesuatu tentang proyek Anda..."
          className="flex-1 rounded-xl bg-neutral-800 px-4 py-2 outline-none"
        />
        <button onClick={kirim} disabled={sibuk} className="rounded-xl bg-orange-600 px-4 py-2 disabled:opacity-50">
          Kirim
        </button>
      </footer>
    </div>
  );
}