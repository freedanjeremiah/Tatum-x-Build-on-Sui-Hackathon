/* ============================================================
   OPENVAULT — shared components
   ============================================================ */
// expose hooks as globals so every text/babel script can use bare names
window.useState = React.useState;
window.useEffect = React.useEffect;
window.useRef = React.useRef;
const { useState, useEffect, useRef } = window;

/* ---------- helpers ---------- */
function truncId(id, n) {
  if (!id) return '';
  n = n || 4;
  return id.slice(0, 2 + n) + '…' + id.slice(-n);
}
function tierOf(key) { return window.OV.TIERS[key]; }
function go(hash) { window.location.hash = hash; }

/* ---------- inline icons (stroke-only, 2px, rounded) ---------- */
function Icon({ name, size, style }) {
  const s = size || 16;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  const P = {
    lock: <React.Fragment><rect x="4" y="10.5" width="16" height="10" rx="2.2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><circle cx="12" cy="15.4" r="1.2"/></React.Fragment>,
    vault: <React.Fragment><rect x="3.5" y="4" width="17" height="16" rx="2.4"/><circle cx="12" cy="12" r="3.4"/><path d="M12 8.6V6.4M12 17.6v-2.2M8.6 12H6.4M17.6 12h-2.2"/></React.Fragment>,
    arrow: <React.Fragment><path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></React.Fragment>,
    compute: <React.Fragment><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M15 4v16M4 9h16M4 15h16"/></React.Fragment>,
    search: <React.Fragment><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></React.Fragment>,
    flag: <React.Fragment><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></React.Fragment>,
    check: <path d="M5 12.5l4.5 4.5L19 6.5"/>,
    chevron: <path d="M6 9l6 6 6-6"/>,
    chevronUp: <path d="M6 15l6-6 6 6"/>,
    key: <React.Fragment><circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2 2M14 8l2 2"/></React.Fragment>,
    plus: <React.Fragment><path d="M12 5v14M5 12h14"/></React.Fragment>,
    refresh: <React.Fragment><path d="M20 11a8 8 0 0 0-14.3-4.2M4 4v3h3"/><path d="M4 13a8 8 0 0 0 14.3 4.2M20 20v-3h-3"/></React.Fragment>,
    shield: <React.Fragment><path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="M9.5 12l1.8 1.8L15 9.8"/></React.Fragment>,
    external: <React.Fragment><path d="M14 4h6v6M20 4l-8 8M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></React.Fragment>,
    copy: <React.Fragment><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></React.Fragment>,
    upload: <React.Fragment><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></React.Fragment>,
    download: <React.Fragment><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></React.Fragment>,
    trophy: <React.Fragment><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 17h6M10 13.5V17M14 13.5V17M8 20h8"/></React.Fragment>,
    close: <React.Fragment><path d="M6 6l12 12M18 6L6 18"/></React.Fragment>,
    play: <path d="M7 5l11 7-11 7z"/>,
    bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6z"/>,
    layers: <React.Fragment><path d="M12 3l8 4.5-8 4.5-8-4.5z"/><path d="M4 12l8 4.5 8-4.5"/><path d="M4 16.5l8 4.5 8-4.5"/></React.Fragment>,
  };
  return <svg {...common}>{P[name]}</svg>;
}

/* ---------- tier glyph (per-tier lock area) ---------- */
function TierGlyph({ tier, size }) {
  const t = tierOf(tier);
  const name = t.glyph === 'arrow' ? 'arrow' : t.glyph === 'compute' ? 'compute' : t.glyph === 'group' ? 'layers' : 'lock';
  return <span style={{ color: t.color, display: 'inline-flex' }}><Icon name={name} size={size || 14} /></span>;
}

/* ---------- TierBadge ---------- */
function TierBadge({ tier }) {
  const t = tierOf(tier);
  return (
    <span className="tier-badge" style={{ color: t.color, borderColor: t.color, background: 'color-mix(in srgb, ' + t.color + ' 12%, transparent)' }}>
      <span className="tier-dot" style={{ background: t.color }}></span>{t.label}
    </span>
  );
}

/* ---------- ModalityChip ---------- */
function ModalityChip({ modality }) {
  return <span className="chip">{modality === 'model' ? 'Model' : 'Dataset'}</span>;
}

/* ---------- TxLink ---------- */
function TxLink({ ipId, tx, label }) {
  const isIpa = !!ipId;
  const id = ipId || tx;
  const href = (isIpa ? window.OV.EXPLORER_IPA : window.OV.EXPLORER_TX) + id;
  return (
    <a className="txlink" href={href} target="_blank" rel="noreferrer" title={id}>
      {label ? <span style={{ opacity: .7 }}>{label}</span> : null}
      {truncId(id)}
      <span className="suffix">{isIpa ? 'IPA' : 'TX'}</span>
    </a>
  );
}

