/* ============================================================
   OPENVAULT — router + mount
   ============================================================ */

function parseRoute() {
  let h = window.location.hash.replace(/^#/, '');
  if (!h || h === '/') return { name: '/', param: null };
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'upload') return { name: '/upload' };
  if (parts[0] === 'leaderboard') return { name: '/leaderboard' };
  if (parts[0] === 'artifact') return { name: '/artifact', param: parts[1] };
  if (parts[0] === 'compute') return { name: '/compute', param: parts[1] };
  if (parts[0] === 'group') return { name: '/group', param: parts[1] };
  return { name: '/' };
}

function App() {
  const [route, setRoute] = useState(parseRoute());
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    function onHash() { setRoute(parseRoute()); window.scrollTo(0, 0); }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // WasmGate — secure runtime boot
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 1100);
    return () => clearTimeout(t);
  }, []);

  if (booting) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <VaultMark size={46} />
        <Spinner lg />
        <div className="meta" style={{ color: 'var(--ov-text-dim)' }}>Initializing secure runtime…</div>
        <div className="font-jp" style={{ fontSize: 12, letterSpacing: '0.3em', color: 'var(--ov-text-faint)' }}>セキュア ランタイム</div>
      </div>
    );
  }

  let body;
  switch (route.name) {
    case '/upload': body = <UploadWizard />; break;
    case '/leaderboard': body = <Leaderboard />; break;
    case '/artifact': body = <ArtifactDetail ipId={route.param} />; break;
    case '/compute': body = <ComputeJobPanel ipId={route.param} />; break;
    case '/group': body = <GroupPage groupId={route.param} />; break;
    default: body = <Browse />;
  }

  const routePath = route.name === '/artifact' ? '/artifact' : route.name === '/compute' ? '/compute' : route.name === '/group' ? '/group' : route.name.replace('#', '');

  return (
    <div className="ov-app">
      <Header route={routePath === '/' ? '/' : routePath} />
      <main key={window.location.hash}>{body}</main>
      <CdrLimitsNotice />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('ov-root')).render(<App />);
