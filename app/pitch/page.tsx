"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/* ============================================================
   Reef — Tatum × Walrus Hackathon · Vol. 01
   A full-screen editorial pitch deck.
   ============================================================ */

const TOTAL = 9;

export default function PitchPage() {
  const [i, setI] = useState(0);

  const go = useCallback((n: number) => {
    setI((cur) => {
      const next = Math.max(0, Math.min(TOTAL - 1, n));
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        setI((c) => Math.min(TOTAL - 1, c + 1));
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setI((c) => Math.max(0, c - 1));
      } else if (e.key === "Home") {
        setI(0);
      } else if (e.key === "End") {
        setI(TOTAL - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "var(--ov-bg)",
        color: "var(--ov-text)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* paper grain */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "radial-gradient(rgba(33,53,108,0.14) 1.1px, transparent 1.3px)",
          backgroundSize: "9px 9px",
          opacity: 0.55,
          mixBlendMode: "multiply",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(60% 50% at 82% -6%, rgba(232, 71, 43, 0.10), transparent 60%), radial-gradient(55% 45% at 12% -4%, rgba(33, 53, 108, 0.10), transparent 60%)",
        }}
      />

      <DeckChrome i={i} go={go} />

      <div style={{ position: "relative", flex: 1, display: "flex" }}>
        <SlideRouter i={i} />
      </div>

      <DeckFooter i={i} go={go} />

      {/* click halves for nav */}
      <button
        aria-label="Previous slide"
        onClick={() => go(i - 1)}
        style={{
          position: "absolute",
          inset: "80px 50% 80px 0",
          background: "transparent",
          border: 0,
          cursor: i > 0 ? "w-resize" : "default",
        }}
      />
      <button
        aria-label="Next slide"
        onClick={() => go(i + 1)}
        style={{
          position: "absolute",
          inset: "80px 0 80px 50%",
          background: "transparent",
          border: 0,
          cursor: i < TOTAL - 1 ? "e-resize" : "default",
        }}
      />

      <style>{`
        @keyframes tess-draw-circle {
          0%   { stroke-dashoffset: 620; opacity: 0; }
          12%  { opacity: 1; }
          100% { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes tess-draw-underline {
          0%   { stroke-dashoffset: 260; opacity: 0; }
          15%  { opacity: 1; }
          100% { stroke-dashoffset: 0;   opacity: 1; }
        }
        .tess-draw-circle {
          stroke-dasharray: 620;
          stroke-dashoffset: 620;
          animation: tess-draw-circle 780ms cubic-bezier(.5,.05,.2,1) both;
        }
        .tess-draw-underline {
          stroke-dasharray: 260;
          stroke-dashoffset: 260;
          animation: tess-draw-underline 520ms cubic-bezier(.6,.05,.2,1) both;
        }
        @keyframes tess-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tess-draw-circle, .tess-draw-underline {
            animation: none !important;
            stroke-dashoffset: 0 !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------
   Chrome
------------------------------------------------------------------ */

function DeckChrome({ i, go }: { i: number; go: (n: number) => void }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "22px 36px",
        gap: 20,
      }}
    >
      <button
        onClick={() => go(0)}
        className="font-display"
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          fontSize: 18,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ov-text)",
          fontWeight: 700,
        }}
      >
        Reef{" "}
        <span
          style={{
            fontFamily: "var(--font-script)",
            textTransform: "none",
            fontWeight: 500,
            color: "var(--ov-accent)",
            marginLeft: 6,
            letterSpacing: 0,
          }}
        >
          quarterly
        </span>
      </button>
      <div
        className="meta"
        style={{ display: "flex", alignItems: "center", gap: 14 }}
      >
        <span>VOL. 01</span>
        <Rule w={26} />
        <span>TATUM × WALRUS</span>
        <Rule w={26} />
        <span style={{ color: "var(--ov-text)" }}>
          {String(i + 1).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function DeckFooter({ i, go }: { i: number; go: (n: number) => void }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 36px 22px",
      }}
    >
      <div className="meta" style={{ color: "var(--ov-text-faint)" }}>
        ← / → · SPACE · HOME / END
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {Array.from({ length: TOTAL }).map((_, n) => {
          const active = n === i;
          return (
            <button
              key={n}
              aria-label={`Go to slide ${n + 1}`}
              onClick={() => go(n)}
              style={{
                width: active ? 28 : 10,
                height: 10,
                borderRadius: 999,
                background: active ? "var(--ov-accent)" : "transparent",
                border: `1.5px solid ${
                  active ? "var(--ov-accent)" : "var(--ov-line-ink)"
                }`,
                cursor: "pointer",
                transition: "width .25s cubic-bezier(.2,.7,.3,1)",
                padding: 0,
              }}
            />
          );
        })}
      </div>
      <div className="meta" style={{ color: "var(--ov-text-faint)" }}>
        REEF · SUI TESTNET
      </div>
    </div>
  );
}

function Rule({ w = 30 }: { w?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: w,
        height: 1.5,
        background: "var(--ov-text-faint)",
        verticalAlign: "middle",
      }}
    />
  );
}

/* ------------------------------------------------------------------
   Editorial primitives
------------------------------------------------------------------ */

function Circle({
  children,
  rot = -2,
  pad = 14,
  stroke = "var(--ov-accent)",
  delay = 280,
}: {
  children: ReactNode;
  rot?: number;
  pad?: number;
  stroke?: string;
  delay?: number;
}) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        padding: `2px ${pad}px`,
        whiteSpace: "nowrap",
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 200 80"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          transform: `rotate(${rot}deg) scale(1.04)`,
          overflow: "visible",
        }}
      >
        <path
          className="tess-draw-circle"
          d="M 18 42 C 12 22, 60 8, 110 10 C 168 12, 196 26, 192 46 C 188 64, 132 74, 78 70 C 28 66, 8 58, 12 44 Z"
          fill="none"
          stroke={stroke}
          strokeWidth={3.5}
          strokeLinecap="round"
          style={{ animationDelay: `${delay}ms` }}
        />
      </svg>
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

function Underline({
  children,
  rot = 0,
  stroke = "var(--ov-accent)",
  delay = 360,
}: {
  children: ReactNode;
  rot?: number;
  stroke?: string;
  delay?: number;
}) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
      <svg
        aria-hidden
        viewBox="0 0 200 18"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -6,
          width: "100%",
          height: 14,
          transform: `rotate(${rot}deg)`,
          overflow: "visible",
        }}
      >
        <path
          className="tess-draw-underline"
          d="M 4 10 C 40 2, 90 16, 140 8 C 170 4, 188 12, 196 8"
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
          style={{ animationDelay: `${delay}ms` }}
        />
      </svg>
    </span>
  );
}

function Script({
  children,
  size = 1,
  color = "var(--ov-accent)",
  rot = -3,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  rot?: number;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-script)",
        fontWeight: 600,
        color,
        fontSize: `${size}em`,
        lineHeight: 0.95,
        letterSpacing: 0,
        textTransform: "none",
        display: "inline-block",
        transform: `rotate(${rot}deg) translateY(2px)`,
      }}
    >
      {children}
    </span>
  );
}

function SectionTag({
  num,
  label,
}: {
  num: string;
  label: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span
        className="meta"
        style={{
          color: "var(--ov-accent)",
          fontSize: 11,
          letterSpacing: "0.22em",
        }}
      >
        ISSUE {num}
      </span>
      <Rule w={36} />
      <span
        className="meta"
        style={{ color: "var(--ov-text)", fontSize: 11 }}
      >
        {label}
      </span>
    </div>
  );
}

function Stamp({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-mono"
      style={{
        display: "inline-block",
        fontSize: 10.5,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        padding: "5px 10px",
        border: "1.5px solid var(--ov-line-ink)",
        borderRadius: 4,
        color: "var(--ov-text)",
        background: "transparent",
        transform: "rotate(-1.5deg)",
      }}
    >
      {children}
    </span>
  );
}

function Slide({
  children,
  pad = "56px 90px 36px",
}: {
  children: ReactNode;
  pad?: string;
}) {
  return (
    <section
      style={{
        position: "absolute",
        inset: 0,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        gap: 28,
        animation: "tess-fadein .42s cubic-bezier(.2,.7,.3,1) both",
      }}
    >
      {children}
      <style>{`
        @keyframes tess-fadein {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

/* ------------------------------------------------------------------
   Slides
------------------------------------------------------------------ */

function SlideRouter({ i }: { i: number }) {
  const slides = [
    <SlideCover key="0" />,
    <SlideProblem key="1" />,
    <SlideWhyNow key="2" />,
    <SlideSolution key="3" />,
    <SlideTiers key="4" />,
    <SlideCompute key="5" />,
    <SlideProvenance key="6" />,
    <SlideStack key="7" />,
    <SlideAsk key="8" />,
  ];
  return <div style={{ position: "relative", flex: 1 }}>{slides[i]}</div>;
}

/* --- 01. COVER ------------------------------------------------ */

function SlideCover() {
  return (
    <Slide pad="48px 90px 36px">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="kicker-jp" style={{ fontSize: 13 }}>
          プライベート データ マーケット
        </span>
        <Stamp>VOL. 01 · TATUM × WALRUS HACKATHON · 2026</Stamp>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div>
          <div
            className="meta"
            style={{ color: "var(--ov-text-faint)", marginBottom: 12 }}
          >
            THE REEF QUARTERLY · A FIELD GUIDE TO PRIVATE DATA
          </div>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(96px, 14vw, 200px)",
              lineHeight: 0.86,
              letterSpacing: "-0.03em",
              fontWeight: 700,
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Reef
          </h1>
          <div
            style={{
              maxWidth: 760,
              marginTop: 18,
              fontSize: 26,
              lineHeight: 1.22,
              color: "var(--ov-text)",
            }}
          >
            Access control as a{" "}
            <Underline>
              <Script size={1.25}>property of the data</Script>
            </Underline>
            <span style={{ marginLeft: 4 }}>—</span> not the platform.
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Stamp>SUI MOVE OBJECTS</Stamp>
            <Stamp>SEAL THRESHOLD ENCRYPTION</Stamp>
            <Stamp>LICENSE = KEY</Stamp>
            <Stamp>NAUTILUS TEE</Stamp>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="meta" style={{ color: "var(--ov-text-faint)" }}>
          A 6-MIN READ · CONTAINS LIVE TESTNET EVIDENCE · TURN UP THE PROJECTOR
        </div>
        <div className="meta" style={{ color: "var(--ov-accent)" }}>
          → PRESS SPACE TO BEGIN
        </div>
      </div>
    </Slide>
  );
}

/* --- 02. THE PROBLEM ------------------------------------------ */

function SlideProblem() {
  return (
    <Slide>
      <SectionTag num="01" label="THE PROBLEM" />

      <h2
        className="font-display"
        style={{
          fontSize: "clamp(56px, 7.2vw, 108px)",
          lineHeight: 0.92,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          fontWeight: 700,
          maxWidth: "92%",
        }}
      >
        Your{" "}
        <Circle rot={-3}>
          <span style={{ color: "var(--ov-accent)" }}>&ldquo;private&rdquo;</span>
        </Circle>{" "}
        model is one breach away from{" "}
        <Script size={1.1} rot={-4}>
          public.
        </Script>
      </h2>

      <div
        style={{
          marginTop: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 28,
        }}
      >
        <ProblemCard
          n="01"
          title="Permission-table privacy"
          body="On Kaggle and Hugging Face, &ldquo;private&rdquo; is a flag in a company&apos;s database. Breach the platform — or revoke the wrong account — and everything leaks."
        />
        <ProblemCard
          n="02"
          title="Creators earn nothing downstream"
          body="A model fine-tuned on your dataset generates revenue forever. You see zero of it. There is no native rail for derivative royalties."
        />
        <ProblemCard
          n="03"
          title="Provenance is editable metadata"
          body="&ldquo;Who made this, what was it trained on, what&apos;s the license?&rdquo; — all rows a platform can edit, lose, or be compelled to alter."
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
          paddingTop: 12,
          borderTop: "1.5px solid var(--ov-line-ink)",
        }}
      >
        <StatBlock big="1M+" small="MODELS ON HUGGING FACE" />
        <StatBlock big="70M+" small="KAGGLE USERS" />
        <StatBlock big="0" small="NATIVE ROYALTY RAILS" />
        <StatBlock big="1" small="ROW STANDING BETWEEN YOU & EXPOSURE" />
      </div>
    </Slide>
  );
}

function ProblemCard({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        border: "1.5px solid var(--ov-line-ink)",
        borderRadius: 14,
        padding: 22,
        background:
          "color-mix(in srgb, var(--ov-panel) 70%, transparent)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: "var(--shadow-press-1)",
      }}
    >
      <div
        className="font-display"
        style={{
          fontSize: 38,
          lineHeight: 1,
          color: "var(--ov-accent)",
          letterSpacing: "-0.02em",
        }}
      >
        {n}
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 22,
          textTransform: "uppercase",
          letterSpacing: "0.01em",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14.5, color: "var(--ov-text-dim)", lineHeight: 1.55 }}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </div>
  );
}

