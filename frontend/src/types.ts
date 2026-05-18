export type TeamId = 'A' | 'B';
export type CellState = 'empty' | 'ship' | 'hit' | 'miss';
export type GamePhase = 'waiting' | 'placing' | 'battle' | 'ended';

export interface PlayerInfo {
  name: string;
  team: TeamId;
  isCaptain: boolean;
  isMe: boolean;
}

export interface TeamPublicState {
  placingDone: boolean;
  grid: CellState[][];
  shipsRemaining: number;
  totalShips: number;
}

export interface GameState {
  code: string;
  phase: GamePhase;
  currentTurn: TeamId;
  winner: TeamId | null;
  players: PlayerInfo[];
  teams: { A: TeamPublicState; B: TeamPublicState };
  voteActive: boolean;
  secondsLeft: number;
}

export interface AttackResult {
  row: number;
  col: number;
  hit: boolean;
  sunk: boolean;
  winner?: TeamId;
}

export const SHIP_SIZES = [4, 3, 3, 2];
export const GRID_SIZE = 8;
export const TEAM_COLORS: Record<TeamId, { bg: string; text: string; light: string }> = {
  A: { bg: '#1d4ed8', text: '#fff', light: '#dbeafe' },
  B: { bg: '#dc2626', text: '#fff', light: '#fee2e2' },
};
