/* ============================================================
   OPENVAULT — Group bundle + Leaderboard
   ============================================================ */

/* ---------- GroupPage ---------- */
function GroupPage({ groupId }) {
  const g = window.OV.GROUPS[groupId];
  const [subbed, setSubbed] = useState(false);
  if (!g) {
    return (
      <div className="container maxw-artifact" style={{ paddingTop: 60 }}>
        <EmptyState title="No group with that ID"
          sub={'The id ' + groupId + ' does not resolve to a group bundle on this testnet.'}
          ctaLabel="Back to browse" onCta={() => go('/')} />
        <div className="font-mono" style={{ textAlign: 'center', marginTop: 14, color: 'var(--ov-text-faint)', fontSize: 12 }}>{groupId}</div>
      </div>
    );
  }
  const members = window.OV.ARTIFACTS.filter(a => a.groupId === groupId);

  return (
    <div className="container maxw-browse" style={{ paddingTop: 26, paddingBottom: 60 }}>
      <div className="meta anim-up" style={{ marginBottom: 18 }}>
        <a href="#/" style={{ color: 'var(--ov-text-faint)' }}>Browse</a> / group
      </div>
      <div className="ov-detail-grid">
        <div style={{ display: 'grid', gap: 22, alignContent: 'start' }}>
          <div className="anim-up" style={{ animationDelay: '40ms' }}>
            <span className="chip" style={{ color: 'var(--tier-group)', borderColor: 'var(--tier-group)' }}>
              <span className="tier-dot" style={{ background: 'var(--tier-group)' }}></span>Group
            </span>
            <h1 className="h1" style={{ fontSize: 'clamp(28px,4vw,40px)', margin: '14px 0 12px' }}>{g.title}</h1>
            <p style={{ maxWidth: 600, fontSize: 14.5, color: 'var(--ov-text-dim)', lineHeight: 1.6, margin: 0 }}>{g.description}</p>
          </div>

          {/* access panel */}
          <div className="panel" style={{ padding: 20, borderColor: 'color-mix(in srgb, var(--tier-group) 45%, var(--ov-line-ink))', background: 'color-mix(in srgb, var(--tier-group) 6%, var(--ov-panel))' }}>
            <div className="h2" style={{ fontSize: 16, marginBottom: 6 }}>Access</div>
            <p style={{ fontSize: 13, color: 'var(--ov-text-dim)', marginTop: 0 }}>One subscription is intended to unlock every member vault in the family.</p>
            <button className="btn" style={{ width: '100%', background: 'var(--tier-group)', color: '#fff', boxShadow: '3px 3px 0 var(--ov-navy)' }}
              onClick={() => setSubbed(true)}><Icon name="key" size={15} />Subscribe to unlock family</button>
            {subbed ? <div style={{ marginTop: 12 }}><DisclosureStrip tone="gated" icon="shield">Group-license subscribe is a stub — the CDR contract path is not wired. Members remain gated per-IP below.</DisclosureStrip></div> : null}
            <div style={{ marginTop: 14 }}>
              <DisclosureStrip tone="gated" icon="flag">
                <strong>SPEC §8.7</strong> — group license → member-vault unlock is unconfirmed in CDR; per-IP gating fallback applied.
              </DisclosureStrip>
            </div>
          </div>

          {/* members */}
          <div>
            <div className="meta" style={{ margin: '4px 0 14px', color: 'var(--ov-text-faint)' }}>{members.length} MEMBER{members.length === 1 ? '' : 'S'}</div>
            <div className="ov-grid">
              {members.map((a, i) => <ModelCard key={a.ipId} a={a} i={i} />)}
            </div>
          </div>
        </div>

        {/* sidebar */}
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <div className="panel" style={{ padding: 18 }}>
            <div className="meta" style={{ marginBottom: 8 }}>Provenance</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--ov-line-soft)' }}>
              <span className="meta">Group IP</span><TxLink ipId={g.ipId} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--ov-line-soft)' }}>
              <span className="meta">Created</span><TxLink tx={g.createdTx} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0' }}>
              <span className="meta">License terms</span><span className="font-mono" style={{ fontSize: 12 }}>#{g.licenseTermsId}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- RankBadge ---------- */
