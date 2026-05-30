/* ============================================================
   OPENVAULT — Artifact detail
   ============================================================ */

/* ---------- DecryptProgress ---------- */
function DecryptProgress({ phase, onRetry }) {
  // phase: 'decrypting' | 'timeout' | 'done'
  if (phase === 'timeout') {
    return (
      <div style={{ marginTop: 12 }}>
        <DisclosureStrip tone="gated" icon="refresh">
          Decryption is taking longer than expected. The credential is valid — retry the unwrap.
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onRetry}><Icon name="refresh" size={13} />Retry decrypt</button>
          </div>
        </DisclosureStrip>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ov-text-dim)' }}>
      <Spinner />
      <span>Unwrapping vault key → decrypting bytes in the browser (no plaintext leaves your device)…</span>
    </div>
  );
}

/* ---------- DownloadButton ---------- */
function DownloadButton({ a }) {
  const t = tierOf(a.tier);
  const [phase, setPhase] = useState('idle'); // idle | decrypting | timeout | done
  const label = a.tier === 'public' ? 'Download'
    : a.tier === 'private' ? 'Decrypt (owner)'
    : 'Mint to unlock';

  function run() {
    setPhase('decrypting');
    // simulate: gated artifacts "time out" once to show retry path
    const willTimeout = a.tier === 'gated' && !window.__ovRetried;
    setTimeout(() => {
      if (willTimeout) { window.__ovRetried = true; setPhase('timeout'); }
      else setPhase('done');
    }, 1800);
  }

  if (phase === 'done') {
    return (
      <div>
        <DisclosureStrip tone="public" icon="check">
          ✓ Decrypted. <strong>{a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.bin</strong> downloaded to your device.
        </DisclosureStrip>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setPhase('idle')}><Icon name="download" size={13} />Download again</button>
      </div>
    );
  }

  return (
    <div>
      <button className="btn" disabled={phase === 'decrypting'}
        style={{ background: t.color, color: '#fff', boxShadow: '3px 3px 0 var(--ov-navy)', width: '100%' }}
        onClick={run}>
        {phase === 'decrypting' ? <Spinner /> : <Icon name={a.tier === 'gated' ? 'key' : 'download'} size={15} />}
        {phase === 'decrypting' ? 'Decrypting…' : label}
      </button>
      {phase === 'decrypting' ? <DecryptProgress phase="decrypting" /> : null}
      {phase === 'timeout' ? <DecryptProgress phase="timeout" onRetry={run} /> : null}
    </div>
  );
}

