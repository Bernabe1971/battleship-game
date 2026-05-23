import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway({ cors: { origin: '*' }, pingInterval: 10000, pingTimeout: 5000 })

export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly game: GameService) {}

  @SubscribeMessage('host-game')
  handleHostGame(@ConnectedSocket() client: Socket) {
    const { code, hostToken } = this.game.createRoom(client.id);
    client.join(code);
    client.emit('room-created', { code, hostToken });
    this.broadcastState(code);
  }

  @SubscribeMessage('reclaim-host')
  handleReclaimHost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; hostToken: string },
  ) {
    const ok = this.game.reclaimHost(data.roomCode, data.hostToken, client.id);
    if (!ok) {
      client.emit('error', { message: 'No se pudo recuperar la sesión de host.' });
      return;
    }
    client.join(data.roomCode);
    client.emit('host-reclaimed', { code: data.roomCode });
    this.broadcastState(data.roomCode);
  }

  @SubscribeMessage('join-game')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerName: string; team: 'A' | 'B' },
  ) {
    const player = this.game.joinRoom(data.roomCode, client.id, data.playerName, data.team);
    if (!player) {
      client.emit('error', { message: 'No se pudo unir. Verifica el código o el juego ya comenzó.' });
      return;
    }
    client.join(data.roomCode);
    this.broadcastState(data.roomCode);
  }

  @SubscribeMessage('start-game')
  handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string },
  ) {
    const room = this.game.getRoom(data.roomCode);
    if (!room || room.hostSocketId !== client.id) {
      client.emit('error', { message: 'Solo el host puede iniciar el juego.' });
      return;
    }
    const ok = this.game.startGame(data.roomCode);
    if (!ok) {
      client.emit('error', { message: 'Cada equipo necesita al menos un jugador.' });
      return;
    }
    this.broadcastState(data.roomCode);
  }

  @SubscribeMessage('place-ships')
  handlePlaceShips(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; ships: { cells: [number, number][] }[] },
  ) {
    const err = this.game.placeShips(data.roomCode, client.id, data.ships);
    if (err) {
      client.emit('error', { message: err });
      return;
    }
    this.broadcastState(data.roomCode);

    const room = this.game.getRoom(data.roomCode);
    if (room?.phase === 'battle') {
      setTimeout(() => this.startVotingRound(data.roomCode), 1000);
    }
  }

  @SubscribeMessage('vote-attack')
  handleVoteAttack(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; row: number; col: number },
  ) {
    this.game.recordVote(data.roomCode, client.id, data.row, data.col);
    this.broadcastState(data.roomCode);
  }

  @SubscribeMessage('restart-game')
  handleRestartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string },
  ) {
    const room = this.game.getRoom(data.roomCode);
    if (!room || room.hostSocketId !== client.id) return;
    this.clearTimer(data.roomCode);
    this.game.resetRoom(data.roomCode);
    this.broadcastState(data.roomCode);
  }

  handleDisconnect(client: Socket) {
    const code = this.game.removePlayer(client.id);
    if (code) this.broadcastState(code);
  }

  private startVotingRound(code: string) {
    const room = this.game.getRoom(code);
    if (!room || room.phase !== 'battle') return;

    const started = this.game.startVote(code);
    if (!started) return;

    this.broadcastState(code);

    let seconds = 12;
    const timer = setInterval(() => {
      const r = this.game.getRoom(code);
      if (!r || r.phase !== 'battle' || !r.vote) {
        clearInterval(timer);
        this.timers.delete(code);
        return;
      }

      seconds--;
      r.vote.secondsLeft = seconds;
      this.server.to(code).emit('timer-tick', { seconds });

      if (seconds <= 0) {
        clearInterval(timer);
        this.timers.delete(code);
        this.resolveVote(code);
      }
    }, 1000);

    this.timers.set(code, timer);
  }

  private resolveVote(code: string) {
    const result = this.game.resolveAttack(code);
    if (!result) return;

    this.server.to(code).emit('attack-resolved', result);
    this.broadcastState(code);

    if (!result.winner) {
      setTimeout(() => this.startVotingRound(code), 2500);
    }
  }

  private clearTimer(code: string) {
    const t = this.timers.get(code);
    if (t) { clearInterval(t); this.timers.delete(code); }
  }

  private broadcastState(code: string) {
    const room = this.game.getRoom(code);
    if (!room) return;

    for (const [socketId] of room.players) {
      const state = this.game.getPublicState(code, socketId);
      this.server.to(socketId).emit('game-state', state);
    }
    const hostState = this.game.getPublicState(code);
    this.server.to(room.hostSocketId).emit('game-state', hostState);
  }
}
