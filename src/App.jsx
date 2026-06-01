import { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './views/Login';
import NavBar from './components/NavBar';

// Lazy-loaded views — each becomes a separate chunk so recharts/jspdf
// are never bundled into the initial JS payload.
const Dashboard       = lazy(() => import('./views/Dashboard'));
const ACWR            = lazy(() => import('./views/ACWR'));
const Bosco           = lazy(() => import('./views/Bosco'));
const Wellness        = lazy(() => import('./views/Wellness'));
const VBT             = lazy(() => import('./views/VBT'));
const TabVelocidad    = lazy(() => import('./views/Velocidad'));
const TabAgilidad     = lazy(() => import('./views/Agilidad'));
const EvaluacionesView = lazy(() => import('./views/EvaluacionesView'));
const HooperQR        = lazy(() => import('./views/HooperQR'));
const RPEForm         = lazy(() => import('./views/RPEForm'));
const CargaSesionView = lazy(() => import('./views/CargaSesionView'));
const PlayerProfile   = lazy(() => import('./views/PlayerProfile'));
const JumpAnalysis    = lazy(() => import('./views/JumpAnalysis'));
const GoniometroView  = lazy(() => import('./views/GoniometroView'));

// Detectar ruta /hooper/:teamId y /rpe/:teamId sin React Router (módulo-level, no cambia en runtime)
const HOOPER_MATCH = window.location.pathname.match(/^\/hooper\/([^/]+)/);
const RPE_MATCH    = window.location.pathname.match(/^\/rpe\/([^/]+)/);

const views = {
  dashboard:    Dashboard,
  acwr:         ACWR,
  bosco:        Bosco,
  velocidad:    TabVelocidad,
  agilidad:     TabAgilidad,
  evaluaciones: EvaluacionesView,
  wellness:     Wellness,
  vbt:          VBT,
  carga:        CargaSesionView,
  player:       PlayerProfile,
  jumpAnalysis: JumpAnalysis,
  goniometro:   GoniometroView,
};

const FALLBACK = (
  <div className="flex items-center justify-center h-64 text-slate-400">
    Cargando...
  </div>
);

function AppContent() {
  const { coach } = useAuth();
  const [active,   setActive]   = useState('dashboard');
  const [navParam, setNavParam] = useState(null);
  const [hideNav,  setHideNav]  = useState(false);

  function navigate(view, param = null) {
    setActive(view);
    setNavParam(param);
  }

  // Rutas standalone QR — sin auth, sin navbar
  if (HOOPER_MATCH) return <Suspense fallback={FALLBACK}><HooperQR teamId={HOOPER_MATCH[1]} /></Suspense>;
  if (RPE_MATCH)    return <Suspense fallback={FALLBACK}><RPEForm  teamId={RPE_MATCH[1]}    /></Suspense>;

  // Gate de login
  if (!coach) return <Login />;

  const View = views[active];

  return (
    <div className="min-h-screen bg-background text-slate-100"
      style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex md:flex-row flex-col min-h-screen">
        {!hideNav && <NavBar active={active} onChange={navigate} />}
        <main className="flex-1 p-4 pb-20 md:pb-4 max-w-2xl mx-auto w-full">
          <Suspense fallback={FALLBACK}>
            <View
              key={active === 'wellness' || active === 'player'
                ? `${active}-${navParam}` : active}
              onNavigate={navigate}
              initialId={navParam}
              onFullscreen={setHideNav}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
