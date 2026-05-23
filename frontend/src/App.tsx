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
  const [playerName, setPlayerName] = useState('');
  const [playerTeam, setPlayerTeam] = useState<TeamId>('A');
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

  function handleHost() {
    localStorage.removeItem('hostToken');
    localStorage.removeItem('hostRoomCode');
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