function StatBlock({ big, small }: { big: string; small: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        className="font-display"
        style={{
          fontSize: 44,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: "var(--ov-text)",
        }}
      >
        {big}
      </div>
      <div
        className="meta"
        style={{ color: "var(--ov-text-faint)" }}
      >
        {small}
      </div>
    </div>
  );
}

/* --- 03. WHY NOW ---------------------------------------------- */

function SlideWhyNow() {
  return (
    <Slide>
      <SectionTag num="02" label="WHY NOW" />
      <h2
        className="font-display"
        style={{
          fontSize: "clamp(56px, 7vw, 104px)",
          lineHeight: 0.93,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Five layers just{" "}
        <Circle rot={-2}>
          <span style={{ color: "var(--ov-accent)" }}>clicked</span>
        </Circle>{" "}
        into place.
      </h2>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 28,
          alignContent: "center",
        }}
      >
        <RailCard
          tag="SUI MOVE · 2024"
          title="Artifacts are on-chain objects"
          body="Every dataset and model can carry its own on-chain ArtifactRegistry object — tier, owner, license holders, royalty vault, derivative lineage — none of it is a platform&apos;s row."
        />
        <RailCard
          tag="SEAL · 2025"
          title="The license IS the decryption key"
          body="Threshold IBE encryption whose key release is gated by an on-chain Move seal_approve policy. License you hold on-chain → Seal committee releases key shares → bytes decrypt client-side."
        />
        <RailCard
          tag="WALRUS · 2025"
          title="Owner-controlled blob storage"
          body="Encrypted dataset blobs stored on Walrus — owner pays and owns the Blob object; gasless aggregator reads, renewable and deletable on-chain. No third-party pinning service that can drop your files."
        />
      </div>

      <div
        style={{
          paddingTop: 12,
          borderTop: "1.5px solid var(--ov-line-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Script size={1.6} rot={-2}>
          Reef is the seam where all five meet.
        </Script>
        <Stamp>FILED UNDER · INEVITABLE</Stamp>
      </div>
    </Slide>
  );
}

function RailCard({
  tag,
  title,
  body,
}: {
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        border: "1.5px solid var(--ov-line-ink)",
        borderRadius: 14,
        padding: 24,
        background: "var(--ov-panel)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -10,
          left: 18,
          background: "var(--ov-accent)",
          color: "var(--ov-accent-ink)",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          padding: "4px 9px",
          borderRadius: 4,
        }}
      >
        {tag}
      </span>
      <div
        className="font-display"
        style={{
          fontSize: 26,
          textTransform: "uppercase",
          letterSpacing: "0.005em",
          marginTop: 4,
          lineHeight: 1.05,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--ov-text-dim)",
        }}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </div>
  );
}

