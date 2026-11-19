import { useEffect, useRef, useState } from "react";
import RobotPixel from "./RobotPixel";

// INTRO_MS dan KELUAR_MS harus sama dengan --loading-intro dan (delay + --loading-keluar) di index.css.
const INTRO_MS = 5600;
const SUKSES_MS = 1400;
const KELUAR_MS = 1300;

type Fase = "intro" | "gagal" | "sukses" | "keluar";

/**
 * Animasi pembuka yang mengikuti status koneksi.
 *
 * - intro : logo bergerak ke sisi, ring dan garis progres (oranye) mengalir lalu menyatu mengelilingi logo tengah.
 * - sukses: dicek setelah intro selesai. Jika terhubung, semuanya berubah hijau dan Claude Code tersenyum.
 * - keluar: garis melepas, logo kembali ke tengah, lalu onSelesai() dipanggil.
 * - gagal : dicek setelah intro selesai. Jika belum terhubung, warna merah, garis progres terus mencoba lagi,
 *           logo tetap di sisi dan animasi tidak pernah selesai. Begitu koneksi tersambung, lanjut ke sukses.
 */
export default function LoadingAnimasi({
  terhubung,
  onSelesai,
}: {
  terhubung: boolean;
  onSelesai: () => void;
}) {
  const [introSelesai, setIntroSelesai] = useState(false);
  const [sukses, setSukses] = useState(false);
  const [keluar, setKeluar] = useState(false);
  const selesaiRef = useRef(onSelesai);

  useEffect(() => {
    selesaiRef.current = onSelesai;
  }, [onSelesai]);

  // Koneksi baru dihitung setelah garis progres tiba di tengah.
  // Begitu berhasil, urutan sukses terus berjalan walau koneksi putus lagi.
  if (introSelesai && terhubung && !sukses) setSukses(true);

  useEffect(() => {
    const id = window.setTimeout(() => setIntroSelesai(true), INTRO_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!sukses) return;
    const id = window.setTimeout(() => setKeluar(true), SUKSES_MS);
    return () => window.clearTimeout(id);
  }, [sukses]);

  useEffect(() => {
    if (!keluar) return;
    const id = window.setTimeout(() => selesaiRef.current(), KELUAR_MS);
    return () => window.clearTimeout(id);
  }, [keluar]);

  const fase: Fase = keluar
    ? "keluar"
    : sukses
      ? "sukses"
      : introSelesai
        ? "gagal"
        : "intro";
  const senang = fase === "sukses" || fase === "keluar";

  return (
    <div className="pt-16 text-center text-neutral-500" aria-live="polite">
      <div
        className="loading-animation"
        data-fase={fase}
        aria-label="Animasi Vibe App"
      >
        <div className="loading-stage" aria-hidden="true">
          <div className="loading-unit loading-router">
            <span className="loading-frame"><span className="loading-frame-fill" /></span>
            <svg viewBox="0 0 48 48" fill="none">
              <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
                <path d="M24 24 13 13m11 11 11-11M24 24 13 35m11-11 11 11" />
                <path d="M24 24V9m0 15v15M24 24H9m15 0h15" opacity=".9" />
              </g>
              <g fill="currentColor"><circle cx="13" cy="13" r="5" /><circle cx="35" cy="13" r="5" /><circle cx="13" cy="35" r="5" /><circle cx="35" cy="35" r="5" /><circle cx="24" cy="24" r="5" /></g>
            </svg>
          </div>
          <div className="loading-unit loading-vite">
            <span className="loading-frame"><span className="loading-frame-fill" /></span>
            <svg viewBox="0 0 256 257" aria-label="Vite" role="img">
              <defs>
                <linearGradient id="loading-vite-gradient" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#41d1ff" />
                  <stop offset="1" stopColor="#bd34fe" />
                </linearGradient>
              </defs>
              <path fill="url(#loading-vite-gradient)" d="M255 38 136 252c-2 4-8 4-10 0L1 38c-3-5 1-11 7-10l119 21c1 0 2 0 3 0l119-21c6-1 10 5 6 10Z" />
              <path fill="#ffdd35" d="m185 1-88 17c-2 0-3 2-4 4L87 112c0 3 3 5 6 4l25-8c3-1 6 2 5 5l-8 39c-1 3 3 6 6 4l15-9c3-2 7 1 6 5l-13 63c-1 4 4 6 6 3l2-3 81-161c2-3-1-7-5-6l-26 5c-3 1-6-2-5-5l9-41c1-3-2-6-5-5Z" />
            </svg>
          </div>
          <div className="loading-unit loading-claude">
            <span className="loading-frame"><span className="loading-frame-fill" /></span>
            <span className="loading-robot">
              <RobotPixel ukuran={42} sibuk={!senang} senang={senang} />
            </span>
          </div>
          <div className="loading-bridge loading-bridge-left"><span /></div>
          <div className="loading-bridge loading-bridge-right"><span /></div>
        </div>
        <p className="loading-caption">
          {fase === "gagal"
            ? "Koneksi gagal · mencoba kembali ke 9Router..."
            : senang
              ? "Claude Code dan 9Router terhubung"
              : "Menghubungkan Claude Code dan 9Router..."}
        </p>
      </div>
    </div>
  );
}
