import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const COACHES_DB = {
  'hernan@fieldlab.com': { password: 'demo1234', name: 'Hernán Kreick' },
};

export function AuthProvider({ children }) {
  const [coach, setCoach] = useState(() => {
    try {
      const saved = localStorage.getItem('fieldlab_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  function login(email, password) {
    const found = COACHES_DB[email.toLowerCase()];
    if (!found || found.password !== password) {
      throw new Error('Credenciales incorrectas');
    }
    const session = {
      id:    email.toLowerCase().replace(/[@.]/g, '_'),
      email: email.toLowerCase(),
      name:  found.name,
    };
    localStorage.setItem('fieldlab_session', JSON.stringify(session));
    setCoach(session);
  }

  function logout() {
    localStorage.removeItem('fieldlab_session');
    setCoach(null);
  }

  return (
    <AuthContext.Provider value={{ coach, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
