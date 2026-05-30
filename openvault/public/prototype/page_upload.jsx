/* ============================================================
   OPENVAULT — Upload wizard
   ============================================================ */

const STEPS = ['Artifact', 'Details', 'Tier', 'Lineage', 'Review'];

/* ---------- Stepper ---------- */
function Stepper({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 26, height: 26, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, flex: 'none',
                border: '1.5px solid ' + (done || active ? 'var(--ov-accent)' : 'var(--ov-line)'),
                background: done ? 'var(--ov-accent)' : active ? 'color-mix(in srgb, var(--ov-accent) 14%, transparent)' : 'transparent',
                color: done ? 'var(--ov-accent-ink)' : active ? 'var(--ov-accent)' : 'var(--ov-text-faint)' }}>
                {done ? <Icon name="check" size={14} /> : (i + 1)}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? 'var(--ov-text)' : 'var(--ov-text-faint)' }}>{s}</span>
            </div>
            {i < STEPS.length - 1 ? <span style={{ flex: 1, height: 1.5, background: 'var(--ov-line)', margin: '0 12px' }}></span> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------- TierPicker ---------- */
function TierPicker({ value, onChange }) {
  const keys = ['public', 'gated', 'compute', 'group', 'private'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(132px,1fr))', gap: 10 }}>
      {keys.map(k => {
        const t = window.OV.TIERS[k];
        const active = value === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{ textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer',
            border: '1.5px solid ' + (active ? t.color : 'var(--ov-line)'),
            background: active ? 'color-mix(in srgb,' + t.color + ' 12%, var(--ov-panel))' : 'var(--ov-panel)',
            boxShadow: active ? '3px 3px 0 ' + t.color : 'none', transition: 'all .14s' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: t.color }}></span>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t.label}</span>
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--ov-text-dim)' }}>{t.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Dropzone ---------- */
function Dropzone({ file, onFile }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div onClick={() => ref.current && ref.current.click()}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0].name); }}
      style={{ border: '2px dashed ' + (over ? 'var(--ov-accent)' : 'var(--ov-line-ink)'), borderRadius: 16, padding: '34px 20px',
        textAlign: 'center', cursor: 'pointer', background: over ? 'color-mix(in srgb, var(--ov-accent) 7%, var(--ov-panel))' : 'var(--ov-panel)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'all .14s' }}>
      <input ref={ref} type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && onFile(e.target.files[0].name)} />
      <span style={{ color: file ? 'var(--tier-public)' : 'var(--ov-text-faint)' }}><Icon name={file ? 'check' : 'upload'} size={28} /></span>
      {file ? (
        <div className="font-mono" style={{ fontSize: 13 }}>{file}</div>
      ) : (
        <div style={{ alignSelf: 'stretch', textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Choose a file</div>
          <div style={{ fontSize: 12, color: 'var(--ov-text-faint)', marginTop: 4 }}>or drag it here — bytes are encrypted client-side after the IP is registered</div>
        </div>
      )}
    </div>
  );
}

/* ---------- Lineage step ---------- */
function LineageStep({ form, set }) {
  const modes = [
    { k: 'original', label: 'Original work' },
    { k: 'onplatform', label: 'Derived from on-platform artifact' },
    { k: 'oss', label: 'Derived from OSS source' },
  ];
  const [q, setQ] = useState('');
  const results = q.trim() ? window.OV.ARTIFACTS.filter(a => a.title.toLowerCase().includes(q.toLowerCase())).slice(0, 4) : [];
  const parent = form.parentIpId ? window.OV.find(form.parentIpId) : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {modes.map(m => (
          <button key={m.k} onClick={() => { set({ lineageMode: m.k, parentIpId: null }); }}
            className="chip" style={{ cursor: 'pointer', padding: '8px 13px', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600,
              borderColor: form.lineageMode === m.k ? 'var(--ov-accent)' : 'var(--ov-line)',
              color: form.lineageMode === m.k ? 'var(--ov-accent)' : 'var(--ov-text-dim)',
              background: form.lineageMode === m.k ? 'color-mix(in srgb, var(--ov-accent) 10%, transparent)' : 'var(--ov-panel)' }}>
            {m.label}
          </button>
        ))}
      </div>

      {parent ? (
        <DisclosureStrip tone="public" icon="check">
          Derived from <strong>{parent.title}</strong> · <TxLink ipId={parent.ipId} />
          <div style={{ marginTop: 8 }}><button className="btn btn-ghost btn-sm" onClick={() => set({ parentIpId: null })}>Clear</button></div>
        </DisclosureStrip>
      ) : form.lineageMode === 'onplatform' ? (
        <div>
          <Field label="Search on-platform artifacts">
            <input className="input" placeholder="Search by title…" value={q} onChange={e => setQ(e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {results.map(r => (
              <button key={r.ipId} onClick={() => set({ parentIpId: r.ipId })}
                className="panel-soft" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
                <TierBadge tier={r.tier} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</span>
                <span style={{ flex: 1 }}></span>
                {r.licenseTermsId ? <span className="font-mono" style={{ fontSize: 11, color: 'var(--ov-text-faint)' }}>#{r.licenseTermsId}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : form.lineageMode === 'oss' ? (
        <div>
          <DisclosureStrip tone="gated" icon="external">
            Registering an OSS provenance parent on-chain creates a real IP Asset for the upstream source before your derivative.
          </DisclosureStrip>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <Field label="Source URL"><input className="input mono" placeholder="https://github.com/org/repo" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="License"><input className="input" placeholder="Apache-2.0" /></Field>
              <Field label="Authors"><input className="input" placeholder="comma, separated" /></Field>
            </div>
            <button className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={() => set({ parentIpId: window.OV.ARTIFACTS[9].ipId })}>
              <Icon name="plus" size={14} />Register provenance parent
            </button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--ov-text-dim)' }}>This artifact is registered as an original work — no parent IP will be linked.</p>
      )}
    </div>
  );
}

/* ---------- ReviewStep ---------- */
function ReviewRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '9px 0', borderBottom: '1px solid var(--ov-line-soft)' }}>
      <span className="meta" style={{ color: 'var(--ov-text-faint)', width: 110, flex: 'none' }}>{label}</span>
      <span style={{ fontSize: 13 }}>{children}</span>
    </div>
  );
}
function ReviewStep({ form }) {
  const parent = form.parentIpId ? window.OV.find(form.parentIpId) : null;
  const gatedOrCompute = form.tier === 'gated' || form.tier === 'compute';
  return (
    <div>
      <dl style={{ margin: 0 }}>
        <ReviewRow label="File"><span className="font-mono">{form.file || '—'}</span></ReviewRow>
        <ReviewRow label="Modality">{form.modality === 'model' ? 'Model' : 'Dataset'}</ReviewRow>
        <ReviewRow label="Title">{form.title || '—'}</ReviewRow>
        <ReviewRow label="Tier"><TierBadge tier={form.tier} /></ReviewRow>
        <ReviewRow label="Tags">{form.tags || '—'}</ReviewRow>
        <ReviewRow label="Creators">{form.creators || '—'}</ReviewRow>
        {gatedOrCompute ? <ReviewRow label="Fee · Rev-share"><span className="font-mono">{form.fee || '0'} WIP · {form.revShare || '0'}%</span></ReviewRow> : null}
        {form.tier === 'compute' ? <ReviewRow label="Algorithms"><span className="font-mono" style={{ fontSize: 11.5 }}>{(form.algos || []).join(', ') || '—'}</span></ReviewRow> : null}
        {parent ? <ReviewRow label="Derived from"><TxLink ipId={parent.ipId} /></ReviewRow> : null}
      </dl>
      <p className="clamp-3" style={{ fontSize: 13, color: 'var(--ov-text-dim)', marginTop: 14, lineHeight: 1.6 }}>{form.description || 'No description provided.'}</p>
    </div>
  );
}

/* ---------- SuccessScreen ---------- */
function SuccessScreen({ form, ipId }) {
  const t = window.OV.TIERS[form.tier];
  const sealed = form.tier !== 'public';
  const parent = form.parentIpId ? window.OV.find(form.parentIpId) : null;
  return (
    <div className="panel anim-up" style={{ padding: 34, textAlign: 'center' }}>
      <span style={{ width: 56, height: 56, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'color-mix(in srgb,' + t.color + ' 16%, transparent)', color: t.color, border: '1.5px solid ' + t.color, marginBottom: 16 }}>
        <Icon name="check" size={28} />
      </span>
      <h1 className="h1" style={{ fontSize: 30 }}>Artifact registered</h1>
      <p style={{ color: 'var(--ov-text-dim)', marginTop: 10 }}>
        <strong>{form.title || 'Your artifact'}</strong> is now on-chain and {sealed ? 'sealed in its vault' : 'pinned in the clear'}.
      </p>
      <div className="panel-soft" style={{ padding: 16, marginTop: 22, textAlign: 'left', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><TierBadge tier={form.tier} /><ModalityChip modality={form.modality} /></div>
        <ReviewRow label="Title">{form.title || '—'}</ReviewRow>
        <ReviewRow label="IP asset"><TxLink ipId={ipId} /></ReviewRow>
        <ReviewRow label="Register tx"><TxLink tx={window.OV.hx(950, 64)} /></ReviewRow>
        {parent ? <ReviewRow label="Parent IP"><TxLink ipId={parent.ipId} /></ReviewRow> : null}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24 }}>
        <button className="btn btn-accent" onClick={() => go('/artifact/' + ipId)}>View artifact</button>
        <button className="btn btn-ghost" onClick={() => go('/')}>Back to browse</button>
      </div>
    </div>
  );
}

/* ---------- UploadWizard ---------- */
function UploadWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ modality: 'dataset', tier: 'public', lineageMode: 'original', parentIpId: null, algos: ['sha256:mean-aggregate'] });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const newIp = window.OV.hx(1234);

  function set(patch) { setForm(f => Object.assign({}, f, patch)); }
  const canNext = step === 0 ? !!form.file : step === 1 ? !!form.title : true;

  function submit() {
    setError(null);
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
    }, 2600);
  }

  if (done) {
    return <div className="container maxw-upload" style={{ paddingTop: 30, paddingBottom: 60 }}><SuccessScreen form={form} ipId={newIp} /></div>;
  }

  return (
    <div className="container maxw-upload" style={{ paddingTop: 30, paddingBottom: 60 }}>
      <div className="anim-up" style={{ marginBottom: 22 }}>
        <span className="eyebrow">PUBLISH</span>
        <h1 className="h1" style={{ fontSize: 'clamp(28px,4vw,40px)', margin: '10px 0 10px' }}>Register an artifact</h1>
        <p style={{ color: 'var(--ov-text-dim)', maxWidth: 540, fontSize: 14 }}>
          We register the IP first, then encrypt. Your <span className="font-mono" style={{ fontSize: 12.5 }}>ipId</span> exists before any byte is uploaded.
        </p>
      </div>

      <div className="panel" style={{ padding: 24 }}>
        <Stepper step={step} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
          <span className="font-mono" style={{ color: 'var(--ov-accent)', fontSize: 13 }}>{String(step + 1).padStart(2, '0')}</span>
          <span className="h2" style={{ fontSize: 16 }}>{STEPS[step]}</span>
        </div>

        {/* STEP PANELS */}
        {step === 0 ? (
          <div style={{ display: 'grid', gap: 18 }}>
            <Dropzone file={form.file} onFile={f => set({ file: f })} />
            <Field label="Modality">
              <div style={{ display: 'flex', gap: 8 }}>
                {['dataset', 'model'].map(m => (
                  <button key={m} onClick={() => set({ modality: m })} className="btn" style={{ flex: 1,
                    background: form.modality === m ? 'var(--ov-navy)' : 'var(--ov-panel)',
                    color: form.modality === m ? 'var(--ov-accent-ink)' : 'var(--ov-text-dim)',
                    border: '1.5px solid ' + (form.modality === m ? 'var(--ov-navy)' : 'var(--ov-line)') }}>
                    {m === 'dataset' ? 'Dataset' : 'Model'}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Title"><input className="input" placeholder="Helix-7B Instruct" value={form.title || ''} onChange={e => set({ title: e.target.value })} /></Field>
            <Field label="Description"><textarea className="textarea" rows={3} placeholder="What it is, how it was built, intended use…" value={form.description || ''} onChange={e => set({ description: e.target.value })} /></Field>
            <Field label="Tags (comma-separated)"><input className="input" placeholder="llm, instruct, 7b" value={form.tags || ''} onChange={e => set({ tags: e.target.value })} /></Field>
            <Field label="Creators (comma-separated)"><input className="input" placeholder="0x29bc…3C50, lab-name" value={form.creators || ''} onChange={e => set({ creators: e.target.value })} /></Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <TierPicker value={form.tier} onChange={k => set({ tier: k })} />
            {(form.tier === 'gated' || form.tier === 'compute') ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Minting fee (WIP)"><input className="input mono" placeholder="5.0" value={form.fee || ''} onChange={e => set({ fee: e.target.value })} /></Field>
                <Field label="Revenue share (%)"><input className="input mono" placeholder="8" value={form.revShare || ''} onChange={e => set({ revShare: e.target.value })} /></Field>
              </div>
            ) : null}
            {form.tier === 'compute' ? (
              <div>
                <div className="meta" style={{ marginBottom: 8 }}>Algorithm allowlist</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {window.OV.ALGOS.map(al => {
                    const on = (form.algos || []).includes(al.hash);
                    return (
                      <button key={al.hash} onClick={() => set({ algos: on ? form.algos.filter(h => h !== al.hash) : [...(form.algos || []), al.hash] })}
                        className="chip" style={{ cursor: 'pointer', padding: '8px 12px', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-mono)', fontSize: 11.5,
                          borderColor: on ? 'var(--tier-compute)' : 'var(--ov-line)', color: on ? 'var(--tier-compute)' : 'var(--ov-text-dim)',
                          background: on ? 'color-mix(in srgb, var(--tier-compute) 12%, transparent)' : 'var(--ov-panel)' }}>
                        <span style={{ display: 'inline-flex' }}><Icon name={on ? 'check' : 'plus'} size={12} /></span>{al.hash}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--ov-text-faint)', marginTop: 10 }}>Compute data is never downloadable — only allowlisted aggregates ever leave the worker.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? <LineageStep form={form} set={set} /> : null}
        {step === 4 ? <ReviewStep form={form} /> : null}

        {/* submit progress */}
        {submitting ? (
          <div className="anim-up" style={{ marginTop: 18 }}>
            <DisclosureStrip tone="compute" icon="bolt">Registering IP → encrypting to license-gated vault → indexing artifact…</DisclosureStrip>
          </div>
        ) : null}
        {error ? <div style={{ marginTop: 16 }}><DisclosureStrip tone="gated" icon="flag">{error}</DisclosureStrip></div> : null}

        {/* footer nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26 }}>
          <button className="btn btn-ghost" disabled={step === 0 || submitting} onClick={() => setStep(s => Math.max(0, s - 1))}>Back</button>
          {step < 4 ? (
            <button className="btn btn-accent" disabled={!canNext} onClick={() => setStep(s => s + 1)}>Continue</button>
          ) : (
            <button className="btn btn-accent" disabled={submitting} style={{ minWidth: 200 }} onClick={submit}>
              {submitting ? <Spinner /> : null}{submitting ? 'Publishing…' : 'Register & upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { UploadWizard });
