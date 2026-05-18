import { GameRoom, Player, TeamId, CellState, GamePhase, AttackResult } from './game.types';
export declare class GameService {
    private rooms;
    createRoom(hostSocketId: string): string;
    getRoom(code: string): GameRoom | undefined;
    findRoomBySocket(socketId: string): GameRoom | undefined;
    joinRoom(code: string, socketId: string, name: string, team: TeamId): Player | null;
    removePlayer(socketId: string): string | null;
    startGame(code: string): boolean;
    placeShips(code: string, socketId: string, ships: {
        cells: [number, number][];
    }[]): string | null;
    startVote(code: string): boolean;
    recordVote(code: string, socketId: string, row: number, col: number): boolean;
    resolveAttack(code: string): AttackResult | null;
    resetRoom(code: string): boolean;
    getPublicState(code: string, requestingSocketId?: string): {
        code: string;
        phase: GamePhase;
        currentTurn: TeamId;
        winner: TeamId;
        players: {
            name: string;
            team: TeamId;
            isCaptain: boolean;
            isMe: boolean;
        }[];
        teams: {
            A: {
                placingDone: boolean;
                grid: CellState[][];
                shipsRemaining: number;
                totalShips: number;
            };
            B: {
                placingDone: boolean;
                grid: CellState[][];
                shipsRemaining: number;
                totalShips: number;
            };
        };
        voteActive: boolean;
        secondsLeft: number;
    };
    private visibleGrid;
}
