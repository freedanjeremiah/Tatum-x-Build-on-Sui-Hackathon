"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

export interface DropdownOption<V extends string = string> {
  value: V;
  label: string;
}

interface DropdownProps<V extends string = string> {
  value: V;
  options: DropdownOption<V>[];
  onChange: (v: V) => void;
  minWidth?: number;
  align?: "left" | "right";
}

/** Custom select. Native <select> is replaced because it can't be styled to
 * match the MECHATONE language. */
export default function Dropdown<V extends string = string>({
  value,
  options,
  onChange,
  minWidth = 150,
  align = "left",
}: DropdownProps<V>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const cur = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          minWidth,
          background: "var(--ov-bg-elev)",
          border: `1.5px solid ${open ? "var(--ov-accent)" : "var(--ov-line)"}`,
          borderRadius: "var(--radius-lg)",
          padding: "9px 12px",
          color: "var(--ov-text)",
          fontSize: 12.5,
          fontWeight: 600,
          fontFamily: "var(--font-sans)",
          cursor: "pointer",
          boxShadow: open ? "0 0 0 3px rgba(232,71,43,0.12)" : "none",
          transition: "all .14s",
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{cur?.label}</span>
        <span
          style={{
            display: "inline-flex",
            color: "var(--ov-text-faint)",
            transition: "transform .18s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        >
          <Icon name="chevron" size={15} />
        </span>
      </button>
      {open ? (
        <div
          className="panel anim-up"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            zIndex: 50,
            minWidth: "100%",
            padding: 5,
            right: align === "right" ? 0 : "auto",
            left: align === "right" ? "auto" : 0,
            boxShadow: "4px 5px 0 rgba(33,53,108,0.16)",
          }}
        >
          {options.map((o) => {
            const sel = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!sel) e.currentTarget.style.background = "var(--ov-panel-2)";
                }}
                onMouseLeave={(e) => {
                  if (!sel) e.currentTarget.style.background = "transparent";
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 7,
                  border: 0,
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: "var(--font-sans)",
                  color: sel ? "var(--ov-accent)" : "var(--ov-text)",
                  background: sel
                    ? "color-mix(in srgb, var(--ov-accent) 11%, transparent)"
                    : "transparent",
                }}
              >
                <span style={{ flex: 1 }}>{o.label}</span>
                {sel ? <Icon name="check" size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
