import { useLayoutEffect, useRef, useState } from "react";

/**
 * Border tombol "Claude Code" (sakelar Izinkan Semua).
 *
 * Konsep mengikuti dua gambar acuan:
 *  - Idle (aktif = false)    : cincin terbuka di bagian bawah + dua batang jeda (pause).
 *  - Otomatis (aktif = true) : cincin tertutup, simpul bulat dan panah ganda
 *                              berputar mengelilingi tombol (loop berkelanjutan).
 *
 * Komponen ini harus diletakkan di dalam <button> yang memiliki
 * `relative isolate`; ukuran SVG mengikuti ukuran tombol secara otomatis.
 */

const WARNA = "#fb923c"; // orange-400, sama dengan tema aplikasi
const LATAR = "#171717"; // neutral-900, untuk menutup garis di balik penanda
const TEBAL = 1.75; // tebal garis cincin (px)
const CELAH = 18; // lebar celah cincin saat idle (px)
const PUTAR = 6; // detik per satu putaran penuh

function Simpul() {
  return (
    <>
      <circle r={4.6} fill={LATAR} stroke={WARNA} strokeWidth={1.2} />
      <circle r={2.4} fill={WARNA} />
    </>
  );
}

function PanahGanda() {
  // Dua segitiga bertumpuk, ujung menghadap sumbu +x (arah gerak).
  return (
    <g fill={LATAR} stroke={WARNA} strokeWidth={1.2} strokeLinejoin="miter">
      <path d="M -1.5 -4.5 L 4 0 L -1.5 4.5 Z" />
      <path d="M -5.5 -4.5 L 0 0 L -5.5 4.5 Z" />
    </g>
  );
}

export default function BorderIzin({ aktif }: { aktif: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [ukuran, setUkuran] = useState({ w: 160, h: 38 });
  const [kurangiGerak] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useLayoutEffect(() => {
    const induk = ref.current?.parentElement;
    if (!induk) return;
    const ukur = () =>
      setUkuran((lama) =>
        lama.w === induk.offsetWidth && lama.h === induk.offsetHeight
          ? lama
          : { w: induk.offsetWidth, h: induk.offsetHeight },
      );
    ukur();
    const pengamat = new ResizeObserver(ukur);
    pengamat.observe(induk);
    return () => pengamat.disconnect();
  }, []);

  const { w, h } = ukuran;
  const o = TEBAL / 2 + 0.25;
  const r = (h - 2 * o) / 2;
  const cx = w / 2;

  // Lintasan berbentuk kapsul, dimulai dari tengah sisi bawah, searah jarum jam.
  const d =
    `M ${cx} ${h - o} H ${o + r} A ${r} ${r} 0 0 1 ${o + r} ${o} ` +
    `H ${w - o - r} A ${r} ${r} 0 0 1 ${w - o - r} ${h - o} H ${cx}`;

  const panjang = 2 * (w - 2 * o - 2 * r) + 2 * Math.PI * r;
  const celahPersen = Math.min(30, (CELAH / panjang) * 100);

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -1,
        overflow: "visible",
        pointerEvents: "none",
        filter: aktif ? "drop-shadow(0 0 4px rgba(251,146,60,.4))" : "none",
        transition: "filter .4s ease",
      }}
    >
      {/* Cincin: terbuka di bawah saat idle, menutup penuh saat otomatis. */}
      <path
        d={d}
        pathLength={100}
        fill="none"
        stroke={WARNA}
        strokeWidth={TEBAL}
        strokeLinecap="butt"
        style={{
          strokeDasharray: aktif ? "100 0" : `${100 - celahPersen} ${celahPersen}`,
          strokeDashoffset: aktif ? 0 : -celahPersen / 2,
          transition: "stroke-dasharray .45s ease, stroke-dashoffset .45s ease",
        }}
      />

      {/* Dua batang jeda di celah cincin (idle). */}
      <g
        fill={WARNA}
        style={{ opacity: aktif ? 0 : 1, transition: "opacity .3s ease" }}
      >
        <rect x={cx - 3.5} y={h - o - 5.5} width={2.4} height={11} rx={0.4} />
        <rect x={cx + 1.1} y={h - o - 5.5} width={2.4} height={11} rx={0.4} />
      </g>

      {/* Simpul dan panah ganda yang berputar (otomatis). */}
      <g style={{ opacity: aktif ? 1 : 0, transition: "opacity .35s ease" }}>
        {kurangiGerak ? (
          <>
            <g transform={`translate(${o} ${h / 2})`}>
              <Simpul />
            </g>
            <g transform={`translate(${w - o} ${h / 2}) rotate(90)`}>
              <PanahGanda />
            </g>
          </>
        ) : (
          <>
            <g>
              <Simpul />
              <animateMotion
                path={d}
                dur={`${PUTAR}s`}
                begin="0s"
                repeatCount="indefinite"
                rotate="auto"
              />
            </g>
            <g>
              <PanahGanda />
              <animateMotion
                path={d}
                dur={`${PUTAR}s`}
                begin={`-${PUTAR / 2}s`}
                repeatCount="indefinite"
                rotate="auto"
              />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