/* --- 04. SOLUTION --------------------------------------------- */

function SlideSolution() {
  return (
    <Slide pad="48px 90px 30px">
      <SectionTag num="03" label="THE SOLUTION" />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 30,
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(44px, 5.4vw, 78px)",
            lineHeight: 0.92,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            fontWeight: 700,
            maxWidth: "70%",
          }}
        >
          Access is a property of the data.
        </h2>
        <div style={{ transform: "translateY(-6px)" }}>
          <Circle rot={-1.5} pad={22} delay={420}>
            <span
              style={{
                fontFamily: "var(--font-script)",
                fontWeight: 700,
                fontSize: 44,
                lineHeight: 0.95,
                color: "var(--ov-accent)",
                letterSpacing: 0,
                textTransform: "none",
                whiteSpace: "nowrap",
              }}
            >
              the license IS the key.
            </span>
          </Circle>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <ArchDiagram />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          paddingTop: 10,
          borderTop: "1.5px solid var(--ov-line-ink)",
          flexWrap: "wrap",
        }}
      >
        <LegendDot color="var(--ov-accent)" label="CIPHERTEXT · WALRUS BLOB" />
        <LegendDot color="var(--ov-accent)" label="SEAL KEY SHARDS" ring />
        <LegendDot color="var(--ov-navy)" label="LICENSE TOKEN" />
        <LegendDot color="var(--ov-navy)" label="DECRYPTION SHARES" ring />
        <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
          NO SINGLE PARTY — INCLUDING US — CAN DECRYPT
        </span>
      </div>
    </Slide>
  );
}

function LegendDot({
  color,
  label,
  ring,
}: {
  color: string;
  label: string;
  ring?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: ring ? "transparent" : color,
          border: ring ? `2px solid ${color}` : `2px solid ${color}`,
          flex: "none",
        }}
      />
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ov-text-dim)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ----- Animated architecture diagram ----- */