function RankBadge({ rank }) {
  const medal = rank === 1 ? '#d9a52b' : rank === 2 ? '#9aa6b4' : rank === 3 ? '#c07d3e' : null;
  if (medal) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 999, background: medal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: '1.5px 1.5px 0 var(--ov-navy)' }}>
          <Icon name="trophy" size={12} />
        </span>
        <span className="font-mono tabular" style={{ fontSize: 13, fontWeight: 600 }}>{rank}</span>
      </span>
    );
  }
  return <span className="font-mono tabular" style={{ fontSize: 13, color: 'var(--ov-text-dim)', paddingLeft: 6 }}>{rank}</span>;
}

/* ---------- Leaderboard ---------- */
function Leaderboard() {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t); }, []);
  const ranked = [...window.OV.ARTIFACTS].sort((a, b) => b.score - a.score);

  return (
    <div className="container maxw-leaderboard" style={{ paddingTop: 36, paddingBottom: 60 }}>
      <div className="anim-up" style={{ marginBottom: 24 }}>
        <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: 'var(--ov-accent)', display: 'inline-flex' }}><Icon name="trophy" size={13} /></span>LEADERBOARD
        </span>
        <h1 className="h1" style={{ fontSize: 'clamp(28px,4vw,42px)', margin: '10px 0 10px' }}>Top artifacts by score</h1>
        <p style={{ color: 'var(--ov-text-dim)', maxWidth: 600, fontSize: 14 }}>
          Datasets and models ranked by their on-chain usage score. Scores are public index metadata; click any IP id to verify provenance.
        </p>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {/* head */}
        <div className="ov-lb-row" style={{ borderBottom: '1.5px solid var(--ov-line-ink)', background: 'var(--ov-panel-2)' }}>
          <span className="meta">#</span>
          <span className="meta">Title</span>
          <span className="meta ov-lb-hide">Modality</span>
          <span className="meta">Tier</span>
          <span className="meta" style={{ textAlign: 'right' }}>Score</span>
          <span className="meta ov-lb-hide" style={{ textAlign: 'right' }}>IP asset</span>
        </div>

        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ov-lb-row" style={{ borderBottom: '1px solid var(--ov-line-soft)' }}>
            <div className="skeleton" style={{ height: 16, width: 24 }}></div>
            <div className="skeleton" style={{ height: 16, width: '60%' }}></div>
            <div className="skeleton ov-lb-hide" style={{ height: 16, width: 50 }}></div>
            <div className="skeleton" style={{ height: 16, width: 60 }}></div>
            <div className="skeleton" style={{ height: 16, width: 50, marginLeft: 'auto' }}></div>
            <div className="skeleton ov-lb-hide" style={{ height: 16, width: 90, marginLeft: 'auto' }}></div>
          </div>
        )) : ranked.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center', color: 'var(--ov-text-faint)' }}>No ranked artifacts yet.</div>
        ) : ranked.map((a, i) => (
          <div key={a.ipId} className="ov-lb-row anim-up" style={{ borderBottom: i === ranked.length - 1 ? 'none' : '1px solid var(--ov-line-soft)', animationDelay: Math.min(i * 35, 280) + 'ms' }}>
            <RankBadge rank={i + 1} />
            <a href={'#/artifact/' + a.ipId} style={{ fontWeight: 600, fontSize: 13.5 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--ov-accent)'} onMouseLeave={e => e.currentTarget.style.color = ''}>{a.title}</a>
            <span className="ov-lb-hide" style={{ fontSize: 12.5, color: 'var(--ov-text-dim)', textTransform: 'capitalize' }}>{a.modality}</span>
            <span><TierBadge tier={a.tier} /></span>
            <span className="font-mono tabular" style={{ textAlign: 'right', fontWeight: 600, fontSize: 13.5 }}>{a.score.toLocaleString()}</span>
            <span className="ov-lb-hide" style={{ textAlign: 'right' }}><TxLink ipId={a.ipId} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { GroupPage, Leaderboard });
