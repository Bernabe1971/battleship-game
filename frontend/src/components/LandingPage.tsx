import { useState, useEffect } from 'react';
import { TeamId } from '../types';

interface Props {
  onHost: () => void;
  onJoin: (code: string, name: string, team: TeamId) => void;
  error: string;
}

export function LandingPage({ onHost, onJoin, error }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [team, setTeam] = useState<TeamId>('A');
  const [tab, setTab] = useState<'join' | 'host'>('join');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) { setCode(c.toUpperCase()); setTab('join'); }
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    onJoin(code.trim().toUpperCase(), name.trim(), team);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24 }}>
      <div style={{ fontSize: 52, marginBottom: 8 }}>⚓</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, letterSpacing: -1 }}>BATTLESHIP</h1>
      <p style={{ color: '#64748b', marginBottom: 28, fontSize: 14 }}>Juego por equipos</p>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: '#1e293b', borderRadius: 10, padding: 4, marginBottom: 24, width: '100%', maxWidth: 340 }}>
        {(['join', 'host'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, fontWeight: 600, fontSize: 14,
              background: tab === t ? '#2563eb' : 'transparent',
              color: tab === t ? '#fff' : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            {t === 'join' ? '🎮 Unirse' : '🖥️ Ser Host'}
          </button>
        ))}
      </div>

      {tab === 'join' ? (
        <form onSubmit={handleJoin} style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="card"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Código de sala (ej: AB3K7)"
            maxLength={6}
            style={{ fontSize: 20, textAlign: 'center', letterSpacing: 4, fontWeight: 700, color: '#f1f5f9', background: '#1e293b', border: '2px solid #334155', borderRadius: 10, padding: '14px 16px', width: '100%' }}
            autoComplete="off"
          />
          <input
            className="card"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tu nombre"
            maxLength={20}
            style={{ fontSize: 16, color: '#f1f5f9', background: '#1e293b', border: '2px solid #334155', borderRadius: 10, padding: '12px 16px', width: '100%' }}
            autoComplete="off"
          />
          <div style={{ display: 'flex', gap: 10 }}>
            {(['A', 'B'] as TeamId[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTeam(t)}
                style={{
                  flex: 1, padding: 14, borderRadius: 10, fontWeight: 700, fontSize: 15,
                  background: team === t ? (t === 'A' ? '#1d4ed8' : '#dc2626') : '#1e293b',
                  color: team === t ? '#fff' : '#64748b',
                  border: `2px solid ${team === t ? 'transparent' : '#334155'}`,
                  transition: 'all 0.15s',
                }}
              >
                Equipo {t}
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="btn btn-blue"
            disabled={!code.trim() || !name.trim()}
            style={{ width: '100%', fontSize: 16, padding: 14 }}
          >
            Entrar al juego
          </button>
        </form>
      ) : (
        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
            Como host controlas el inicio y reinicio del juego. Proyecta tu pantalla para que todos vean el código QR.
          </div>
          <button
            onClick={onHost}
            className="btn btn-green"
            style={{ width: '100%', fontSize: 16, padding: 14 }}
          >
            Crear sala
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#450a0a', borderRadius: 10, color: '#fca5a5', fontSize: 14, maxWidth: 340, width: '100%', textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  );
}
