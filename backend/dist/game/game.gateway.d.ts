import { OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
export declare class GameGateway implements OnGatewayDisconnect {
    private readonly game;
    server: Server;
    private timers;
    constructor(game: GameService);
    handleHostGame(client: Socket): void;
    handleJoinGame(client: Socket, data: {
        roomCode: string;
        playerName: string;
        team: 'A' | 'B';
    }): void;
    handleStartGame(client: Socket, data: {
        roomCode: string;
    }): void;
    handlePlaceShips(client: Socket, data: {
        roomCode: string;
        ships: {
            cells: [number, number][];
        }[];
    }): void;
    handleVoteAttack(client: Socket, data: {
        roomCode: string;
        row: number;
        col: number;
    }): void;
    handleRestartGame(client: Socket, data: {
        roomCode: string;
    }): void;
    handleDisconnect(client: Socket): void;
    private startVotingRound;
    private resolveVote;
    private clearTimer;
    private broadcastState;
}
