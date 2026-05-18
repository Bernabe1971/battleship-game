export type TeamId = 'A' | 'B';
export type CellState = 'empty' | 'ship' | 'hit' | 'miss';
export type GamePhase = 'waiting' | 'placing' | 'battle' | 'ended';
export declare const GRID_SIZE = 8;
export declare const SHIP_SIZES: number[];
export interface Ship {
    id: string;
    cells: [number, number][];
    hits: number;
}
export interface TeamState {
    grid: CellState[][];
    ships: Ship[];
    placingDone: boolean;
}
export interface Player {
    socketId: string;
    name: string;
    team: TeamId;
    isCaptain: boolean;
}
export interface ActiveVote {
    votes: Map<string, [number, number]>;
    secondsLeft: number;
}
export interface GameRoom {
    code: string;
    hostSocketId: string;
    players: Map<string, Player>;
    teams: {
        A: TeamState;
        B: TeamState;
    };
    phase: GamePhase;
    currentTurn: TeamId;
    vote: ActiveVote | null;
    winner: TeamId | null;
}
export interface AttackResult {
    row: number;
    col: number;
    hit: boolean;
    sunk: boolean;
    shipId?: string;
    winner?: TeamId;
}