function ArchDiagram() {
  const navy = "var(--ov-navy)";
  const accent = "var(--ov-accent)";
  const line = "var(--ov-line-ink)";

  return (
    <svg
      role="img"
      aria-label="Reef architecture: creator Seal-encrypts dataset and stores the ciphertext on Walrus; the ArtifactRegistry object on Sui holds the seal_approve policy; a buyer who holds a valid license has the Seal committee release key shares, and the ciphertext is fetched from Walrus and decrypted client-side."
      viewBox="0 0 1200 480"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <path
          id="p-creator-walrus"
          d="M 180 220 C 280 100, 380 60, 510 105"
          fill="none"
        />
        <path
          id="p-creator-registry"
          d="M 180 260 C 280 320, 430 320, 595 245"
          fill="none"
        />
        <path
          id="p-buyer-registry"
          d="M 1020 220 C 970 100, 870 60, 725 245"
          fill="none"
        />
        <path
          id="p-registry-buyer"
          d="M 660 360 C 800 380, 920 320, 1020 260"
          fill="none"
        />
        <path
          id="p-walrus-buyer"
          d="M 570 105 C 720 70, 900 80, 1020 200"
          fill="none"
        />

        <filter id="tess-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      {/* === Static connection lines === */}
      <g
        stroke={line}
        strokeWidth={1.4}
        fill="none"
        strokeDasharray="4 6"
        opacity={0.32}
      >
        <use href="#p-creator-walrus" />
        <use href="#p-creator-registry" />
        <use href="#p-buyer-registry" />
        <use href="#p-registry-buyer" />
        <use href="#p-walrus-buyer" />
      </g>

      {/* === Path labels === */}
      <g
        fontFamily="var(--font-mono)"
        fontSize="10.5"
        letterSpacing="2"
        fill="var(--ov-text-faint)"
      >
        <text x="280" y="120">CIPHERTEXT →</text>
        <text x="290" y="345">SEAL KEY SHARDS →</text>
        <text x="800" y="120">← LICENSE</text>
        <text x="810" y="350">← SHARES</text>
        <text x="780" y="65">CIPHERTEXT FETCH →</text>
      </g>

      {/* === Nodes === */}
      {/* Creator */}
      <Node
        cx={130}
        cy={240}
        label="CREATOR"
        sub="client encrypts"
        icon={<LaptopIcon />}
      />
      {/* Walrus */}
      <Node
        cx={540}
        cy={100}
        label="WALRUS"
        sub="blob storage"
        icon={<CubeIcon />}
        small
      />
      {/* License */}
      <Node
        cx={910}
        cy={100}
        label="LICENSE"
        sub="sui move object"
        icon={<CoinIcon />}
        small
      />
      {/* Buyer */}
      <Node
        cx={1070}
        cy={240}
        label="BUYER"
        sub="client decrypts"
        icon={<WalletIcon />}
      />

      {/* Registry — center stage */}
      <RegistryNode cx={660} cy={285} />

      {/* === Moving packets === */}
      {/* A. Creator → Walrus (ciphertext) */}
      <Packets
        href="#p-creator-walrus"
        color={accent}
        count={3}
        dur={5}
        begin={[0, 0.9, 1.8]}
      />
      {/* B. Creator → Registry (Seal shards, hollow) */}
      <Packets
        href="#p-creator-registry"
        color={accent}
        count={3}
        dur={5}
        begin={[0.3, 1.2, 2.1]}
        ring
      />
      {/* C. Buyer → Registry (license token) */}
      <Packets
        href="#p-buyer-registry"
        color={navy}
        count={2}
        dur={5}
        begin={[2.4, 3.2]}
      />
      {/* D. Registry → Buyer (decryption shares) */}
      <Packets
        href="#p-registry-buyer"
        color={navy}
        count={3}
        dur={5}
        begin={[3.0, 3.5, 4.0]}
        ring
      />
      {/* E. Walrus → Buyer (ciphertext fetch) */}
      <Packets
        href="#p-walrus-buyer"
        color={accent}
        count={2}
        dur={5}
        begin={[3.3, 4.1]}
      />

      {/* Reconstruct flash at buyer */}
      <g transform="translate(1070, 240)">
        <circle r="22" fill={accent} opacity={0}>
          <animate
            attributeName="opacity"
            values="0;0.55;0"
            keyTimes="0;0.5;1"
            dur="5s"
            begin="4.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values="14;34;14"
            keyTimes="0;0.5;1"
            dur="5s"
            begin="4.2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}

function Packets({
  href,
  color,
  count,
  dur,
  begin,
  ring,
}: {
  href: string;
  color: string;
  count: number;
  dur: number;
  begin: number[];
  ring?: boolean;
}) {
  return (
    <g>
      {Array.from({ length: count }).map((_, idx) => (
        <circle
          key={idx}
          r={ring ? 5 : 4.5}
          fill={ring ? "transparent" : color}
          stroke={ring ? color : "none"}
          strokeWidth={ring ? 1.8 : 0}
        >
          <animateMotion
            dur={`${dur}s`}
            begin={`${begin[idx] ?? idx * 0.6}s`}
            repeatCount="indefinite"
            keyPoints="0;1"
            keyTimes="0;1"
            calcMode="spline"
            keySplines="0.4 0 0.6 1"
            rotate="auto"
          >
            <mpath href={href} />
          </animateMotion>
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.08;0.92;1"
            dur={`${dur}s`}
            begin={`${begin[idx] ?? idx * 0.6}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </g>
  );
}

function Node({
  cx,
  cy,
  label,
  sub,
  icon,
  small,
}: {
  cx: number;
  cy: number;
  label: string;
  sub: string;
  icon: React.ReactNode;
  small?: boolean;
}) {
  const w = small ? 110 : 132;
  const h = small ? 70 : 88;
  return (
    <g transform={`translate(${cx - w / 2}, ${cy - h / 2})`}>
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={12}
        fill="var(--ov-panel)"
        stroke="var(--ov-line-ink)"
        strokeWidth={1.5}
      />
      <rect
        x={2.5}
        y={2.5}
        width={w}
        height={h}
        rx={12}
        fill="none"
        stroke="var(--ov-navy)"
        strokeWidth={1.5}
        opacity={0.18}
        style={{ pointerEvents: "none" }}
      />
      <g transform={`translate(${w / 2}, ${small ? 22 : 26})`}>{icon}</g>
      <text
        x={w / 2}
        y={small ? 48 : 60}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize={small ? 13 : 15}
        letterSpacing="1.3"
        fill="var(--ov-text)"
      >
        {label}
      </text>
      <text
        x={w / 2}
        y={small ? 60 : 74}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="9"
        letterSpacing="1.5"
        fill="var(--ov-text-faint)"
      >
        {sub.toUpperCase()}
      </text>
    </g>
  );
}

function RegistryNode({ cx, cy }: { cx: number; cy: number }) {
  const ring = 78;
  const validators = [
    { x: 0, y: -ring },
    { x: ring * 0.95, y: -ring * 0.31 },
    { x: ring * 0.59, y: ring * 0.81 },
    { x: -ring * 0.59, y: ring * 0.81 },
    { x: -ring * 0.95, y: -ring * 0.31 },
  ];
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* halo ring */}
      <circle r={ring + 6} fill="none" stroke="var(--ov-line)" strokeWidth={1} strokeDasharray="2 5" />

      {/* Seal key-server committee nodes */}
      {validators.map((v, idx) => (
        <g key={idx} transform={`translate(${v.x}, ${v.y})`}>
          <circle r={9.5} fill="var(--ov-panel)" stroke="var(--ov-navy)" strokeWidth={1.5} />
          <circle r={4} fill="var(--ov-accent)">
            <animate
              attributeName="opacity"
              values="0.35;1;0.35"
              keyTimes="0;0.5;1"
              dur="2.4s"
              begin={`${idx * 0.48}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="3.2;5.2;3.2"
              keyTimes="0;0.5;1"
              dur="2.4s"
              begin={`${idx * 0.48}s`}
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}

      {/* registry core */}
      <circle r={56} fill="var(--ov-panel)" stroke="var(--ov-navy)" strokeWidth={2} />
      <circle r={48} fill="none" stroke="var(--ov-navy)" strokeWidth={1} opacity={0.45} />

      {/* lock icon */}
      <g transform="translate(0, -4)">
        <rect x={-13} y={-2} width={26} height={20} rx={3.5} fill="var(--ov-navy)" />
        <path
          d="M -8 -2 V -10 a 8 8 0 0 1 16 0 V -2"
          fill="none"
          stroke="var(--ov-navy)"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <circle cx={0} cy={8} r={2.2} fill="var(--ov-accent)" />
      </g>

      <text
        textAnchor="middle"
        y={42}
        fontFamily="var(--font-display)"
        fontSize="14"
        letterSpacing="1.4"
        fill="var(--ov-text)"
      >
        SEAL GATE
      </text>
      <text
        textAnchor="middle"
        y={56}
        fontFamily="var(--font-mono)"
        fontSize="9"
        letterSpacing="1.6"
        fill="var(--ov-text-faint)"
      >
        THRESHOLD · IBE
      </text>
    </g>
  );
}

/* ----- node icons (compact pictograms) ----- */

function LaptopIcon() {
  return (
    <g transform="translate(-18, -10)" fill="none" stroke="var(--ov-navy)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round">
      <rect x="0" y="0" width="36" height="22" rx="2.5" />
      <line x1="-4" y1="24" x2="40" y2="24" />
      <line x1="6" y1="6" x2="20" y2="6" stroke="var(--ov-accent)" />
    </g>
  );
}

function CubeIcon() {
  return (
    <g transform="translate(-14, -12)" fill="none" stroke="var(--ov-navy)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round">
      <path d="M 14 0 L 28 7 L 28 21 L 14 28 L 0 21 L 0 7 Z" />
      <path d="M 0 7 L 14 14 L 28 7" />
      <path d="M 14 14 L 14 28" />
    </g>
  );
}

function CoinIcon() {
  return (
    <g transform="translate(0, 0)" fill="none" stroke="var(--ov-navy)" strokeWidth={1.7}>
      <circle r="13" />
      <circle r="9" stroke="var(--ov-accent)" />
      <text
        textAnchor="middle"
        y="3.5"
        fontFamily="var(--font-display)"
        fontSize="12"
        fill="var(--ov-navy)"
        stroke="none"
      >
        L
      </text>
    </g>
  );
}

function WalletIcon() {
  return (
    <g transform="translate(-18, -10)" fill="none" stroke="var(--ov-navy)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round">
      <rect x="0" y="4" width="36" height="22" rx="3" />
      <path d="M 0 10 L 26 10 L 26 4 L 4 4" />
      <circle cx="28" cy="15" r="2.6" fill="var(--ov-accent)" stroke="none" />
    </g>
  );
}

/* --- 05. FIVE TIERS — the product surface ---------------------- */

function SlideTiers() {
  const tiers = [
    {
      n: "01",
      name: "PUBLIC",
      one: "Open, free, provenance-stamped.",
      body: "ArtifactRegistry registered on Sui; file stored in clear on Walrus. Anyone can fetch. seal_approve always allows — encrypted for a uniform path.",
      ex: "open datasets · open-weight models",
      color: "var(--ov-accent)",
    },
    {
      n: "02",
      name: "PRIVATE",
      one: "Owner-only. Registry gated to one wallet.",
      body: "seal_approve checks sender == owner. A second wallet&apos;s read aborts on-chain. No server involved — the Move policy IS the gate.",
      ex: "work-in-progress weights · internal data",
      color: "var(--ov-navy)",
    },
    {
      n: "03",
      name: "GATED",
      one: "Buy the license → decrypt.",
      body: "buy_license pays the owner the artifact&apos;s price in SUI and adds the buyer to license_holders. seal_approve then allows sender == owner || license_holders.contains(sender).",
      ex: "commercial models · premium datasets",
      color: "var(--ov-accent)",
    },
    {
      n: "04",
      name: "GROUP",
      one: "One license unlocks a family.",
      body: "Bundle multiple artifacts behind a shared group membership. Subscribe to a lab — get every model and dataset they ship.",
      ex: "labs · model families · subscriptions",
      color: "var(--ov-navy)",
    },
    {
      n: "05",
      name: "COMPUTE",
      one: "Use it. Never see it.",
      body: "compute_workers.contains(sender) only. The plaintext never returns — only aggregate metrics. A Nautilus TEE enforces the boundary; the result is verified on-chain.",
      ex: "private inference · confidential training",
      color: "var(--ov-accent)",
      highlight: true,
    },
  ];

  return (
    <Slide pad="48px 90px 32px">
      <SectionTag num="04" label="THE PRODUCT SURFACE" />

      <h2
        className="font-display"
        style={{
          fontSize: "clamp(48px, 6vw, 88px)",
          lineHeight: 0.92,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Five tiers. One mechanism.{" "}
        <Underline>
          <Script size={1.1}>cryptographic, all the way down.</Script>
        </Underline>
      </h2>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 14,
          alignContent: "stretch",
        }}
      >
        {tiers.map((t) => (
          <div
            key={t.name}
            style={{
              position: "relative",
              border: `1.5px solid ${t.highlight ? t.color : "var(--ov-line-ink)"}`,
              background: t.highlight
                ? `color-mix(in srgb, ${t.color} 8%, var(--ov-panel))`
                : "var(--ov-panel)",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow: "var(--shadow-press-1)",
            }}
          >
            {t.highlight && (
              <span
                style={{
                  position: "absolute",
                  top: -10,
                  right: 14,
                  background: t.color,
                  color: "var(--ov-accent-ink)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                NEXT SLIDE ↗
              </span>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: t.color,
                }}
              >
                TIER {t.n}
              </span>
              <span
                aria-hidden
                style={{
                  flex: 1,
                  height: 1.5,
                  background: "var(--ov-line)",
                }}
              />
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 28,
                lineHeight: 1,
                letterSpacing: "0.01em",
                color: "var(--ov-text)",
              }}
            >
              {t.name}
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: t.color,
                lineHeight: 1.35,
              }}
            >
              {t.one}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ov-text-dim)",
                lineHeight: 1.5,
              }}
              dangerouslySetInnerHTML={{ __html: t.body }}
            />
            <div style={{ marginTop: "auto" }}>
              <span
                className="font-mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.15em",
                  color: "var(--ov-text-faint)",
                  textTransform: "uppercase",
                }}
              >
                ↳ {t.ex}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          paddingTop: 12,
          borderTop: "1.5px solid var(--ov-line-ink)",
        }}
      >
        <Stamp>SAME SEAL GATE</Stamp>
        <Stamp>SAME LICENSE-AS-KEY MODEL</Stamp>
        <Stamp>DIFFERENT MOVE CONDITIONS</Stamp>
        <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
          THE TIERS ARE JUST DIFFERENT ON-CHAIN seal_approve BRANCHES
        </span>
      </div>
    </Slide>
  );
}