/* ---------- Spinner ---------- */
function Spinner({ lg }) { return <span className={'spinner' + (lg ? ' spinner-lg' : '')}></span>; }

/* ---------- Field ---------- */
function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span style={{ display: 'block', marginTop: 6, fontSize: 11.5, color: 'var(--ov-text-faint)' }}>{hint}</span> : null}
    </label>
  );
}

/* ---------- Custom Dropdown (replaces native select) ---------- */
function Dropdown({ value, options, onChange, minWidth, align }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const cur = options.find(o => o.value === value) || options[0];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} type="button"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: minWidth || 150,
          background: 'var(--ov-bg-elev)', border: '1.5px solid ' + (open ? 'var(--ov-accent)' : 'var(--ov-line)'),
          borderRadius: 'var(--radius-lg)', padding: '9px 12px', color: 'var(--ov-text)', fontSize: 12.5, fontWeight: 600,
          fontFamily: 'var(--font-sans)', cursor: 'pointer', boxShadow: open ? '0 0 0 3px rgba(232,71,43,0.12)' : 'none', transition: 'all .14s' }}>
        <span style={{ flex: 1, textAlign: 'left' }}>{cur.label}</span>
        <span style={{ display: 'inline-flex', color: 'var(--ov-text-faint)', transition: 'transform .18s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <Icon name="chevron" size={15} />
        </span>
      </button>
      {open ? (
        <div className="panel anim-up" style={{ position: 'absolute', top: 'calc(100% + 6px)', zIndex: 50, minWidth: '100%', padding: 5,
          right: align === 'right' ? 0 : 'auto', left: align === 'right' ? 'auto' : 0, boxShadow: '4px 5px 0 rgba(33,53,108,0.16)' }}>
          {options.map(o => {
            const sel = o.value === value;
            return (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--ov-panel-2)'; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px',
                  borderRadius: 7, border: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-sans)',
                  color: sel ? 'var(--ov-accent)' : 'var(--ov-text)', background: sel ? 'color-mix(in srgb, var(--ov-accent) 11%, transparent)' : 'transparent' }}>
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

/* ---------- Brand mark (vault padlock + keyhole) ---------- */
function VaultMark({ size }) {
  const s = size || 30;
  return (
    <span style={{ width: s, height: s, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--ov-navy)', color: 'var(--ov-accent-ink)', borderRadius: 8, boxShadow: '2px 2px 0 var(--ov-accent)' }}>
      <Icon name="vault" size={s * 0.62} />
    </span>
  );
}

/* ---------- WalletButton ---------- */
function WalletButton() {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(true);
  const addr = window.OV.WALLET;
  const short = truncId(addr, 4);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  if (!connected) {
    return <button className="btn btn-accent btn-sm" onClick={() => setConnected(true)}><Icon name="key" size={13} />Connect</button>;
  }
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn btn-ghost btn-sm font-mono" style={{ letterSpacing: '0.02em' }} onClick={() => setOpen(o => !o)}>
        <span className="tier-dot" style={{ background: 'var(--tier-public)' }}></span>{short}
      </button>
      {open ? (
        <div className="panel anim-up" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 244, padding: 12, zIndex: 60 }}>
          <div className="meta" style={{ marginBottom: 6 }}>Connected wallet</div>
          <div className="font-mono" style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--ov-text)', marginBottom: 10 }}>{addr}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}><Icon name="copy" size={13} />Copy address</button>
            <a className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} href={window.OV.EXPLORER_IPA} target="_blank" rel="noreferrer"><Icon name="external" size={13} />View on explorer</a>
            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--ov-accent)', borderColor: 'var(--ov-accent)' }} onClick={() => { setConnected(false); setOpen(false); }}>Disconnect</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Header ---------- */
function Header({ route }) {
  const links = [
    { label: 'Browse', hash: '#/' },
    { label: 'Upload', hash: '#/upload' },
    { label: 'Leaderboard', hash: '#/leaderboard' },
  ];
  function isActive(h) {
    if (h === '#/') return route === '/' || route.startsWith('/artifact') || route.startsWith('/group') || route.startsWith('/compute');
    return route === h.slice(1);
  }
  return (
    <header className="ov-header">
      <div className="container maxw-browse" style={{ display: 'flex', alignItems: 'center', gap: 22, height: 62 }}>
        <a href="#/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VaultMark size={30} />
          <span className="font-display" style={{ fontWeight: 700, fontSize: 21, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Open<span style={{ color: 'var(--ov-accent)' }}>Vault</span>
          </span>
        </a>
        <nav className="ov-nav" style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
          {links.map(l => <a key={l.hash} className={'nav-link' + (isActive(l.hash) ? ' active' : '')} href={l.hash}>{l.label}</a>)}
        </nav>
        <div style={{ flex: 1 }}></div>
        <span className="meta ov-network" style={{ color: 'var(--ov-text-faint)' }}>{window.OV.NETWORK}</span>
        <WalletButton />
      </div>
    </header>
  );
}

/* ---------- CdrLimitsNotice (global footer disclosure) ---------- */
function CdrLimitsNotice() {
  const [open, setOpen] = useState(false);
  const items = [
    { t: 'No decryption revocation', d: 'CDR cannot revoke a decryption credential once minted. Rotate access by re-encrypting to a new vault.', ref: 'SPEC §4.2' },
    { t: 'Compute runs on a plain server', d: 'The demo worker is operator-trusted — plaintext is visible in memory. Production would attest an SGX/TDX enclave.', ref: 'SPEC §6.1' },
    { t: 'Group → member unlock unconfirmed', d: 'One group license unlocking every member vault is not yet confirmed in CDR. Per-IP gating fallback applies today.', ref: 'SPEC §8.7' },
  ];
  return (
    <div style={{ borderTop: '1.5px solid var(--ov-line-ink)', background: 'var(--ov-bg-2)' }}>
      <div className="container maxw-browse" style={{ paddingTop: 10, paddingBottom: 10 }}>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 0, padding: 0, display: 'flex', alignItems: 'center', gap: 10, width: '100%', color: 'var(--ov-text-dim)' }}>
          <span style={{ color: 'var(--ov-accent)', display: 'inline-flex' }}><Icon name="shield" size={15} /></span>
          <span className="meta" style={{ color: 'var(--ov-text-dim)' }}>Spec disclosures — honest about what the chain can &amp; can't do</span>
          <span style={{ flex: 1 }}></span>
          <span style={{ display: 'inline-flex', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}><Icon name="chevron" size={16} /></span>
        </button>
        {open ? (
          <div className="anim-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, marginTop: 14 }}>
            {items.map((it, i) => (
              <div key={i} style={{ borderLeft: '3px solid var(--tier-gated)', paddingLeft: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 12.5 }}>{it.t}</strong>
                  <span className="meta" style={{ color: 'var(--ov-text-faint)' }}>{it.ref}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ov-text-dim)', lineHeight: 1.5 }}>{it.d}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- ModelCard (Browse / group grids) ---------- */
function ModelCard({ a, i }) {
  const t = tierOf(a.tier);
  const [hover, setHover] = useState(false);
  const ctaRoute = a.tier === 'compute' ? ('/compute/' + a.ipId) : a.tier === 'group' ? ('/group/' + (a.groupId || '')) : ('/artifact/' + a.ipId);
  const onNavy = a.tier !== 'public'; /* navy/slate tiers: dark pill */
  return (
    <div role="link" tabIndex={0} onClick={() => go('/artifact/' + a.ipId)}
       onKeyDown={(e) => { if (e.key === 'Enter') go('/artifact/' + a.ipId); }}
       className="anim-up"
       onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
       style={{ position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
         background: 'var(--ov-panel)', border: '1.5px solid var(--ov-line-ink)', borderRadius: 'var(--radius-xl)',
         animationDelay: Math.min(i * 45, 300) + 'ms', transition: 'transform .16s ease, box-shadow .16s ease',
         transform: hover ? 'translate(-2px,-3px)' : 'none',
         boxShadow: hover ? ('6px 8px 0 ' + t.color) : '3px 4px 0 rgba(33,53,108,0.14)' }}>

      {/* tier tab — top edge */}
      <span style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 4, background: t.color }}></span>

      {/* header zone */}
      <div style={{ position: 'relative', padding: '18px 16px 0', overflow: 'hidden' }}>
        {/* halftone print corner */}
        <span className="halftone-dots" aria-hidden="true" style={{ position: 'absolute', top: -6, right: -6, width: 132, height: 104,
          color: t.color, opacity: 0.18, pointerEvents: 'none',
          WebkitMaskImage: 'radial-gradient(circle at 100% 0, #000, transparent 72%)', maskImage: 'radial-gradient(circle at 100% 0, #000, transparent 72%)' }}></span>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TierBadge tier={a.tier} />
          <ModalityChip modality={a.modality} />
          <span style={{ flex: 1 }}></span>
          <span title="Report" style={{ color: 'var(--ov-text-faint)', opacity: hover ? 1 : 0, transition: 'opacity .15s', display: 'inline-flex' }}><Icon name="flag" size={14} /></span>
        </div>

        <h3 className="font-display clamp-2" style={{ position: 'relative', fontSize: 19, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.005em', margin: '14px 0 8px', lineHeight: 1.04, minHeight: 40 }}>{a.title}</h3>
        <p className="clamp-2" style={{ position: 'relative', fontSize: 12.5, color: 'var(--ov-text-dim)', margin: 0, lineHeight: 1.5 }}>{a.description}</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 13 }}>
          {(a.tags || []).slice(0, 4).map(tg => <span key={tg} className="tag-chip">{tg}</span>)}
        </div>
      </div>

      {a.tier === 'compute' ? (
        <div style={{ margin: '13px 16px 0', padding: '7px 11px', borderRadius: 8, fontSize: 10.5,
          color: t.color, background: 'color-mix(in srgb,' + t.color + ' 11%, transparent)',
          border: '1px solid color-mix(in srgb,' + t.color + ' 35%, transparent)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
          textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="compute" size={12} />Computable · not downloadable
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 16 }}></div>

      {/* footer / action stub */}
      <div style={{ padding: '13px 16px', marginTop: 14, borderTop: '1.5px solid var(--ov-line)', background: 'var(--ov-panel-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ov-text-dim)', marginBottom: 12 }}>
          <TierGlyph tier={a.tier} size={13} />
          <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', textTransform: 'uppercase', fontSize: 10 }}>{t.license}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span onClick={(e) => { e.stopPropagation(); }}><TxLink ipId={a.ipId} /></span>
          <span style={{ flex: 1 }}></span>
          <span onClick={(e) => { e.stopPropagation(); go(ctaRoute); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0,
              background: a.tier === 'private' ? 'transparent' : t.color,
              color: a.tier === 'private' ? 'var(--ov-text-faint)' : '#fff',
              border: a.tier === 'private' ? '1.5px solid var(--ov-line)' : '1.5px solid ' + t.color,
              boxShadow: a.tier === 'private' ? 'none' : '2px 2px 0 var(--ov-navy)',
              transform: hover && a.tier !== 'private' ? 'translate(-1px,-1px)' : 'none', transition: 'transform .14s' }}>
            {a.tier === 'private' ? 'Owner only' : t.cta}
            {a.tier !== 'private' ? <Icon name="arrow" size={13} /> : null}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- SkeletonCard ---------- */
function SkeletonCard() {
  return (
    <div className="panel-soft" style={{ height: 256, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="skeleton" style={{ height: 18, width: 120 }}></div>
      <div className="skeleton" style={{ height: 22, width: '70%', marginTop: 4 }}></div>
      <div className="skeleton" style={{ height: 12, width: '100%' }}></div>
      <div className="skeleton" style={{ height: 12, width: '85%' }}></div>
      <div style={{ flex: 1 }}></div>
      <div className="skeleton" style={{ height: 30, width: '100%' }}></div>
    </div>
  );
}

/* ---------- EmptyState ---------- */
function EmptyState({ title, sub, ctaLabel, onCta }) {
  return (
    <div style={{ border: '2px dashed var(--ov-line-ink)', borderRadius: 18, padding: '52px 24px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'color-mix(in srgb, var(--ov-panel) 50%, transparent)' }}>
      <span style={{ color: 'var(--ov-text-faint)' }}><Icon name="search" size={30} /></span>
      <div style={{ alignSelf: 'stretch', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 20, textTransform: 'uppercase', fontWeight: 600 }}>{title}</div>
      {sub ? <p style={{ margin: 0, color: 'var(--ov-text-dim)', fontSize: 13, maxWidth: 380 }}>{sub}</p> : null}
      {ctaLabel ? <button className="btn btn-accent" style={{ marginTop: 6 }} onClick={onCta}>{ctaLabel}</button> : null}
    </div>
  );
}

/* ---------- DisclosureStrip (reusable §8 callout) ---------- */
function DisclosureStrip({ tone, children, icon }) {
  const map = {
    success: 'var(--ov-navy)', public: 'var(--ov-navy)', compute: 'var(--ov-navy)',
    warning: 'var(--ov-accent)', gated: 'var(--ov-accent)',
  };
  const color = map[tone] || 'var(--ov-navy)';
  return (
    <div style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 12, alignItems: 'flex-start',
      color: 'var(--ov-text-dim)', background: 'color-mix(in srgb,' + color + ' 9%, transparent)',
      border: '1px solid color-mix(in srgb,' + color + ' 32%, transparent)', fontSize: 12.5, lineHeight: 1.5 }}>
      <span style={{ color: color, flex: 'none', marginTop: 1 }}><Icon name={icon || 'shield'} size={15} /></span>
      <div>{children}</div>
    </div>
  );
}

Object.assign(window, {
  truncId, tierOf, go, Icon, TierGlyph, TierBadge, ModalityChip, TxLink, Spinner, Field,
  VaultMark, WalletButton, Header, CdrLimitsNotice, ModelCard, SkeletonCard, EmptyState, DisclosureStrip, Dropdown,
});
