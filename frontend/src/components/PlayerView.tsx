import { useState, useMemo } from 'react';
import { GameState, TeamId, AttackResult, SHIP_SIZES, GRID_SIZE, CellState } from '../types';
import { Grid } from './Grid';

interface Props {
  gameState: GameState;
  playerName: string;
  playerTeam: TeamId;
  onPlaceShips: (ships: { cells: [number, number][] }[]) => void;
  onVote: (row: number, col: number) => void;
  seconds: number;
  lastAttack: AttackResult | null;
}

export function PlayerView({ gameState, playerName, playerTeam, onPlaceShips, onVote, seconds, lastAttack }: Props) {
  const { phase, currentTurn, winner, teams, players, voteActive } = gameState;

  const me = players.find(p => p.isMe || p.name === playerName);
  const isCaptain = me?.isCaptain ?? false;
  const myTeam = teams[playerTeam];
  const oppTeam = teams[playerTeam === 'A' ? 'B' : 'A'];
  const oppTeamId: TeamId = playerTeam === 'A' ? 'B' : 'A';
  const isMyTurn = currentTurn === playerTeam;

  return (
    <div style={{ padding: 16, maxWidth: 440, margin: '0 auto' }}>
      {/* Header strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <span style={{ fontWeight: 700 }}>⚓ {playerName}</span>
          <span className={`tag tag-${playerTeam}`} style={{ marginLeft: 8 }}>Equipo {playerTeam}</span>
          {isCaptain && <span style={{ fontSize: 18, marginLeft: 4 }}>👑</span>}
        </div>
        <div style={{ color: '#64748b', fontSize: 12 }}>{gameState.code}</div>
      </div>

      {phase === 'waiting' && <WaitingView players={players} />}
      {phase === 'placing' && (
        isCaptain
          ? <PlacingView teamGrid={myTeam.grid} onConfirm={onPlaceShips} done={myTeam.placingDone} oppDone={oppTeam.placingDone} />
          : <CrewWaitView myTeamDone={myTeam.placingDone} oppDone={oppTeam.placingDone} grid={myTeam.grid} />
      )}
      {phase === 'battle' && (
        <BattleView
          myTeamId={playerTeam}
          oppTeamId={oppTeamId}
          myGrid={myTeam.grid}
          oppGrid={oppTeam.grid}
          myShipsLeft={myTeam.shipsRemaining}
          oppShipsLeft={oppTeam.shipsRemaining}
          isMyTurn={isMyTurn}
          voteActive={voteActive}
          seconds={seconds}
          lastAttack={lastAttack}
          onVote={onVote}
        />
      )}
      {phase === 'ended' && <EndedView winner={winner!} myTeam={playerTeam} />}
    </div>
  );
}

/* ── Waiting ── */
function WaitingView({ players }: { players: GameState['players'] }) {
  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');
  return (
    <div className="slide-in">
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <div className="pulse" style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Esperando que el host inicie...</div>
        <div style={{ color: '#64748b', fontSize: 13 }}>El host iniciará el juego cuando todos estén listos.</div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {(['A', 'B'] as const).map(t => (
          <div key={t} className="card" style={{ flex: 1 }}>
            <div className={`tag tag-${t}`} style={{ marginBottom: 8 }}>Equipo {t}</div>
            {(t === 'A' ? teamA : teamB).map((p, i) => (
              <div key={i} style={{ fontSize: 14, marginTop: 4 }}>
                {p.isCaptain ? '👑' : '⚓'} {p.name}
              </div>
            ))}
            {(t === 'A' ? teamA : teamB).length === 0 && (
              <div style={{ color: '#475569', fontSize: 13 }}>Sin jugadores</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Placing (captain) ── */
function PlacingView({
  teamGrid, onConfirm, done, oppDone,
}: { teamGrid: CellState[][]; onConfirm: (ships: { cells: [number, number][] }[]) => void; done: boolean; oppDone: boolean }) {
  const [orientation, setOrientation] = useState<'H' | 'V'>('H');
  const [hovered, setHovered] = useState<[number, number] | null>(null);
  const [placedShips, setPlacedShips] = useState<[number, number][][]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const shipIndex = placedShips.length;
  const currentSize = SHIP_SIZES[shipIndex] ?? 0;
  const allPlaced = placedShips.length === SHIP_SIZES.length;

  // Build working grid from placed ships
  const workingGrid = useMemo<CellState[][]>(() => {
    const g: CellState[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('empty'));
    for (const ship of placedShips) {
      for (const [r, c] of ship) g[r][c] = 'ship';
    }
    return g;
  }, [placedShips]);

  // Compute preview cells from hovered cell
  const { previewCells, previewValid } = useMemo(() => {
    if (!hovered || allPlaced) return { previewCells: [], previewValid: true };
    const [r, c] = hovered;
    const cells: [number, number][] = [];
    let valid = true;
    for (let i = 0; i < currentSize; i++) {
      const nr = orientation === 'V' ? r + i : r;
      const nc = orientation === 'H' ? c + i : c;
      if (nr >= GRID_SIZE || nc >= GRID_SIZE) { valid = false; break; }
      if (workingGrid[nr][nc] === 'ship') { valid = false; }
      cells.push([nr, nc]);
    }
    if (cells.length < currentSize) valid = false;
    return { previewCells: cells, previewValid: valid };
  }, [hovered, orientation, workingGrid, currentSize, allPlaced]);

  function handleCellClick(r: number, c: number) {
    if (allPlaced || done) return;
    if (!previewValid || previewCells.length < currentSize) {
      setErrorMsg('Posición inválida — fuera del tablero o superpuesto.');
      return;
    }
    setErrorMsg('');
    setPlacedShips(prev => [...prev, previewCells.map(([pr, pc]) => [pr, pc] as [number, number])]);
  }

  function handleUndo() {
    setPlacedShips(prev => prev.slice(0, -1));
    setErrorMsg('');
  }

  function handleConfirm() {
    if (!allPlaced) return;
    onConfirm(placedShips.map(cells => ({ cells })));
  }

  if (done) {
    return (
      <div className="card slide-in" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>¡Barcos confirmados!</div>
        <div className="pulse" style={{ color: '#64748b', fontSize: 13 }}>
          {oppDone ? 'Iniciando batalla...' : 'Esperando al capitán rival...'}
        </div>
      </div>
    );
  }

  return (
    <div className="slide-in">
      <div style={{ marginBottom: 10, fontWeight: 600 }}>
        Coloca tus barcos ({shipIndex + 1}/{SHIP_SIZES.length})
        {currentSize > 0 && <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}> — tamaño {currentSize}</span>}
      </div>

      {/* Ship queue */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {SHIP_SIZES.map((sz, i) => (
          <div
            key={i}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              background: i < placedShips.length ? '#166534' : i === placedShips.length ? '#1d4ed8' : '#1e293b',
              color: i < placedShips.length ? '#86efac' : '#fff',
              border: i === placedShips.length ? '2px solid #60a5fa' : '2px solid transparent',
            }}
          >
            {i < placedShips.length ? '✓' : sz}
          </div>
        ))}
      </div>

      {/* Orientation toggle */}
      {!allPlaced && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['H', 'V'] as const).map(o => (
            <button
              key={o}
              onClick={() => setOrientation(o)}
              style={{
                padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                background: orientation === o ? '#2563eb' : '#1e293b',
                color: '#fff', border: `2px solid ${orientation === o ? '#60a5fa' : '#334155'}`,
              }}
            >
              {o === 'H' ? '↔ Horizontal' : '↕ Vertical'}
            </button>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <Grid
          grid={workingGrid}
          previewCells={previewCells}
          previewValid={previewValid}
          onCellClick={handleCellClick}
          onCellHover={(r, c) => setHovered([r, c])}
          onMouseLeave={() => setHovered(null)}
          disabled={allPlaced || done}
        />
      </div>

      {errorMsg && (
        <div style={{ marginTop: 8, color: '#fca5a5', fontSize: 13 }}>{errorMsg}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {placedShips.length > 0 && !allPlaced && (
          <button className="btn btn-gray" onClick={handleUndo} style={{ flex: 1, fontSize: 14, padding: '10px 0' }}>
            ↩ Deshacer
          </button>
        )}
        {allPlaced && (
          <button className="btn btn-green" onClick={handleConfirm} style={{ flex: 1, fontSize: 15, padding: '12px 0' }}>
            ✓ Confirmar posición
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Placing (crew) ── */
function CrewWaitView({ myTeamDone, oppDone, grid }: { myTeamDone: boolean; oppDone: boolean; grid: CellState[][] }) {
  return (
    <div className="slide-in">
      <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 14 }}>
        <div className="pulse" style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
        <div style={{ fontWeight: 600 }}>El capitán está posicionando los barcos</div>
        <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          Tu equipo: {myTeamDone ? '✅ Listo' : '⏳ Colocando...'} &nbsp;|&nbsp;
          Rival: {oppDone ? '✅ Listo' : '⏳ Colocando...'}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <Grid grid={grid} disabled />
      </div>
    </div>
  );
}

/* ── Battle ── */
function BattleView({
  myTeamId, oppTeamId, myGrid, oppGrid,
  myShipsLeft, oppShipsLeft,
  isMyTurn, voteActive, seconds, lastAttack, onVote,
}: {
  myTeamId: TeamId; oppTeamId: TeamId;
  myGrid: CellState[][]; oppGrid: CellState[][];
  myShipsLeft: number; oppShipsLeft: number;
  isMyTurn: boolean; voteActive: boolean; seconds: number;
  lastAttack: AttackResult | null;
  onVote: (r: number, c: number) => void;
}) {
  const [myVote, setMyVote] = useState<[number, number] | null>(null);

  function handleVote(r: number, c: number) {
    if (!isMyTurn || !voteActive) return;
    setMyVote([r, c]);
    onVote(r, c);
  }

  const timerPct = (seconds / 20) * 100;
  const timerColor = seconds > 10 ? '#22c55e' : seconds > 5 ? '#f59e0b' : '#dc2626';

  return (
    <div className="slide-in">
      {/* Status bar */}
      <div className="card" style={{ marginBottom: 12, padding: '12px 14px' }}>
        {isMyTurn ? (
          <div>
            {voteActive ? (
              <div>
                <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>
                  ⚔️ ¡Es tu turno! Vota donde atacar
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="timer-bar" style={{ flex: 1 }}>
                    <div className="timer-fill" style={{ width: `${timerPct}%`, background: timerColor }} />
                  </div>
                  <div style={{ color: timerColor, fontWeight: 700, fontSize: 16, minWidth: 28 }}>{seconds}</div>
                </div>
              </div>
            ) : (
              <div className="pulse" style={{ color: '#f59e0b', fontWeight: 600 }}>Preparando ataque...</div>
            )}
          </div>
        ) : (
          <div className="pulse" style={{ color: '#64748b', fontWeight: 600 }}>
            Turno del Equipo {oppTeamId}... esperando
          </div>
        )}
      </div>

      {/* Attack notification */}
      {lastAttack && (
        <div
          className="card slide-in"
          style={{
            marginBottom: 12, padding: '10px 14px', textAlign: 'center',
            background: lastAttack.hit ? '#14532d' : '#1e293b',
            border: `1px solid ${lastAttack.hit ? '#16a34a' : '#334155'}`,
          }}
        >
          {lastAttack.hit
            ? (lastAttack.sunk ? `💥 ¡Barco hundido! (${lastAttack.row + 1},${lastAttack.col + 1})` : `🎯 ¡Impacto! (${lastAttack.row + 1},${lastAttack.col + 1})`)
            : `💧 Agua en (${lastAttack.row + 1},${lastAttack.col + 1})`}
        </div>
      )}

      {/* Ships counter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ flex: 1, textAlign: 'center', fontSize: 13 }}>
          <div style={{ color: '#64748b' }}>Mis barcos</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: myShipsLeft > 0 ? '#22c55e' : '#dc2626' }}>{myShipsLeft}</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center', fontSize: 13 }}>
          <div style={{ color: '#64748b' }}>Barcos rival</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: oppShipsLeft > 0 ? '#f59e0b' : '#dc2626' }}>{oppShipsLeft}</div>
        </div>
      </div>

      {/* Attack grid (opponent) */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
          Atacar — Equipo <span className={`tag tag-${oppTeamId}`}>{oppTeamId}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <Grid
            grid={oppGrid}
            votedCell={myVote}
            onCellClick={handleVote}
            disabled={!isMyTurn || !voteActive}
          />
        </div>
      </div>

      {/* Defense grid (own) */}
      <div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
          Tu flota — Equipo <span className={`tag tag-${myTeamId}`}>{myTeamId}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <Grid grid={myGrid} disabled />
        </div>
      </div>
    </div>
  );
}

/* ── Ended ── */
function EndedView({ winner, myTeam }: { winner: TeamId; myTeam: TeamId }) {
  const won = winner === myTeam;
  return (
    <div className="card slide-in" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 64 }}>{won ? '🏆' : '💀'}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 12 }}>
        {won ? '¡Victoria!' : 'Derrota'}
      </div>
      <div style={{ color: '#64748b', marginTop: 8 }}>
        {won ? '¡Tu equipo hundió toda la flota rival!' : 'El equipo rival hundió tu flota.'}
      </div>
      <div style={{ marginTop: 16, color: '#475569', fontSize: 13 }}>Espera que el host reinicie para jugar de nuevo.</div>
    </div>
  );
}
