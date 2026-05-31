"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { seg: "", label: "Card" },
  { seg: "files", label: "Files" },
  { seg: "viewer", label: "Viewer" },
  { seg: "community", label: "Community" },
  { seg: "license", label: "License" },
];

export default function ArtifactTabs({ ipId }: { ipId: string }) {
  const pathname = usePathname();
  const base = `/artifact/${ipId}`;
  return (
    <nav
      className="ov-tabs"
      style={{
        display: "flex",
        gap: 18,
        flexWrap: "wrap",
        borderBottom: "2px solid var(--ov-line-ink)",
        marginBottom: 22,
      }}
    >
      {TABS.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname === href : pathname === base;
        return (
          <Link
            key={t.label}
            href={href}
            className={`nav-link${active ? " active" : ""}`}
            style={{ paddingBottom: 10 }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
