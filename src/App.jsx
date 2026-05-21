import { useState } from 'react';
import NavBar from './components/NavBar';
import Dashboard from './views/Dashboard';
import ACWR from './views/ACWR';
import Bosco from './views/Bosco';
import Wellness from './views/Wellness';
import VBT from './views/VBT';
import TabVelocidad from './views/Velocidad';
import TabAgilidad from './views/Agilidad';
import EvaluacionesView from './views/EvaluacionesView';

const views = {
  dashboard:    Dashboard,
  acwr:         ACWR,
  bosco:        Bosco,
  velocidad:    TabVelocidad,
  agilidad:     TabAgilidad,
  evaluaciones: EvaluacionesView,
  wellness:     Wellness,
  vbt:          VBT,
};

export default function App() {
  const [active, setActive] = useState('dashboard');
  const View = views[active];

  return (
    <div className="min-h-screen bg-background text-slate-100" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex md:flex-row flex-col min-h-screen">
        <NavBar active={active} onChange={setActive} />
        <main className="flex-1 p-4 pb-20 md:pb-4 max-w-2xl mx-auto w-full">
          <View onNavigate={setActive} />
        </main>
      </div>
    </div>
  );
}
