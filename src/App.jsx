import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './views/Login';
import NavBar from './components/NavBar';
import Dashboard from './views/Dashboard';
import ACWR from './views/ACWR';
import Bosco from './views/Bosco';
import Wellness from './views/Wellness';
import VBT from './views/VBT';
import TabVelocidad from './views/Velocidad';
import TabAgilidad from './views/Agilidad';
import EvaluacionesView from './views/EvaluacionesView';
import HooperQR from './views/HooperQR';
import RPEForm from './views/RPEForm';
import CargaSesionView from './views/CargaSesionView';
import PlayerProfile from './views/PlayerProfile';
import JumpAnalysis from './views/JumpAnalysis';
import MovilidadTobillo from './views/MovilidadTobillo';

// Detectar ruta /hooper/:teamId y /rpe/:teamId sin React Router (módulo-level, no cambia en runtime)
const HOOPER_MATCH = window.location.pathname.match(/^\/hooper\/([^/]+)/);
const RPE_MATCH    = window.location.pathname.match(/^\/rpe\/([^/]+)/);

const views = {
  dashboard:       Dashboard,
  acwr:            ACWR,
  bosco:           Bosco,
  velocidad:       TabVelocidad,
  agilidad:        TabAgilidad,
  evaluaciones:    EvaluacionesView,
  wellness:        Wellness,
  vbt:             VBT,
  carga:           CargaSesionView,
  player:          PlayerProfile,
  jumpAnalysis:    JumpAnalysis,
  movilidadTobillo: MovilidadTobillo,
};

function AppContent() {
  const { coach } = useAuth();
  const [active,   setActive]   = useState('dashboard');
  const [navParam, setNavParam] = useState(null);

  function navigate(view, param = null) {
    setActive(view);
    setNavParam(param);
  }

  // Rutas standalone QR — sin auth, sin navbar
  if (HOOPER_MATCH) return <HooperQR teamId={HOOPER_MATCH[1]} />;
  if (RPE_MATCH)    return <RPEForm  teamId={RPE_MATCH[1]}    />;

  // Gate de login
  if (!coach) return <Login />;

  const View = views[active];

  return (
    <div className="min-h-screen bg-background text-slate-100"
      style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex md:flex-row flex-col min-h-screen">
        <NavBar active={active} onChange={navigate} />
        <main className="flex-1 p-4 pb-20 md:pb-4 max-w-2xl mx-auto w-full">
          <View
            key={active === 'wellness' || active === 'player' || active === 'movilidadTobillo'
              ? `${active}-${navParam}` : active}
            onNavigate={navigate}
            initialId={navParam}
          />
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
