import { useEffect, useState } from 'react';
import { socket } from './socket';
import { GameState, TeamId, AttackResult } from './types';
import { LandingPage } from './components/LandingPage';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';

type Role = 'none' | 'host' | 'player';

export default function App() {
  const [role, setRole] = useState<Role>('none');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [playerTeam, setPlayerTeam] = useState<TeamId>(() => (localStorage.getItem('playerTeam') as TeamId) || 'A');
  const [lastAttack, setLastAttack] = useState<AttackResult | null>(null);
  const [seconds, setSeconds] = useState(20);
  const [error, setError] = useState('');

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      const token = localStorage.getItem('hostToken');
      const savedCode = localStorage.getItem('hostRoomCode');
      if (token && savedCode) {
        socket.emit('reclaim-host', { roomCode: savedCode, hostToken: token });
        return;
      }
      const pToken = localStorage.getItem('playerToken');
      const pCode = localStorage.getItem('playerRoomCode');
      if (pToken && pCode) {
        socket.emit('reclaim-player', { roomCode: pCode, playerToken: pToken });
      }
    });

    socket.on('room-created', ({ code, hostToken }: { code: string; hostToken: string }) => {
      localStorage.setItem('hostToken', hostToken);
      localStorage.setItem('hostRoomCode', code);
      setRoomCode(code);
      setRole('host');
    });

    socket.on('host-reclaimed', ({ code }: { code: string }) => {
      setRoomCode(code);
      setRole('host');
    });

    socket.on('player-joined', ({ token, code, team, name }: { token: string; code: string; team: TeamId; name: string }) => {
      localStorage.setItem('playerToken', token);
      localStorage.setItem('playerRoomCode', code);
      if (name) localStorage.setItem('playerName', name);
      if (team) localStorage.setItem('playerTeam', team);
      setRoomCode(code);
      setRole('player');
    });

    socket.on('player-reclaimed', ({ code, team, name }: { code: string; team: TeamId; name: string }) => {
      setRoomCode(code);
      if (name) setPlayerName(name);
      if (team) setPlayerTeam(team);
      setRole('player');
    });

    socket.on('reclaim-failed', ({ message }: { message: string }) => {
      localStorage.removeItem('playerToken');
      localStorage.removeItem('playerRoomCode');
      setRole('none');
      setError(message || 'Tu sesión expiró. Vuelve a unirte.');
    });

    socket.on('game-state', (state: GameState) => {
      setGameState(state);
      setSeconds(state.secondsLeft);
      setError('');
    });

    socket.on('attack-resolved', (result: AttackResult) => {
      setLastAttack(result);
      // Clear after a few seconds
      setTimeout(() => setLastAttack(null), 4000);
    });

    socket.on('timer-tick', ({ seconds: s }: { seconds: number }) => {
      setSeconds(s);
    });

    socket.on('error', ({ message }: { message: string }) => {
      setError(message);
      if (role === 'player') setRole('none');
    });

    return () => { socket.disconnect(); };
  }, []);

  // Mantiene la pantalla del teléfono despierta mientras el usuario es jugador,
  // para que no se bloquee sola durante la partida y pierda la conexión.
  useEffect(() => {
    if (role !== 'player') return;
    let wakeLock: any = null;
    let cancelled = false;
    async function requestLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Si el navegador no lo permite, se ignora sin romper nada.
      }
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible' && !cancelled) requestLock();
    }
    requestLock();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock) { try { wakeLock.release(); } catch {} }
    };
  }, [role]);

  function handleHost() {
    localStorage.removeItem('hostToken');
    localStorage.removeItem('hostRoomCode');
    localStorage.removeItem('playerToken');
    localStorage.removeItem('playerRoomCode');
    setError('');
    socket.emit('host-game');
  }

  function handleJoin(code: string, name: string, team: TeamId) {
    setPlayerName(name);
    setPlayerTeam(team);
    setError('');
    setRole('player');
    socket.emit('join-game', { roomCode: code, playerName: name, team });
  }

  function handleStart() {
    socket.emit('start-game', { roomCode });
  }

  function handleRestart() {
    socket.emit('restart-game', { roomCode });
  }

  function handlePlaceShips(ships: { cells: [number, number][] }[]) {
    socket.emit('place-ships', { roomCode: gameState?.code ?? roomCode, ships });
  }

  function handleVote(row: number, col: number) {
    socket.emit('vote-attack', { roomCode: gameState?.code ?? roomCode, row, col });
  }

  if (role === 'none') {
    return <LandingPage onHost={handleHost} onJoin={handleJoin} error={error} />;
  }

  if (role === 'host') {
    return (
      <HostView
        gameState={gameState}
        roomCode={roomCode}
        onStart={handleStart}
        onRestart={handleRestart}
      />
    );
  }

  if (!gameState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="pulse" style={{ color: '#64748b', fontSize: 16 }}>Conectando a la sala...</div>
      </div>
    );
  }

  return (
    <PlayerView
      gameState={gameState}
      playerName={playerName}
      playerTeam={playerTeam}
      onPlaceShips={handlePlaceShips}
      onVote={handleVote}
      seconds={seconds}
      lastAttack={lastAttack}
    />
  );
}
