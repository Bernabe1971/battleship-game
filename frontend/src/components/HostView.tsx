import { QRCodeSVG } from 'qrcode.react';
import { GameState, TEAM_COLORS } from '../types';
import { Grid } from './Grid';

interface Props {
  gameState: GameState | null;
  roomCode: string;
  onStart: () => void;
  onRestart: () => void;
}

export function HostView({ gameState, roomCode, onStart, onRestart }: Props) {
  const joinUrl = `${window.location.origin}/?code=${roomCode}`;

  if (!gameState) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 20 }}>
        <div className="pulse" style={{ color: '#64748b' }}>Conectando...</div>
      </div>
    );
  }

  const { phase, players, teams, currentTurn, winner, voteActive, secondsLeft } = gameState;
  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>⚓ BATTLESHIP</h1>
          <div style={{ color: '#64748b', fontSize: 13 }}>Vista del host</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {phase === 'waiting' && (
            <button
              className="btn btn-green"
              onClick={onStart}
              disabled={teamA.length === 0 || teamB.length === 0}
              style={{ fontSize: 14, padding: '10px 18px' }}
            >
              ▶ Iniciar juego
            </button>
          )}
          {(phase === 'ended' || phase === 'battle' || phase === 'placing') && (
            <button className="btn btn-gray" onClick={onRestart} style={{ fontSize: 14, padding: '10px 18px' }}>
              ↺ Reiniciar
            </button>
          )}
        </div>
      </div>

      {/* Waiting phase: QR + player list */}
      {phase === 'waiting' && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
            <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
              <QRCodeSVG value={joinUrl} size={180} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 6, color: '#60a5fa' }}>{roomCode}</div>
            <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center', maxWidth: 200 }}>
              Escanea o visita:<br />
              <span style={{ color: '#94a3b8', wordBreak: 'break-all' }}>{joinUrl}</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <TeamPlayerList team="A" players={teamA} />
            <div style={{ marginTop: 12 }}>
              <TeamPlayerList team="B" players={teamB} />
            </div>
            {(teamA.length === 0 || teamB.length === 0) && (
              <div style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>
                Necesitas al menos 1 jugador por equipo para iniciar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Placing phase */}
      {phase === 'placing' && (
        <div>
          <h2 style={{ marginBottom: 12, color: '#94a3b8' }}>Colocando barcos...</h2>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {(['A', 'B'] as const).map(t => (
              <div key={t}>
                <div className={`tag tag-${t}`} style={{ marginBottom: 8 }}>Equipo {t}</div>
                <div style={{ color: teams[t].placingDone ? '#22c55e' : '#f59e0b', fontSize: 13, marginBottom: 8 }}>
                  {teams[t].placingDone ? '✓ Listo' : '⏳ Colocando...'}
                </div>
                <Grid grid={teams[t].grid} disabled size={32} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Battle phase */}
      {phase === 'battle' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div>
              <span style={{ color: '#64748b', fontSize: 13 }}>Turno: </span>
              <span className={`tag tag-${currentTurn}`}>Equipo {currentTurn}</span>
            </div>
            {voteActive && (
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f59e0b', fontSize: 13, marginBottom: 4 }}>Votando — {secondsLeft}s</div>
                <div className="timer-bar">
                  <div className="timer-fill" style={{
                    width: `${(secondsLeft / 20) * 100}%`,
                    background: secondsLeft > 10 ? '#22c55e' : secondsLeft > 5 ? '#f59e0b' : '#dc2626',
                  }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {(['A', 'B'] as const).map(t => (
              <div key={t}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className={`tag tag-${t}`}>Equipo {t}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {teams[t].shipsRemaining}/{teams[t].totalShips} barcos
                  </span>
                </div>
                <Grid grid={teams[t].grid} disabled size={34} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ended phase */}
      {phase === 'ended' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 72 }}>🏆</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 12 }}>
            ¡Equipo {winner} gana!
          </div>
          <button className="btn btn-gray" onClick={onRestart} style={{ marginTop: 24, fontSize: 16, padding: '12px 28px' }}>
            ↺ Jugar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}

function TeamPlayerList({ team, players }: { team: 'A' | 'B'; players: { name: string; isCaptain: boolean }[] }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className={`tag tag-${team}`}>Equipo {team}</span>
        <span style={{ color: '#64748b', fontSize: 12 }}>{players.length} jugador(es)</span>
      </div>
      {players.length === 0 ? (
        <div style={{ color: '#475569', fontSize: 13 }}>Sin jugadores aún</div>
      ) : (
        players.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 16 }}>{p.isCaptain ? '👑' : '⚓'}</span>
            <span style={{ fontSize: 14 }}>{p.name}</span>
            {p.isCaptain && <span style={{ fontSize: 11, color: '#64748b' }}>capitán</span>}
          </div>
        ))
      )}
    </div>
  );
}
