import { useState, lazy, Suspense } from 'react';
import { LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TeamProvider } from './context/TeamContext';
import NavBar from './components/NavBar';
import TeamSelector from './components/TeamSelector';
import LoginView from './views/LoginView';

// Lazy-loaded views — each becomes a separate chunk so recharts/jspdf
// are never bundled into the initial JS payload.
const Dashboard        = lazy(() => import('./views/Dashboard'));
const ACWR             = lazy(() => import('./views/ACWR'));
const BoscoView        = lazy(() => import('./views/BoscoView'));
const Wellness         = lazy(() => import('./views/Wellness'));
const VBT              = lazy(() => import('./views/VBT'));
const TabVelocidad     = lazy(() => import('./views/Velocidad'));
const TabAgilidad      = lazy(() => import('./views/Agilidad'));
const EvaluacionesView = lazy(() => import('./views/EvaluacionesView'));
const HooperQR         = lazy(() => import('./views/HooperQR'));
const RPEForm          = lazy(() => import('./views/RPEForm'));
const CargaSesionView  = lazy(() => import('./views/CargaSesionView'));
const PlayerProfile    = lazy(() => import('./views/PlayerProfile'));
const JumpAnalysis     = lazy(() => import('./views/JumpAnalysis'));
const GoniometroView   = lazy(() => import('./views/GoniometroView'));
const MovilidadTobillo = lazy(() => import('./views/MovilidadTobillo'));
const WellnessFormPublic = lazy(() => import('./views/WellnessFormPublic'));
const QRGeneratorView    = lazy(() => import('./views/QRGeneratorView'));

// Detectar rutas públicas sin React Router (módulo-level, no cambia en runtime)
const HOOPER_MATCH    = window.location.pathname.match(/^\/hooper\/([^/]+)/);
const RPE_MATCH       = window.location.pathname.match(/^\/rpe\/([^/]+)/);
const WELLNESS_PUBLIC = window.location.pathname === '/wellness';

const views = {
  dashboard:        Dashboard,
  acwr:             ACWR,
  bosco:            BoscoView,
  velocidad:        TabVelocidad,
  agilidad:         TabAgilidad,
  evaluaciones:     EvaluacionesView,
  wellness:         Wellness,
  vbt:              VBT,
  carga:            CargaSesionView,
  player:           PlayerProfile,
  jumpAnalysis:     JumpAnalysis,
  movilidadTobillo: MovilidadTobillo,
  goniometro:       GoniometroView,
  qr:               QRGeneratorView,
};

const FALLBACK = (
  <div className="flex items-center justify-center h-64 text-slate-400">
    Cargando...
  </div>
);

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [active,   setActive]   = useState('dashboard');
  const [navParam, setNavParam] = useState(null);
  const [hideNav,  setHideNav]  = useState(false);

  function navigate(view, param = null) {
    setActive(view);
    setNavParam(param);
  }

  // Rutas públicas — sin auth, sin navbar
  if (HOOPER_MATCH)    return <Suspense fallback={FALLBACK}><HooperQR          teamId={HOOPER_MATCH[1]} /></Suspense>;
  if (RPE_MATCH)       return <Suspense fallback={FALLBACK}><RPEForm           teamId={RPE_MATCH[1]}    /></Suspense>;
  if (WELLNESS_PUBLIC) return <Suspense fallback={FALLBACK}><WellnessFormPublic /></Suspense>;

  // Loading inicial de sesión Supabase
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-slate-400 text-sm">Cargando...</div>
      </div>
    );
  }

  // Gate de login
  if (!user) return <LoginView />;

  const View = views[active];

  return (
    <div className="min-h-screen bg-background text-slate-100"
      style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex md:flex-row flex-col min-h-screen">
        {!hideNav && <NavBar active={active} onChange={navigate} />}
        <div className="flex-1 flex flex-col min-h-screen">
          {!hideNav && (
            <div className="px-4 pt-3 max-w-2xl mx-auto w-full flex items-center justify-between gap-3">
              <TeamSelector />
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          )}
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
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TeamProvider>
        <AppContent />
      </TeamProvider>
    </AuthProvider>
  );
}