/* --- 06. COMPUTE — the differentiated primitive ---------------- */

function SlideCompute() {
  return (
    <Slide pad="44px 90px 28px">
      <SectionTag num="05" label="THE COMPUTE PRIMITIVE" />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 30,
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(44px, 5.4vw, 80px)",
            lineHeight: 0.92,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            fontWeight: 700,
            maxWidth: "78%",
          }}
        >
          You bring an{" "}
          <span style={{ color: "var(--ov-accent)" }}>input</span>.
          The enclave returns an{" "}
          <span style={{ color: "var(--ov-accent)" }}>output</span>.{" "}
          <Circle rot={-2} pad={16}>
            <span style={{ color: "var(--ov-accent)" }}>the data never leaves.</span>
          </Circle>
        </h2>
        <div style={{ textAlign: "right", paddingBottom: 4 }}>
          <Script size={1.6} rot={-3}>
            computable, not downloadable.
          </Script>
          <div
            className="meta"
            style={{ color: "var(--ov-text-faint)", marginTop: 4 }}
          >
            SUI MOVE VERIFIED THE ENCLAVE.
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <ComputeDiagram />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <ComputeCard
          n="A"
          title="Seal-gated decrypt inside the TEE"
          body="The Nautilus worker holds a compute_workers slot on-chain. Seal releases key shares only to that slot — plaintext exists only inside the AWS Nitro Enclave. Never to an API operator, never to us."
          tag="THE CORE PRIMITIVE"
        />
        <ComputeCard
          n="B"
          title="Allowlisted algorithm, attested result"
          body="The enclave runs only algorithms on the dataset&apos;s on-chain allowlist. It signs the exact result bytes with its ephemeral key. register_derivative_attested verifies that signature on-chain before the derivative is accepted."
          tag="ENCLAVE · ATTESTED ON-CHAIN"
        />
        <ComputeCard
          n="C"
          title="Result registers as derivative"
          body="Every compute run lands on-chain as a derivative of the dataset. Royalties route to the dataset owner automatically. Private data that cannot be downloaded still earns its owner SUI."
          tag="NATIVE PER-RUN ROYALTY"
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          paddingTop: 10,
          borderTop: "1.5px solid var(--ov-line-ink)",
          flexWrap: "wrap",
        }}
      >
        <Stamp>PLAINTEXT NEVER EXITS THE ENCLAVE</Stamp>
        <Stamp>ALGORITHM ALLOWLIST · HASH-PINNED</Stamp>
        <Stamp>RESULT REGISTERS AS DERIVATIVE</Stamp>
        <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
          THE PRIMITIVE NO CENTRALIZED PLATFORM CAN OFFER
        </span>
      </div>
    </Slide>
  );
}

function ComputeCard({
  n,
  title,
  body,
  tag,
}: {
  n: string;
  title: string;
  body: string;
  tag: string;
}) {
  return (
    <div
      style={{
        border: "1.5px solid var(--ov-line-ink)",
        background: "var(--ov-panel)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "var(--shadow-press-1)",
        minHeight: 132,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span
          className="font-display"
          style={{
            fontSize: 32,
            lineHeight: 0.95,
            color: "var(--ov-accent)",
            letterSpacing: "-0.02em",
          }}
        >
          {n}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.18em",
            color: "var(--ov-text-faint)",
            textTransform: "uppercase",
          }}
        >
          {tag}
        </span>
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 22,
          textTransform: "uppercase",
          letterSpacing: "0.005em",
          lineHeight: 1.05,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--ov-text-dim)",
          lineHeight: 1.5,
        }}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </div>
  );
}

/* ----- Compute mini-diagram (animated enclave) ----- */

