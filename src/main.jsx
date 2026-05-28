import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0f172a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, fontFamily: 'monospace',
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid #ef4444',
            borderRadius: 12, padding: 24, maxWidth: 600, width: '100%',
          }}>
            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
              ⚠ Error de renderizado
            </div>
            <pre style={{
              color: '#fca5a5', fontSize: 12, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', margin: 0,
            }}>
              {this.state.error.toString()}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
