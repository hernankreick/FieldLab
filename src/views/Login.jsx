import { useState } from 'react';
import { Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      login(email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-card border border-accent/30
            flex items-center justify-center mb-3">
            <Activity size={26} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">FIELD LAB</h1>
          <p className="text-sm text-slate-500 mt-1">Athlete Management System</p>
        </div>

        <div className="bg-card rounded-2xl border border-white/10 p-6 space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="profe@fieldlab.com"
              className="w-full bg-background border border-white/10 rounded-xl
                px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600
                focus:outline-none focus:border-accent/50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
              className="w-full bg-background border border-white/10 rounded-xl
                px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600
                focus:outline-none focus:border-accent/50"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="w-full bg-accent text-background font-bold py-2.5 rounded-xl
              text-sm disabled:opacity-40 disabled:cursor-not-allowed
              hover:bg-accent/90 transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <p className="text-center text-xs text-slate-600">
            Demo: hernan@fieldlab.com / demo1234
          </p>
        </div>
      </div>
    </div>
  );
}
