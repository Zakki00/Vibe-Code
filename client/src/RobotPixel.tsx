import { useEffect, useState } from "react";

const WARNA = "#DD7A5B";
const MATA = "#000";

type Ekspresi = "normal" | "kedip" | "senang" | "kerja";

export default function RobotPixel({
  ukuran = 28,
  sibuk = false,
}: {
  ukuran?: number;
  sibuk?: boolean;
}) {
  const [ekspresi, setEkspresi] = useState<Ekspresi>("normal");
  const [arah, setArah] = useState(0); // arah pandang mata: -1, 0, 1
  const [goyang, setGoyang] = useState(false);
  const [lompat, setLompat] = useState(false);

  // Saat sibuk, robot fokus mengetik; saat idle, sesekali bereaksi dengan ekspresi lucu.
  useEffect(() => {
    let hidup = true;
    let timer = 0;
    const timers: number[] = [];
    const tunda = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (hidup) fn();
      }, ms);
      timers.push(id);
      return id;
    };
    const acak = (a: number, b: number) => a + Math.random() * (b - a);

    function langkah() {
      if (!hidup) return;
      const r = Math.random();
      if (r < 0.38) {
        setEkspresi("kedip");
        tunda(() => setEkspresi(sibuk ? "kerja" : "normal"), 140);
      } else if (r < 0.6) {
        setArah(Math.random() < 0.5 ? -1 : 1);
        tunda(() => setArah(0), 650);
      } else if (r < 0.82) {
        setEkspresi("senang");
        setGoyang(true);
        tunda(() => setGoyang(false), 650);
        tunda(() => setEkspresi(sibuk ? "kerja" : "normal"), 900);
      } else {
        setLompat(true);
        tunda(() => setLompat(false), 260);
      }
      timer = tunda(langkah, acak(1600, 3600));
    }

    setEkspresi(sibuk ? "kerja" : "normal");
    timer = tunda(langkah, acak(900, 1800));
    return () => {
      hidup = false;
      window.clearTimeout(timer);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [sibuk]);

  return (
    <svg
      viewBox="0 0 11 9"
      width={ukuran}
      height={(ukuran * 9) / 11}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <style>{`
        @keyframes rp-a { 0%,49% { transform: translateY(0) } 50%,100% { transform: translateY(-1px) } }
        @keyframes rp-b { 0%,49% { transform: translateY(-1px) } 50%,100% { transform: translateY(0) } }
        @keyframes rp-goyang {
          0%,100% { transform: rotate(0deg) }
          20% { transform: rotate(-6deg) }
          40% { transform: rotate(6deg) }
          60% { transform: rotate(-4deg) }
          80% { transform: rotate(4deg) }
        }
        @keyframes rp-ketik {
          0%,100% { transform: translateY(0) }
          50% { transform: translateY(-.25px) }
        }
        .rp-a { animation: rp-a .5s steps(1) infinite }
        .rp-b { animation: rp-b .5s steps(1) infinite }
        .rp-goyang {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: rp-goyang .65s ease-in-out;
        }
        .rp-kerja { animation: rp-ketik .45s steps(2) infinite }
        @media (prefers-reduced-motion: reduce) {
          .rp-a, .rp-b, .rp-goyang, .rp-kerja { animation: none }
        }
      `}</style>

      <g
        style={{
          transform: `translateY(${lompat ? -0.7 : 0}px)`,
          transition: "transform 100ms steps(2)",
        }}
      >
        <g className={`${goyang ? "rp-goyang" : ""} ${sibuk ? "rp-kerja" : ""}`}>
          {/* Badan dan telinga */}
          <rect x="1" y="0" width="9" height="7" fill={WARNA} />
          <rect x="0" y="2" width="11" height="2" fill={WARNA} />

          {/* Kaki: dua kelompok yang melangkah bergantian saat sibuk */}
          <rect className={sibuk ? "rp-a" : ""} x="2" y="7" width="1" height="2" fill={WARNA} />
          <rect className={sibuk ? "rp-b" : ""} x="3" y="7" width="1" height="2" fill={WARNA} />
          <rect className={sibuk ? "rp-a" : ""} x="7" y="7" width="1" height="2" fill={WARNA} />
          <rect className={sibuk ? "rp-b" : ""} x="8" y="7" width="1" height="2" fill={WARNA} />

          {/* Mata */}
          {(ekspresi === "normal" || ekspresi === "kerja") && (
            <>
              <rect x={2 + arah} y="2" width="1" height="1" fill={MATA} />
              <rect x={8 + arah} y="2" width="1" height="1" fill={MATA} />
            </>
          )}
          {ekspresi === "kerja" && (
            <rect x="5" y="5" width="1" height="0.5" fill={MATA} />
          )}
          {ekspresi === "kedip" && (
            <>
              <rect x={2 + arah} y="2.65" width="1" height="0.35" fill={MATA} />
              <rect x={8 + arah} y="2.65" width="1" height="0.35" fill={MATA} />
            </>
          )}
          {ekspresi === "senang" && (
            <>
              {/* > */}
              <rect x="2" y="1" width="1" height="1" fill={MATA} />
              <rect x="3" y="2" width="1" height="1" fill={MATA} />
              <rect x="2" y="3" width="1" height="1" fill={MATA} />
              {/* < */}
              <rect x="8" y="1" width="1" height="1" fill={MATA} />
              <rect x="7" y="2" width="1" height="1" fill={MATA} />
              <rect x="8" y="3" width="1" height="1" fill={MATA} />
            </>
          )}
        </g>
      </g>
    </svg>
  );
}