function ComputeDiagram() {
  const navy = "var(--ov-navy)";
  const accent = "var(--ov-accent)";

  return (
    <svg
      role="img"
      aria-label="Compute primitive: a query enters a Nautilus AWS Nitro Enclave; Seal-gated decrypt, run allowlisted algorithm, emit metrics only; enclave signs the result; register_derivative_attested verifies on-chain."
      viewBox="0 0 1200 320"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <path id="cp-query"  d="M 170 160 C 220 160, 270 160, 310 160" fill="none" />
        <path id="cp-answer" d="M 940 160 C 980 160, 1030 160, 1070 160" fill="none" />
        <path id="cp-bounce" d="M 380 160 C 500 160, 580 160, 720 160" fill="none" />
        <path id="cp-final"  d="M 800 160 C 840 160, 880 160, 920 160" fill="none" />
      </defs>

      {/* === Buyer (left) === */}
      <g transform="translate(110, 160)">
        <rect x={-46} y={-34} width={92} height={68} rx={11} fill="var(--ov-panel)" stroke="var(--ov-line-ink)" strokeWidth={1.5} />
        <g transform="translate(0, -8)"><WalletIcon /></g>
        <text textAnchor="middle" y={16} fontFamily="var(--font-display)" fontSize={13} letterSpacing="1.3" fill="var(--ov-text)">
          CONSUMER
        </text>
        <text textAnchor="middle" y={28} fontFamily="var(--font-mono)" fontSize={9} letterSpacing="1.4" fill="var(--ov-text-faint)">
          ONLY SEES METRICS
        </text>
      </g>

      {/* === Enclave (the sealed zone) === */}
      <g>
        {/* outer dashed frame */}
        <rect
          x={300} y={56} width={620} height={210}
          rx={18}
          fill="color-mix(in srgb, var(--ov-navy) 4%, var(--ov-panel))"
          stroke={navy}
          strokeWidth={2}
          strokeDasharray="6 5"
        />
        {/* enclave label */}
        <g transform="translate(610, 38)">
          <rect x={-170} y={-15} width={340} height={28} rx={6} fill="var(--ov-bg)" stroke={navy} strokeWidth={1.5} />
          <text textAnchor="middle" y={5} fontFamily="var(--font-display)" fontSize={13} letterSpacing="2.2" fill={navy}>
            AWS NITRO ENCLAVE · NAUTILUS · PLAINTEXT ZONE
          </text>
        </g>
        {/* corner lock indicators (sealed) */}
        {[
          [314, 70],
          [902, 70],
          [314, 246],
          [902, 246],
        ].map(([x, y], idx) => (
          <g key={idx} transform={`translate(${x}, ${y})`}>
            <circle r={4} fill={accent}>
              <animate
                attributeName="opacity"
                values="0.5;1;0.5"
                dur="2.6s"
                begin={`${idx * 0.4}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}

        {/* === Three internal stages: SEAL DECRYPT → RUN ALGO → SIGN OUTPUT === */}
        <Stage cx={365} cy={160} title="SEAL DECRYPT" sub="compute_workers" begin={0} />
        <Stage cx={610} cy={160} title="RUN ALGO" sub="allowlisted only" begin={1.2} accent />
        <Stage cx={855} cy={160} title="SIGN OUTPUT" sub="enclave key" begin={2.4} />

        {/* "plaintext lives here only" caption */}
        <text
          x={610}
          y={218}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize={9.5}
          letterSpacing="1.6"
          fill="var(--ov-accent)"
        >
          PLAINTEXT LIVES HERE ONLY · NEVER EXITS
        </text>

        {/* caption above the enclave */}
        <text
          x={610}
          y={82}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize={9.5}
          letterSpacing="1.6"
          fill="var(--ov-text-faint)"
        >
          ENCLAVE SIGNS RESULT · register_derivative_attested VERIFIES ON-CHAIN
        </text>

        {/* Connector stubs inside enclave */}
        <g stroke={navy} strokeWidth={1.4} fill="none" strokeDasharray="3 5" opacity={0.45}>
          <line x1={410} y1={160} x2={565} y2={160} />
          <line x1={655} y1={160} x2={810} y2={160} />
        </g>
      </g>

      {/* === Right-side "metrics return" cap === */}
      <g transform="translate(1100, 160)">
        <circle r={32} fill="var(--ov-panel)" stroke={accent} strokeWidth={2} />
        <text textAnchor="middle" y={-2} fontFamily="var(--font-display)" fontSize={11} letterSpacing="1.5" fill={accent}>
          METRICS
        </text>
        <text textAnchor="middle" y={11} fontFamily="var(--font-mono)" fontSize={9} letterSpacing="1.3" fill="var(--ov-text-faint)">
          ON-CHAIN
        </text>
      </g>

      {/* === Static path lines === */}
      <g stroke="var(--ov-line-ink)" strokeWidth={1.4} fill="none" strokeDasharray="4 6" opacity={0.32}>
        <use href="#cp-query" />
        <use href="#cp-answer" />
      </g>

      {/* === Path labels === */}
      <g fontFamily="var(--font-mono)" fontSize="10.5" letterSpacing="2" fill="var(--ov-text-faint)">
        <text x="200" y="146">INPUT →</text>
        <text x="956" y="146">→ METRICS</text>
      </g>

      {/* === Animated query packet (navy, enters enclave) === */}
      <circle r={5} fill={navy}>
        <animateMotion dur="3.5s" begin="0s" repeatCount="indefinite">
          <mpath href="#cp-query" />
        </animateMotion>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="3.5s" repeatCount="indefinite" />
      </circle>

      {/* === Internal "bytes" packets === */}
      <circle r={4} fill={accent} opacity={0.85}>
        <animateMotion dur="3.5s" begin="0.6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.6 1">
          <mpath href="#cp-bounce" />
        </animateMotion>
        <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.1;0.85;1" dur="3.5s" begin="0.6s" repeatCount="indefinite" />
      </circle>
      <circle r={4} fill={accent} opacity={0.85}>
        <animateMotion dur="3.5s" begin="1.4s" repeatCount="indefinite">
          <mpath href="#cp-final" />
        </animateMotion>
        <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.12;0.85;1" dur="3.5s" begin="1.4s" repeatCount="indefinite" />
      </circle>

      {/* === Answer packet exits enclave === */}
      <circle r={5} fill={accent}>
        <animateMotion dur="3.5s" begin="2.4s" repeatCount="indefinite">
          <mpath href="#cp-answer" />
        </animateMotion>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="3.5s" begin="2.4s" repeatCount="indefinite" />
      </circle>

      {/* === Plaintext-blocked barrier indicator === */}
      <g transform="translate(920, 220)">
        <text fontFamily="var(--font-mono)" fontSize={9} letterSpacing="1.5" fill="var(--ov-text-faint)">
          ◀ PLAINTEXT BLOCKED · METRICS ONLY ▶
        </text>
      </g>
    </svg>
  );
}

function Stage({
  cx,
  cy,
  title,
  sub,
  begin,
  accent,
}: {
  cx: number;
  cy: number;
  title: string;
  sub: string;
  begin: number;
  accent?: boolean;
}) {
  const w = 100;
  const h = 64;
  const stroke = accent ? "var(--ov-accent)" : "var(--ov-navy)";
  return (
    <g transform={`translate(${cx - w / 2}, ${cy - h / 2})`}>
      <rect x={0} y={0} width={w} height={h} rx={10} fill="var(--ov-panel)" stroke={stroke} strokeWidth={1.7} />
      <rect x={0} y={0} width={w} height={h} rx={10} fill={stroke} opacity={0}>
        <animate
          attributeName="opacity"
          values="0;0.18;0"
          keyTimes="0;0.3;1"
          dur="3.5s"
          begin={`${begin}s`}
          repeatCount="indefinite"
        />
      </rect>
      <text
        textAnchor="middle"
        x={w / 2}
        y={26}
        fontFamily="var(--font-display)"
        fontSize="12"
        letterSpacing="1.1"
        fill="var(--ov-text)"
      >
        {title}
      </text>
      <text
        textAnchor="middle"
        x={w / 2}
        y={43}
        fontFamily="var(--font-mono)"
        fontSize="9"
        letterSpacing="1.4"
        fill="var(--ov-text-faint)"
      >
        {sub}
      </text>
      <circle cx={w - 9} cy={9} r={2.6} fill={stroke}>
        <animate
          attributeName="opacity"
          values="0.3;1;0.3"
          dur="1.8s"
          begin={`${begin}s`}
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
}

/* --- 07. PROVENANCE — lineage + royalty ----------------------- */

function SlideProvenance() {
  return (
    <Slide pad="48px 90px 32px">
      <SectionTag num="06" label="PROVENANCE & ROYALTY" />

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 30,
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(46px, 5.6vw, 84px)",
            lineHeight: 0.92,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            fontWeight: 700,
            maxWidth: "76%",
          }}
        >
          Every derivative remembers its{" "}
          <Circle rot={-2} pad={18}>
            <span style={{ color: "var(--ov-accent)" }}>parent.</span>
          </Circle>
        </h2>
        <div style={{ textAlign: "right", paddingBottom: 4 }}>
          <Script size={1.5} rot={-3}>
            forever.
          </Script>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr) minmax(0, 0.95fr)",
          gap: 18,
          alignContent: "stretch",
        }}
      >
        {/* === Column 1 — Lineage === */}
        <div
          style={{
            border: "1.5px solid var(--ov-line-ink)",
            background: "var(--ov-panel)",
            borderRadius: 14,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            boxShadow: "var(--shadow-press-1)",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                color: "var(--ov-accent)",
              }}
            >
              MODULE · LINEAGE
            </span>
            <span
              className="meta"
              style={{ color: "var(--ov-text-faint)" }}
            >
              A1 – A5
            </span>
          </div>
          <div
            className="font-display"
            style={{
              fontSize: 26,
              textTransform: "uppercase",
              letterSpacing: "0.005em",
              lineHeight: 1.05,
            }}
          >
            Every fine-tune links to its parent.
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--ov-text-dim)",
              lineHeight: 1.5,
            }}
          >
            Register a model? Declare its parent dataset. The <code style={{ background: "var(--ov-bg-elev)", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>register_derivative</code> call writes an on-chain <code style={{ background: "var(--ov-bg-elev)", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>parent</code> edge to the ArtifactRegistry. Lineage is mandatory and immutable.
          </div>

          <div style={{ flex: 1, minHeight: 0, marginTop: 6 }}>
            <LineageMini />
          </div>
        </div>

        {/* === Column 2 — Royalty === */}
        <div
          style={{
            border: "1.5px solid var(--ov-line-ink)",
            background: "var(--ov-panel)",
            borderRadius: 14,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            boxShadow: "var(--shadow-press-1)",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                color: "var(--ov-accent)",
              }}
            >
              MODULE · ROYALTY
            </span>
            <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
              §8.5
            </span>
          </div>
          <div
            className="font-display"
            style={{
              fontSize: 26,
              textTransform: "uppercase",
              letterSpacing: "0.005em",
              lineHeight: 1.05,
            }}
          >
            Revenue cascades upstream.
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--ov-text-dim)",
              lineHeight: 1.5,
            }}
          >
            Every <code style={{ background: "var(--ov-bg-elev)", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>buy_license</code> and compute fee accrues to an on-chain <code style={{ background: "var(--ov-bg-elev)", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>Balance&lt;SUI&gt;</code> vault. A &rarr; B &rarr; C derivative chain means royalties flow all the way back to the source dataset — no off-chain reconciliation.
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <RoyaltyRow source="dataset" verb="trained →" model="model-v1" pct="5%" />
            <RoyaltyRow source="model-v1" verb="fine-tuned →" model="model-v2" pct="3%" />
            <RoyaltyRow source="compute result" verb="derived from →" model="dataset" pct="0.1%" />
          </div>
        </div>

        {/* === Column 3 — Tatum integration === */}
        <div
          style={{
            border: "1.5px solid var(--ov-line-ink)",
            background: "var(--ov-panel)",
            borderRadius: 14,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            boxShadow: "var(--shadow-press-1)",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                color: "var(--ov-accent)",
              }}
            >
              MODULE · TATUM
            </span>
            <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
              3 CAPABILITIES
            </span>
          </div>
          <div
            className="font-display"
            style={{
              fontSize: 26,
              textTransform: "uppercase",
              letterSpacing: "0.005em",
              lineHeight: 1.05,
            }}
          >
            RPC, push indexer, live status.
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--ov-text-dim)",
              lineHeight: 1.5,
            }}
          >
            Every Sui JSON-RPC call routes through the <strong>Tatum gateway</strong> with <code style={{ background: "var(--ov-bg-elev)", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>x-api-key</code> and 429 backoff. On-chain events are <strong>pushed</strong> via Tatum v4 address subscriptions. A live gas-price / checkpoint surface shows &ldquo;via Tatum&rdquo; in the header — the key never reaches the browser.
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <TatumRow cap="1" text="Sui JSON-RPC gateway (x-api-key, 429 backoff)" />
            <TatumRow cap="2" text="Notification webhooks → push indexer" />
            <TatumRow cap="3" text="Network / gas status surface" />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          paddingTop: 10,
          borderTop: "1.5px solid var(--ov-line-ink)",
        }}
      >
        <Stamp>NEVER LOSE A PARENT</Stamp>
        <Stamp>ROYALTIES CASCADE FOREVER</Stamp>
        <Stamp>TATUM RPC · PUSH · STATUS</Stamp>
        <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
          PROVENANCE IS THE PRODUCT
        </span>
      </div>
    </Slide>
  );
}

function LineageMini() {
  return (
    <svg
      viewBox="0 0 380 160"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <path id="ln-a-b" d="M 60 60 C 110 60, 130 60, 175 60" fill="none" />
        <path id="ln-b-c" d="M 215 60 C 260 60, 280 60, 320 60" fill="none" />
        <path id="ln-c-r" d="M 320 78 C 320 110, 320 120, 320 140" fill="none" />
        <path id="ln-r-a" d="M 320 140 C 220 140, 130 140, 60 80" fill="none" />
      </defs>

      {/* dashed lineage lines */}
      <g
        stroke="var(--ov-line-ink)"
        strokeWidth={1.5}
        fill="none"
        strokeDasharray="4 5"
        opacity={0.45}
      >
        <use href="#ln-a-b" />
        <use href="#ln-b-c" />
      </g>

      {/* solid royalty return path */}
      <g
        stroke="var(--ov-accent)"
        strokeWidth={1.7}
        fill="none"
      >
        <path d="M 320 78 C 320 110, 320 120, 320 140" />
        <path d="M 320 140 C 220 140, 130 140, 60 80" />
      </g>

      {/* nodes */}
      <LineNode cx={40} cy={60} label="DATASET" sub="walrus blob" />
      <LineNode cx={195} cy={60} label="MODEL v1" sub="fine-tuned" accent />
      <LineNode cx={335} cy={60} label="COMPUTE" sub="derivative" />

      {/* royalty packet */}
      <circle r={4.5} fill="var(--ov-accent)">
        <animateMotion dur="3s" repeatCount="indefinite">
          <mpath href="#ln-c-r" />
        </animateMotion>
      </circle>
      <circle r={4.5} fill="var(--ov-accent)">
        <animateMotion dur="3s" begin="0.4s" repeatCount="indefinite">
          <mpath href="#ln-r-a" />
        </animateMotion>
      </circle>

      <text
        x={190}
        y={156}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="10"
        letterSpacing="2"
        fill="var(--ov-accent)"
      >
        ← ROYALTY CASCADES UPSTREAM
      </text>
    </svg>
  );
}

function LineNode({
  cx,
  cy,
  label,
  sub,
  accent,
}: {
  cx: number;
  cy: number;
  label: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <circle
        r={18}
        fill="var(--ov-panel)"
        stroke={accent ? "var(--ov-accent)" : "var(--ov-navy)"}
        strokeWidth={1.8}
      />
      <text
        textAnchor="middle"
        y={-26}
        fontFamily="var(--font-display)"
        fontSize="11"
        letterSpacing="1.6"
        fill="var(--ov-text)"
      >
        {label}
      </text>
      <text
        textAnchor="middle"
        y={36}
        fontFamily="var(--font-mono)"
        fontSize="9"
        letterSpacing="1.4"
        fill="var(--ov-text-faint)"
      >
        {sub}
      </text>
    </g>
  );
}

function RoyaltyRow({
  source,
  verb,
  model,
  pct,
}: {
  source: string;
  verb: string;
  model: string;
  pct: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.04em",
        padding: "6px 8px",
        border: "1px solid var(--ov-line)",
        borderRadius: 6,
        background: "var(--ov-bg-elev)",
      }}
    >
      <span style={{ color: "var(--ov-text)" }}>{source}</span>
      <span style={{ color: "var(--ov-text-faint)" }}>{verb}</span>
      <span style={{ color: "var(--ov-text)" }}>{model}</span>
      <span style={{ flex: 1 }} />
      <span
        style={{
          color: "var(--ov-accent)",
          fontWeight: 700,
          fontSize: 12.5,
        }}
      >
        {pct}
      </span>
    </div>
  );
}

function TatumRow({ cap, text }: { cap: string; text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 11.5,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "var(--ov-accent)",
          color: "var(--ov-accent-ink)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          flex: "none",
        }}
      >
        {cap}
      </span>
      <span
        style={{
          color: "var(--ov-text-dim)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
        }}
      >
        {text}
      </span>
    </div>
  );
}

/* --- 08. LIVE TESTNET EVIDENCE -------------------------------- */

function SlideStack() {
  const pkg = "0x3203061e…63db7d";
  const enclaveObj = "0x2bf98f2a…5b21e";
  const txRegEnc = "3m78crZ2…BbnS";
  const txRegDeriv = "926wJkXL…Mco";

  const layers: Array<{ tag: string; title: string; body: string }> = [
    { tag: "01 · WALRUS", title: "Blob Storage", body: "Seal-encrypted dataset blobs. Owner pays + owns the Blob object. Gasless reads via the aggregator. No pinning service." },
    { tag: "02 · SEAL", title: "Threshold IBE", body: "Key released only when seal_approve succeeds on-chain. Key-server committee. Fails closed on NoAccessError." },
    { tag: "03 · SUI MOVE", title: "reef::registry", body: "One ArtifactRegistry per artifact: tier, license holders, compute allowlist, group, royalty vault, parent edge." },
    { tag: "04 · NAUTILUS", title: "AWS Nitro TEE", body: "Seal decrypt + allowlisted algo run inside a real hardware enclave. Enclave signs; register_derivative_attested verifies on-chain." },
    { tag: "05 · TATUM", title: "RPC + Push + Status", body: "Sui gateway (x-api-key, 429 backoff), v4 address webhooks → push indexer, live gas/checkpoint status surface." },
  ];

  return (
    <Slide>
      <SectionTag num="07" label="LIVE ON SUI TESTNET · 2026-06-06" />
      <h2
        className="font-display"
        style={{
          fontSize: "clamp(52px, 6.4vw, 96px)",
          lineHeight: 0.92,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Five layers.{" "}
        <Circle rot={-2}>
          <span style={{ color: "var(--ov-accent)" }}>all verified.</span>
        </Circle>
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {layers.map((m) => (
          <div
            key={m.tag}
            style={{
              border: "1.5px solid var(--ov-line-ink)",
              borderRadius: 10,
              padding: 14,
              background: "var(--ov-panel)",
              minHeight: 152,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              boxShadow: "var(--shadow-press-1)",
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--ov-accent)",
              }}
            >
              {m.tag}
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 22,
                textTransform: "uppercase",
                letterSpacing: "0.01em",
                lineHeight: 1.05,
              }}
            >
              {m.title}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ov-text-dim)",
                lineHeight: 1.5,
              }}
            >
              {m.body}
            </div>
          </div>
        ))}
      </div>

      {/* Live testnet evidence table */}
      <div
        style={{
          marginTop: "auto",
          padding: "14px 0 0",
          borderTop: "1.5px solid var(--ov-line-ink)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          className="meta"
          style={{ color: "var(--ov-text)", marginBottom: 2, letterSpacing: "0.18em" }}
        >
          TESTNET EVIDENCE · 24 MOVE TESTS PASSING
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          <EvidenceRow label="REEF PACKAGE" value={pkg} />
          <EvidenceRow label="ENCLAVE<REEF> OBJECT" value={enclaveObj} />
          <EvidenceRow label="register_enclave TX (AWS attestation verified)" value={txRegEnc} />
          <EvidenceRow label="register_derivative_attested TX (enclave sig verified)" value={txRegDeriv} />
          <EvidenceRow label="COMPUTE RESULT (inside AWS Nitro Enclave)" value="{ columnMeans_0: 4, columnMeans_1: 5, columnMeans_2: 6, n: 3 }" wide />
        </div>
      </div>
    </Slide>
  );
}

function EvidenceRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        padding: "5px 8px",
        border: "1px solid var(--ov-line)",
        borderRadius: 6,
        background: "var(--ov-bg-elev)",
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <span style={{ color: "var(--ov-text-faint)", letterSpacing: "0.1em", textTransform: "uppercase", flex: "none" }}>
        {label}
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ color: "var(--ov-accent)", letterSpacing: "0.05em" }}>
        {value}
      </span>
    </div>
  );
}

/* --- 09. ASK -------------------------------------------------- */

function SlideAsk() {
  return (
    <Slide>
      <SectionTag num="08" label="THE ASK" />

      <h2
        className="font-display"
        style={{
          fontSize: "clamp(58px, 7.6vw, 116px)",
          lineHeight: 0.9,
          letterSpacing: "-0.015em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Two things we need{" "}
        <Script size={1.1} rot={-3}>
          next.
        </Script>
      </h2>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 22,
          alignContent: "center",
        }}
      >
        <AskCard
          n="01"
          title="Pilot dataset partner"
          body="A real AI/ML team with confidential data they want to monetize. We deploy them on Reef in a week — they keep the on-chain royalties. The Tatum integration means no node ops: just bring the data."
          stamp="INTRO US"
        />
        <AskCard
          n="02"
          title="Walrus + Tatum ecosystem distribution"
          body="Co-marketing into the Walrus and Tatum developer communities. We bring the cryptographic privacy + attested compute; they bring the storage and RPC distribution. Every dataset that ships is a live Walrus blob and a Tatum-routed on-chain event."
          stamp="AMPLIFY"
        />
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingTop: 18,
          borderTop: "1.5px solid var(--ov-line-ink)",
          gap: 18,
        }}
      >
        <div>
          <div
            className="meta"
            style={{ color: "var(--ov-text-faint)", marginBottom: 6 }}
          >
            VOL. 01 · END · CONTINUED IN VOL. 02
          </div>
          <div
            className="font-display"
            style={{
              fontSize: 72,
              lineHeight: 0.95,
              textTransform: "uppercase",
              letterSpacing: "-0.015em",
              fontWeight: 700,
            }}
          >
            Reef.
          </div>
          <Script size={1.6} rot={-2}>
            Access lives in the data.
          </Script>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <Stamp>SUI TESTNET · LIVE TODAY</Stamp>
          <Stamp>GITHUB.COM/REEF</Stamp>
          <Stamp>LIVE DEMO · /BROWSE</Stamp>
        </div>
      </div>
    </Slide>
  );
}

function AskCard({
  n,
  title,
  body,
  stamp,
}: {
  n: string;
  title: string;
  body: string;
  stamp: string;
}) {
  return (
    <div
      style={{
        border: "1.5px solid var(--ov-line-ink)",
        background: "var(--ov-panel)",
        borderRadius: 14,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "var(--shadow-press-2)",
        position: "relative",
      }}
    >
      <div
        className="font-display"
        style={{
          fontSize: 68,
          lineHeight: 0.9,
          color: "var(--ov-accent)",
          letterSpacing: "-0.02em",
        }}
      >
        {n}
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 28,
          textTransform: "uppercase",
          letterSpacing: "0.005em",
          lineHeight: 1.05,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14.5,
          color: "var(--ov-text-dim)",
          lineHeight: 1.6,
        }}
      >
        {body}
      </div>
      <div style={{ marginTop: "auto" }}>
        <Stamp>{stamp}</Stamp>
      </div>
    </div>
  );
}
