"use client";

// Run panel for a MODEL artifact. Sends a prompt to /api/run and streams the
// reply token-by-token. Parses the OpenAI-compatible SSE the proxy forwards.
//
// Honest about backend state: a 503 from the route means inference isn't wired
// up — we say exactly that instead of spinning forever or faking a response.

import { useState, useRef } from "react";

type Phase = "idle" | "streaming" | "done" | "error";

export default function RunInference({ ipId }: { ipId: string }) {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    if (!prompt.trim() || phase === "streaming") return;
    setOutput("");
    setError("");
    setPhase("streaming");
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setError(j.error || `HTTP ${res.status}`);
        setPhase("error");
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // SSE frames are newline-delimited "data: {...}" lines.
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices?.[0]?.delta?.content ?? "";
            if (delta) setOutput((o) => o + delta);
          } catch {
            // partial frame — ignore, next chunk completes it
          }
        }
      }
      setPhase("done");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setPhase("error");
    }
  }

  function stop() {
    abortRef.current?.abort();
    setPhase("done");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, color: "var(--ov-text-dim)", fontSize: 13 }}>
        Runs this model on the project GPU backend (NVIDIA A10G). Output streams
        live. Inference runs server-side — your prompt is sent to the inference
        host, not stored on-chain.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter a prompt…"
        rows={4}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
        }}
        style={{
          width: "100%",
          resize: "vertical",
          padding: "12px 14px",
          borderRadius: 12,
          border: "2px solid var(--ov-line-ink)",
          background: "var(--ov-panel)",
          color: "var(--ov-text)",
          fontSize: 14,
          fontFamily: "inherit",
        }}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {phase === "streaming" ? (
          <button className="btn" onClick={stop}>
            Stop
          </button>
        ) : (
          <button
            className="btn btn-accent"
            onClick={run}
            disabled={!prompt.trim()}
          >
            Run
          </button>
        )}
        <span style={{ color: "var(--ov-text-faint)", fontSize: 12 }}>
          ⌘/Ctrl + Enter
        </span>
      </div>

      {error && (
        <div
          style={{
            border: "2px solid var(--ov-line-ink)",
            borderRadius: 12,
            padding: "12px 14px",
            background: "color-mix(in srgb, crimson 12%, transparent)",
            color: "var(--ov-text)",
            fontSize: 13,
          }}
        >
          <strong>Inference error.</strong> {error}
        </div>
      )}

      {(output || phase === "streaming") && (
        <div
          style={{
            border: "2px solid var(--ov-line-ink)",
            borderRadius: 12,
            padding: "14px 16px",
            background: "var(--ov-panel)",
            color: "var(--ov-text)",
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            minHeight: 48,
          }}
        >
          {output}
          {phase === "streaming" && (
            <span style={{ opacity: 0.5 }}>▍</span>
          )}
        </div>
      )}
    </div>
  );
}
