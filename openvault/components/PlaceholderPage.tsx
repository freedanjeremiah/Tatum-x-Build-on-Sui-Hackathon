/** Minimal "coming soon" scaffold so nav links never 404 in Phase 4a. */
export default function PlaceholderPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-[1400px] flex-col items-center justify-center px-5 text-center">
      <div className="ov-anim-up flex flex-col items-center gap-4">
        <span className="rounded-full border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--ov-accent)]">
          {eyebrow}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--ov-text)]">
          {title}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-[var(--ov-text-dim)]">
          {description}
        </p>
      </div>
    </div>
  );
}
