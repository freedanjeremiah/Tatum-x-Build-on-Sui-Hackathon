/* ============================================================
   OPENVAULT — Confidential compute panel
   ============================================================ */

const ISOLATION_DISCLOSURE = "This demo worker runs on a plain server — the operator can see plaintext in memory. A production deployment would run in an attested SGX/TDX enclave.";

/* ---------- IsolationStrip (always visible) ---------- */
function IsolationStrip() {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, alignItems: 'flex-start', marginTop: 4,
      color: 'var(--ov-text-dim)', background: 'color-mix(in srgb, var(--tier-gated) 9%, transparent)',
      border: '1px solid color-mix(in srgb, var(--tier-gated) 32%, transparent)', fontSize: 12.5, lineHeight: 1.55 }}>
      <span style={{ color: 'var(--tier-gated)', flex: 'none', marginTop: 1 }}><Icon name="shield" size={16} /></span>
      <div><strong>Isolation: plain server (operator-trusted, demo).</strong> {ISOLATION_DISCLOSURE}</div>
    </div>
  );
}

/* ---------- Progress trail ---------- */
function TrailItem({ state, children }) {
  // state: 'pending' | 'active' | 'done'
  const col = state === 'done' ? 'var(--tier-compute)' : state === 'active' ? 'var(--ov-accent)' : 'var(--ov-line)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, flex: 'none', border: '4px solid ' + col,
        background: state === 'done' ? 'var(--tier-compute)' : 'transparent',
        animation: state === 'active' ? 'ov-pulse-ring 1.4s infinite' : 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {state === 'done' ? <span style={{ color: '#fff', display: 'inline-flex' }}><Icon name="check" size={10} /></span> : null}
      </span>
      <span style={{ fontSize: 13, color: state === 'pending' ? 'var(--ov-text-faint)' : 'var(--ov-text)' }}>{children}</span>
    </div>
  );
}

/* ---------- Metric cell ---------- */
function Metric({ k, v }) {
  return (
    <div className="panel-soft" style={{ padding: 14 }}>
      <div className="meta" style={{ marginBottom: 6 }}>{k.replace(/_/g, ' ')}</div>
      <div className="font-mono" style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
    </div>
  );
}

/* ---------- Done view ---------- */
function ComputeDone({ a, result }) {
  return (
    <div className="anim-up" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--tier-compute)', fontWeight: 700, fontSize: 15 }}>
        <Icon name="check" size={18} />Job complete — results only
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
        {Object.keys(result.metrics).map(k => <Metric key={k} k={k} v={result.metrics[k]} />)}
      </div>
      <div className="panel-soft" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--ov-line-soft)' }}>
          <span className="meta">Result IP (derivative)</span><TxLink ipId={result.resultIpId} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--ov-line-soft)' }}>
          <span className="meta">Registration tx</span><TxLink tx={result.resultTx} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--ov-line-soft)' }}>
          <span className="meta">Compute license token</span><span className="font-mono" style={{ fontSize: 12 }}>#{result.licenseTokenId}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
          <span className="meta">Metrics URI</span><span className="font-mono" style={{ fontSize: 11.5 }}>{result.metricsUri}</span>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ov-text-dim)', margin: 0, lineHeight: 1.55 }}>
        The result is registered as a derivative of the source dataset, so royalties flow upstream. No raw rows were returned.
      </p>
      {result.warning ? <DisclosureStrip tone="gated" icon="flag">⚠ {result.warning}</DisclosureStrip> : null}
      <IsolationStrip />
    </div>
  );
}

