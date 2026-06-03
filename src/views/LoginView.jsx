import { useState } from 'react';
import { Activity, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginView() {
  const { signIn, signUp } = useAuth();
  const [tab,     setTab]     = useState('login');
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [showP,   setShowP]   = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await signIn(email.trim(), pass);
      } else {
        await signUp(email.trim(), pass);
        setSuccess(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t) {
    setTab(t); setError(''); setSuccess(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-800 rounded-xl p-8 text-center border border-white/10">
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-lg font-bold text-slate-100 mb-2">Revisá tu email</h2>
          <p className="text-sm text-slate-400">
            Te enviamos un enlace de confirmación. Activá tu cuenta antes de iniciar sesión.
          </p>
          <button
            onClick={() => { setSuccess(false); setTab('login'); }}
            className="mt-6 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-blue-500/30
            flex items-center justify-center mb-3">
            <Activity size={26} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">FIELD LAB</h1>
          <p className="text-sm text-slate-500 mt-1">Athlete Management System</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-xl border border-white/10 p-8 space-y-5">
          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-900 p-1 gap-1">
            {[['login', 'Iniciar sesión'], ['register', 'Registrarse']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  tab === id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="coach@fieldlab.com"
                  required
                  className="w-full bg-slate-900 border border-white/10 rounded-lg
                    pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600
                    focus:outline-none focus:border-blue-500/60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showP ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-900 border border-white/10 rounded-lg
                    pl-9 pr-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-600
                    focus:outline-none focus:border-blue-500/60"
                />
                <button
                  type="button"
                  onClick={() => setShowP(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showP ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !pass}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg
                text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {loading ? 'Procesando...' : tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
