/* ============================================================
   OPENVAULT — Browse (home)
   ============================================================ */

function Hero() {
  const legend = ['public', 'private', 'gated', 'group', 'compute'].map(k => window.OV.TIERS[k]);
  return (
    <section style={{ position: 'relative', paddingTop: 46, paddingBottom: 34 }}>
      <div className="anim-up" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
        <span className="tier-dot" style={{ background: 'var(--ov-accent)' }}></span>
        <span className="eyebrow">STORY · CONFIDENTIAL DATA REGISTRY</span>
      </div>
      <div className="anim-up font-jp" style={{ fontSize: 14, letterSpacing: '0.3em', color: 'var(--ov-accent)', marginBottom: 12, animationDelay: '40ms' }}>
        コンフィデンシャル データ レジストリ
      </div>
      <h1 className="h1 anim-up" style={{ maxWidth: 880, animationDelay: '80ms' }}>
        Access control as a<br /><span style={{ color: 'var(--ov-accent)' }}>property of the data.</span>
      </h1>
      <p className="anim-up" style={{ maxWidth: 560, marginTop: 16, fontSize: 14.5, color: 'var(--ov-text-dim)', lineHeight: 1.6, animationDelay: '120ms' }}>
        Datasets and models registered as Story IP Assets, threshold-encrypted on IPFS.
        The license token <em>is</em> the decryption credential — there is no auth server.
      </p>

      {/* tier legend strip */}
      <div className="anim-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 26, animationDelay: '160ms' }}>
        {legend.map(t => (
          <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 13px', borderRadius: 999,
            border: '1.5px solid var(--ov-line)', background: 'var(--ov-panel)' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: t.color, flex: 'none' }}></span>
            <span style={{ fontWeight: 700, fontSize: 12.5 }}>{t.label}</span>
            <span className="meta" style={{ color: 'var(--ov-text-faint)', textTransform: 'none', letterSpacing: '0.02em', fontFamily: 'var(--font-sans)' }}>{t.blurb}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FilterBar({ tier, setTier, modality, setModality, q, setQ }) {
  const tiers = ['all', 'public', 'gated', 'compute', 'group', 'private'];
  return (
    <div style={{ position: 'sticky', top: 62, zIndex: 30, background: 'color-mix(in srgb, var(--ov-bg) 88%, transparent)',
      backdropFilter: 'blur(8px)', borderBottom: '1.5px solid var(--ov-line)', margin: '0 -20px', padding: '12px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {tiers.map(k => {
            const active = tier === k;
            const t = k === 'all' ? null : window.OV.TIERS[k];
            const col = t ? t.color : 'var(--ov-navy)';
            return (
              <button key={k} onClick={() => setTier(k)} className="font-mono"
                style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.08em', padding: '6px 12px', borderRadius: 999,
                  border: '1.5px solid', cursor: 'pointer', fontWeight: 600,
                  borderColor: active ? col : 'var(--ov-line)',
                  color: active ? (k === 'all' ? 'var(--ov-accent-ink)' : col) : 'var(--ov-text-dim)',
                  background: active ? (k === 'all' ? 'var(--ov-navy)' : 'color-mix(in srgb,' + col + ' 14%, transparent)') : 'transparent' }}>
                {k === 'all' ? 'All' : t.label}
              </button>
            );
          })}
        </div>
        <span style={{ flex: 1 }}></span>
        <Dropdown value={modality} onChange={setModality} minWidth={150} align="right"
          options={[{ value: 'all', label: 'All modalities' }, { value: 'dataset', label: 'Datasets' }, { value: 'model', label: 'Models' }]} />
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ov-text-faint)', display: 'inline-flex' }}>
            <Icon name="search" size={15} />
          </span>
          <input className="input" placeholder="Search title, tags, description…" value={q} onChange={e => setQ(e.target.value)}
            style={{ width: 248, paddingLeft: 33, fontSize: 12.5 }} />
        </div>
      </div>
    </div>
  );
}

function Browse() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState('all');
  const [modality, setModality] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  const all = window.OV.ARTIFACTS;
  const filtered = all.filter(a => {
    if (tier !== 'all' && a.tier !== tier) return false;
    if (modality !== 'all' && a.modality !== modality) return false;
    if (q.trim()) {
      const hay = (a.title + ' ' + a.description + ' ' + (a.tags || []).join(' ')).toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const hasFilters = tier !== 'all' || modality !== 'all' || q.trim();

  return (
    <div className="container maxw-browse">
      <Hero />
      <FilterBar tier={tier} setTier={setTier} modality={modality} setModality={setModality} q={q} setQ={setQ} />

      <div className="meta" style={{ margin: '20px 0 14px', color: 'var(--ov-text-faint)' }}>
        {loading ? 'LOADING…' : filtered.length + ' ARTIFACT' + (filtered.length === 1 ? '' : 'S')}
      </div>

      {loading ? (
        <div className="ov-grid">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 ? (
        hasFilters ? (
          <EmptyState title="No artifacts match these filters"
            sub="Try a broader tier or clear your search to see everything in the vault."
            ctaLabel="Clear filters" onCta={() => { setTier('all'); setModality('all'); setQ(''); }} />
        ) : (
          <EmptyState title="No artifacts published yet"
            sub="This is a fresh testnet vault. Register the first dataset or model to see it appear here."
            ctaLabel="Register an artifact" onCta={() => go('/upload')} />
        )
      ) : (
        <div className="ov-grid">
          {filtered.map((a, i) => <ModelCard key={a.ipId} a={a} i={i} />)}
        </div>
      )}

      <div style={{ height: 56 }}></div>
    </div>
  );
}

Object.assign(window, { Browse });