/* ---------- ComputeCta ---------- */
function ComputeCta({ a }) {
  const t = tierOf('compute');
  return (
    <div>
      <div style={{ padding: '9px 12px', borderRadius: 10, marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.04em',
        color: t.color, background: 'color-mix(in srgb,' + t.color + ' 11%, transparent)', border: '1px solid color-mix(in srgb,' + t.color + ' 32%, transparent)' }}>
        Computable, never downloadable
      </div>
      <button className="btn" style={{ background: t.color, color: '#fff', width: '100%', boxShadow: '3px 3px 0 var(--ov-navy)' }}
        onClick={() => go('/compute/' + a.ipId)}><Icon name="play" size={14} />Run a compute job</button>
      <div className="meta" style={{ margin: '16px 0 8px' }}>Allowlisted algorithms</div>
      <div style={{ display: 'grid', gap: 7 }}>
        {(a.allowedAlgoHashes || []).map(h => (
          <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <span className="tier-dot" style={{ background: t.color }}></span>{h}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- AccessPanel ---------- */
function AccessPanel({ a }) {
  const t = tierOf(a.tier);
  return (
    <div className="panel" style={{ padding: 20, borderColor: 'color-mix(in srgb,' + t.color + ' 45%, var(--ov-line-ink))',
      background: 'color-mix(in srgb,' + t.color + ' 6%, var(--ov-panel))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <TierGlyph tier={a.tier} size={16} />
        <span className="h2" style={{ fontSize: 16 }}>Access</span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ov-text-dim)' }}>{t.license}.</p>
      {a.tier === 'compute' ? <ComputeCta a={a} /> : <DownloadButton a={a} />}
    </div>
  );
}

/* ---------- LineageGraph ---------- */
function LineageBox({ a, isThis }) {
  return (
    <div className="panel-soft" style={{ padding: '12px 14px', minWidth: 190, position: 'relative',
      borderColor: isThis ? 'var(--ov-accent)' : 'var(--ov-line)', borderWidth: isThis ? 2 : 1.5 }}>
      {isThis ? <span className="meta" style={{ color: 'var(--ov-accent)', position: 'absolute', top: 8, right: 10 }}>THIS</span> : null}
      <TierBadge tier={a.tier} />
      <div style={{ fontWeight: 700, fontSize: 13, margin: '8px 0 8px' }}>{a.title}</div>
      <TxLink ipId={a.ipId} />
    </div>
  );
}
function Arrow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ov-text-faint)', padding: '0 4px' }}>
      <span className="meta" style={{ color: 'var(--ov-text-faint)' }}>DERIVATIVE</span>
      <Icon name="arrow" size={16} />
    </div>
  );
}
function LineagePanel({ a }) {
  const parent = a.parentIpId ? window.OV.find(a.parentIpId) : null;
  const children = window.OV.ARTIFACTS.filter(x => x.parentIpId === a.ipId);
  if (!parent && children.length === 0) return null;
  return (
    <div className="panel" style={{ padding: 20 }}>
      <div className="h2" style={{ fontSize: 16, marginBottom: 16 }}>Lineage</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {parent ? <React.Fragment><LineageBox a={parent} /><Arrow /></React.Fragment> : null}
        <LineageBox a={a} isThis />
        {children.length ? <Arrow /> : null}
        {children.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {children.slice(0, 3).map(c => <LineageBox key={c.ipId} a={c} />)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- RoyaltyPanel ---------- */
function RoyaltyPanel({ a }) {
  if (!a.licenseTermsId) return null;
  const derivs = window.OV.ARTIFACTS.filter(x => x.parentIpId === a.ipId).length;
  const [claimed, setClaimed] = useState(false);
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState(false);
  const claimable = derivs > 0 ? (derivs * 0.0021).toFixed(4) : '0.0000';

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div className="h2" style={{ fontSize: 16 }}>Royalties</div>
        <span style={{ flex: 1 }}></span>
        <button className="btn btn-ghost btn-sm"><Icon name="refresh" size={13} />Refresh</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div className="panel-soft" style={{ padding: 16, flex: 1, minWidth: 220 }}>
          <div className="meta" style={{ marginBottom: 8 }}>Claimable revenue</div>
          <div className="font-mono" style={{ fontSize: 20, fontWeight: 700 }}>{claimable} <span style={{ fontSize: 13, color: 'var(--ov-text-faint)' }}>WIP</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--ov-text-faint)', marginTop: 6 }}>{derivs} indexed derivative{derivs === 1 ? '' : 's'} route to this IP.</div>
        </div>
        <button className="btn btn-accent" disabled={derivs === 0 || claimed} onClick={() => setClaimed(true)}>
          {claimed ? <Icon name="check" size={14} /> : null}{claimed ? 'Claimed' : 'Claim revenue (owner)'}
        </button>
      </div>

      {claimed ? <div style={{ marginTop: 12 }}><DisclosureStrip tone="public" icon="check">✓ Tx confirmed — revenue claimed to owner wallet. <TxLink tx={window.OV.hx(771, 64)} /></DisclosureStrip></div> : null}

      <hr className="divider" style={{ margin: '18px 0' }} />

      <div className="meta" style={{ marginBottom: 10 }}>Pay royalties to this IP</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <input className="input mono" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          <span className="meta" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>WIP</span>
        </div>
        <button className="btn btn-ghost" disabled={!amount || paid} onClick={() => setPaid(true)}>{paid ? 'Paid ✓' : 'Pay royalty'}</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ov-text-faint)', marginTop: 8 }}>Auto-wraps native IP → WIP if needed.</div>
      {paid ? <div style={{ marginTop: 12 }}><DisclosureStrip tone="public" icon="check">✓ Tx confirmed. <TxLink tx={window.OV.hx(772, 64)} /></DisclosureStrip></div> : null}
    </div>
  );
}

/* ---------- ReportDialog ---------- */
function ReportDialog({ a, onClose }) {
  const [evidence, setEvidence] = useState('');
  const [raised, setRaised] = useState(false);
  const cid = 'bafkrei' + window.OV.hx(Math.floor(Math.random() * 9999), 18).slice(2);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="panel" style={{ width: 'min(520px, 100%)', padding: 22 }} onMouseDown={e => e.stopPropagation()}>
        {raised ? (
          <div>
            <DisclosureStrip tone="gated" icon="flag">Dispute #{Math.floor(Math.random() * 90 + 10)} raised against this artifact. <TxLink tx={window.OV.hx(881, 64)} /></DisclosureStrip>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-accent" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
              <span style={{ color: 'var(--tier-gated)', display: 'inline-flex' }}><Icon name="flag" size={17} /></span>
              <span className="eyebrow" style={{ color: 'var(--tier-gated)' }}>REPORT ARTIFACT</span>
              <span style={{ flex: 1 }}></span>
              <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={onClose}><Icon name="close" size={15} /></button>
            </div>
            <h3 style={{ fontSize: 18, margin: '4px 0 16px' }}>{a.title}</h3>
            <Field label="Evidence">
              <textarea className="textarea" rows={4} placeholder="Describe the issue — license violation, mislabelled provenance, harmful content…"
                value={evidence} onChange={e => setEvidence(e.target.value)} />
            </Field>
            <div style={{ marginTop: 12 }}>
              <div className="meta" style={{ marginBottom: 6 }}>Evidence CID (auto-generated)</div>
              <div className="font-mono" style={{ fontSize: 11.5, padding: '8px 10px', background: 'var(--ov-bg-elev)', borderRadius: 8, border: '1px solid var(--ov-line)', wordBreak: 'break-all' }}>{cid}</div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ov-text-dim)', lineHeight: 1.5, marginTop: 14 }}>
              A bond in WIP is required to raise a dispute (read on-chain from the arbitration policy at submit time, auto-wrapped from native IP).
              It is returned if your report is upheld and forfeited if it is rejected.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn" disabled={!evidence.trim()} style={{ background: 'var(--tier-gated)', color: '#fff', boxShadow: '3px 3px 0 var(--ov-navy)' }}
                onClick={() => setRaised(true)}>Raise dispute</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- ProvenanceCard (sidebar) ---------- */
function ProvRow({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--ov-line-soft)' }}>
      <span className="meta" style={{ color: 'var(--ov-text-faint)' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{children}</span>
    </div>
  );
}
function ProvenanceCard({ a }) {
  const parent = a.parentIpId ? window.OV.find(a.parentIpId) : null;
  return (
    <div className="panel" style={{ padding: 18 }}>
      <div className="meta" style={{ marginBottom: 8 }}>Provenance</div>
      <ProvRow label="IP asset"><TxLink ipId={a.ipId} /></ProvRow>
      <ProvRow label="Created"><TxLink tx={a.createdTx} /></ProvRow>
      {a.licenseTermsId ? <ProvRow label="License terms"><span className="font-mono" style={{ fontSize: 12 }}>#{a.licenseTermsId}</span></ProvRow> : null}
      {a.computeLicenseTermsId ? <ProvRow label="Compute terms"><span className="font-mono" style={{ fontSize: 12 }}>#{a.computeLicenseTermsId}</span></ProvRow> : null}
      <ProvRow label="Vault uuid"><span className="font-mono" style={{ fontSize: 12 }}>uuid:{a.vaultUuid}</span></ProvRow>
      <ProvRow label="CID"><span className="font-mono" style={{ fontSize: 11.5 }}>{a.cid}</span></ProvRow>
      {parent ? <ProvRow label="Parent IP"><TxLink ipId={parent.ipId} /></ProvRow> : null}
      {a.groupId ? <ProvRow label="Group"><a className="txlink" href={'#/group/' + a.groupId}>{a.groupId}<span className="suffix">GRP</span></a></ProvRow> : null}
      {a.externalSource ? (
        <div style={{ paddingTop: 9 }}>
          <span className="meta" style={{ color: 'var(--ov-text-faint)', display: 'block', marginBottom: 5 }}>OSS source</span>
          <a href={a.externalSource} target="_blank" rel="noreferrer" className="font-mono" style={{ fontSize: 11.5, color: 'var(--ov-accent)', wordBreak: 'break-all' }}>
            {a.externalSource.replace('https://', '').slice(0, 38)}…
          </a>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- ArtifactDetail ---------- */
function ArtifactDetail({ ipId }) {
  const a = window.OV.find(ipId);
  const [report, setReport] = useState(false);
  const disputed = a && a.tier === 'gated' && a.parentIpId; // demo: one disputed artifact
  if (!a) {
    return (
      <div className="container maxw-artifact" style={{ paddingTop: 60 }}>
        <EmptyState title="Artifact not found" sub="No artifact with that IP id resolves on this testnet." ctaLabel="Back to browse" onCta={() => go('/')} />
      </div>
    );
  }
  const t = tierOf(a.tier);
  return (
    <div className="container maxw-artifact" style={{ paddingTop: 26, paddingBottom: 60 }}>
      <div className="meta anim-up" style={{ marginBottom: 18 }}>
        <a href="#/" style={{ color: 'var(--ov-text-faint)' }}>Browse</a> / {a.modality}
      </div>

      {/* header */}
      <div className="anim-up" style={{ animationDelay: '40ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <TierBadge tier={a.tier} />
          <ModalityChip modality={a.modality} />
          {disputed ? (
            <span className="tier-badge" style={{ color: 'var(--tier-gated)', borderColor: 'var(--tier-gated)', background: 'color-mix(in srgb, var(--tier-gated) 12%, transparent)' }}>
              <span className="tier-dot" style={{ background: 'var(--tier-gated)', animation: 'ov-pulse-ring 1.4s infinite' }}></span>In dispute #42
            </span>
          ) : null}
          <span style={{ flex: 1 }}></span>
          <button className="btn btn-ghost btn-sm" onClick={() => setReport(true)}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--tier-gated)'; e.currentTarget.style.borderColor = 'var(--tier-gated)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = ''; }}>
            <Icon name="flag" size={13} />Report
          </button>
        </div>
        <h1 className="h1" style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: '16px 0 12px' }}>{a.title}</h1>
        <p style={{ maxWidth: 620, fontSize: 14.5, color: 'var(--ov-text-dim)', lineHeight: 1.6, margin: 0 }}>{a.description}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {(a.tags || []).map(tg => <span key={tg} className="tag-chip">{tg}</span>)}
        </div>
      </div>

      <hr className="divider-ink" style={{ margin: '26px 0' }} />

      <div className="ov-detail-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          <AccessPanel a={a} />
          <LineagePanel a={a} />
          <RoyaltyPanel a={a} />
        </div>
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <ProvenanceCard a={a} />
        </div>
      </div>

      {report ? <ReportDialog a={a} onClose={() => setReport(false)} /> : null}
    </div>
  );
}

Object.assign(window, { ArtifactDetail });
