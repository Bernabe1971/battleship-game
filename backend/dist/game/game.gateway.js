"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const game_service_1 = require("./game.service");
let GameGateway = class GameGateway {
    constructor(game) {
        this.game = game;
        this.timers = new Map();
    }
    handleHostGame(client) {
        const code = this.game.createRoom(client.id);
        client.join(code);
        client.emit('room-created', { code });
    }
    handleJoinGame(client, data) {
        const player = this.game.joinRoom(data.roomCode, client.id, data.playerName, data.team);
        if (!player) {
            client.emit('error', { message: 'No se pudo unir. Verifica el código o el juego ya comenzó.' });
            return;
        }
        client.join(data.roomCode);
        this.broadcastState(data.roomCode);
    }
    handleStartGame(client, data) {
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
    handlePlaceShips(client, data) {
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
    handleVoteAttack(client, data) {
        this.game.recordVote(data.roomCode, client.id, data.row, data.col);
        this.broadcastState(data.roomCode);
    }
    handleRestartGame(client, data) {
        const room = this.game.getRoom(data.roomCode);
        if (!room || room.hostSocketId !== client.id)
            return;
        this.clearTimer(data.roomCode);
        this.game.resetRoom(data.roomCode);
        this.broadcastState(data.roomCode);
    }
    handleDisconnect(client) {
        const code = this.game.removePlayer(client.id);
        if (code)
            this.broadcastState(code);
    }
    startVotingRound(code) {
        const room = this.game.getRoom(code);
        if (!room || room.phase !== 'battle')
            return;
        const started = this.game.startVote(code);
        if (!started)
            return;
        this.broadcastState(code);
        let seconds = 20;
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
    resolveVote(code) {
        const result = this.game.resolveAttack(code);
        if (!result)
            return;
        this.server.to(code).emit('attack-resolved', result);
        this.broadcastState(code);
        if (!result.winner) {
            setTimeout(() => this.startVotingRound(code), 2500);
        }
    }
    clearTimer(code) {
        const t = this.timers.get(code);
        if (t) {
            clearInterval(t);
            this.timers.delete(code);
        }
    }
    broadcastState(code) {
        const room = this.game.getRoom(code);
        if (!room)
            return;
        for (const [socketId] of room.players) {
            const state = this.game.getPublicState(code, socketId);
            this.server.to(socketId).emit('game-state', state);
        }
        const hostState = this.game.getPublicState(code);
        this.server.to(room.hostSocketId).emit('game-state', hostState);
    }
};
exports.GameGateway = GameGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('host-game'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleHostGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join-game'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleJoinGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('start-game'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleStartGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('place-ships'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePlaceShips", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('vote-attack'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleVoteAttack", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('restart-game'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleRestartGame", null);
exports.GameGateway = GameGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [game_service_1.GameService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map