/* ---------- ComputeJobPanel ---------- */
function ComputeJobPanel({ ipId }) {
  const a = window.OV.find(ipId);
  const [algo, setAlgo] = useState(a && a.allowedAlgoHashes ? a.allowedAlgoHashes[0] : null);
  const [params, setParams] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | running1 | running2 | done | rejected | error
  const t = tierOf('compute');

  if (!a) {
    return <div className="container maxw-compute" style={{ paddingTop: 60 }}><EmptyState title="Artifact not found" ctaLabel="Back to browse" onCta={() => go('/')} /></div>;
  }

  function run() {
    setPhase('running1');
    setTimeout(() => setPhase('running2'), 1400);
    setTimeout(() => setPhase('done'), 3200);
  }

  const running = phase === 'running1' || phase === 'running2';

  return (
    <div className="container maxw-compute" style={{ paddingTop: 26, paddingBottom: 60 }}>
      <div className="meta anim-up" style={{ marginBottom: 18 }}>
        <a href="#/" style={{ color: 'var(--ov-text-faint)' }}>Browse</a> / dataset / compute
      </div>

      {/* header */}
      <div className="anim-up" style={{ animationDelay: '40ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <TierBadge tier="compute" />
          <ModalityChip modality={a.modality} />
          <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.color,
            border: '1px solid color-mix(in srgb,' + t.color + ' 35%, transparent)', background: 'color-mix(in srgb,' + t.color + ' 11%, transparent)',
            padding: '4px 9px', borderRadius: 999 }}>Computable · never downloadable</span>
        </div>
        <h1 className="h1" style={{ fontSize: 'clamp(28px,4vw,40px)', margin: '16px 0 10px' }}>{a.title}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <TxLink ipId={a.ipId} /><TxLink tx={a.createdTx} />
          <span className="font-mono" style={{ fontSize: 11.5, color: 'var(--ov-text-faint)' }}>compute terms #{a.computeLicenseTermsId}</span>
        </div>
      </div>

      <hr className="divider-ink" style={{ margin: '24px 0' }} />

      <div className="ov-compute-grid">
        {/* left — allowlist */}
        <div className="panel" style={{ padding: 20, alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            <span style={{ color: t.color, display: 'inline-flex' }}><Icon name="shield" size={16} /></span>
            <span className="h2" style={{ fontSize: 16 }}>Algorithm allowlist</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ov-text-dim)', lineHeight: 1.55, marginTop: 0 }}>
            Only these algorithms may touch the plaintext. Anything else is rejected before a single byte is decrypted.
          </p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {(a.allowedAlgoHashes || []).map(h => (
              <div key={h} className="panel-soft" style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="tier-dot" style={{ background: t.color }}></span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{window.OV.ALGOS.find(x => x.hash === h) ? window.OV.ALGOS.find(x => x.hash === h).name : h}</span>
                <span style={{ flex: 1 }}></span>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--ov-text-faint)' }}>{h}</span>
              </div>
            ))}
          </div>
        </div>

        {/* right — run */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="h2" style={{ fontSize: 16, marginBottom: 8 }}>Run a confidential job</div>
          <p style={{ fontSize: 12.5, color: 'var(--ov-text-dim)', lineHeight: 1.55, marginTop: 0 }}>
            The worker mints one compute license, decrypts in-process, runs your algorithm, and returns aggregates only.
          </p>

          {phase === 'done' ? <ComputeDone a={a} result={window.OV.COMPUTE_DONE} /> :
           phase === 'rejected' ? (
            <div className="anim-up" style={{ display: 'grid', gap: 12 }}>
              <DisclosureStrip tone="gated" icon="flag"><strong>Rejected by the worker.</strong> {window.OV.COMPUTE_REJECTED.reason}</DisclosureStrip>
              <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--ov-text-faint)' }}>decryptCalled: false — no decryption was performed.</div>
              <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => setPhase('idle')}>Try again</button>
              <IsolationStrip />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16, marginTop: 14 }}>
              {/* algo radio */}
              <div style={{ display: 'grid', gap: 8 }}>
                {(a.allowedAlgoHashes || []).map(h => {
                  const on = algo === h; const name = window.OV.ALGOS.find(x => x.hash === h);
                  return (
                    <button key={h} disabled={running} onClick={() => setAlgo(h)} className="panel-soft"
                      style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10, cursor: running ? 'default' : 'pointer', textAlign: 'left',
                        borderColor: on ? t.color : 'var(--ov-line)' }}>
                      <span style={{ width: 16, height: 16, borderRadius: 999, flex: 'none', border: '2px solid ' + (on ? t.color : 'var(--ov-line-ink)'),
                        background: on ? t.color : 'transparent', boxShadow: on ? 'inset 0 0 0 2.5px var(--ov-panel)' : 'none' }}></span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{name ? name.name : h}</span>
                      <span style={{ flex: 1 }}></span>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--ov-text-faint)' }}>{h}</span>
                    </button>
                  );
                })}
              </div>
              <Field label="Params (optional JSON)">
                <input className="input mono" placeholder='{"target":"label"}' value={params} onChange={e => setParams(e.target.value)} disabled={running} />
              </Field>

              {running ? (
                <div className="panel-soft anim-up" style={{ padding: 16, display: 'grid', gap: 14 }}>
                  <TrailItem state={phase === 'running1' ? 'active' : 'done'}>Allowlist check + mint compute license in worker</TrailItem>
                  <TrailItem state={phase === 'running1' ? 'pending' : 'active'}>Decrypt + run (no rows leave)</TrailItem>
                </div>
              ) : (
                <button className="btn" style={{ background: t.color, color: '#fff', boxShadow: '3px 3px 0 var(--ov-navy)' }} onClick={run}>
                  <Icon name="play" size={14} />Run confidential job
                </button>
              )}
              <IsolationStrip />
            </div>
          )}
        </div>
      </div>

      {/* demo state switcher */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 22, flexWrap: 'wrap' }}>
        <span className="meta" style={{ color: 'var(--ov-text-faint)' }}>Preview state:</span>
        {[['idle', 'Idle'], ['done', 'Done'], ['rejected', 'Rejected']].map(([k, l]) => (
          <button key={k} className="btn btn-ghost btn-sm" style={{ borderColor: phase === k ? t.color : '', color: phase === k ? t.color : '' }}
            onClick={() => setPhase(k)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ComputeJobPanel });
