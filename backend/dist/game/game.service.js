"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const common_1 = require("@nestjs/common");
const game_types_1 = require("./game.types");
const uuid_1 = require("uuid");
function emptyGrid() {
    return Array.from({ length: game_types_1.GRID_SIZE }, () => Array(game_types_1.GRID_SIZE).fill('empty'));
}
function emptyTeam() {
    return { grid: emptyGrid(), ships: [], placingDone: false };
}
function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
let GameService = class GameService {
    constructor() {
        this.rooms = new Map();
    }
    createRoom(hostSocketId) {
        let code;
        do {
            code = randomCode();
        } while (this.rooms.has(code));
        this.rooms.set(code, {
            code,
            hostSocketId,
            players: new Map(),
            teams: { A: emptyTeam(), B: emptyTeam() },
            phase: 'waiting',
            currentTurn: 'A',
            vote: null,
            winner: null,
        });
        return code;
    }
    getRoom(code) {
        return this.rooms.get(code);
    }
    findRoomBySocket(socketId) {
        for (const room of this.rooms.values()) {
            if (room.hostSocketId === socketId || room.players.has(socketId))
                return room;
        }
    }
    joinRoom(code, socketId, name, team) {
        const room = this.rooms.get(code);
        if (!room || room.phase !== 'waiting')
            return null;
        const teamPlayers = [...room.players.values()].filter(p => p.team === team);
        const isCaptain = teamPlayers.length === 0;
        const player = { socketId, name, team, isCaptain };
        room.players.set(socketId, player);
        return player;
    }
    removePlayer(socketId) {
        for (const [code, room] of this.rooms) {
            if (room.players.has(socketId)) {
                const leavingPlayer = room.players.get(socketId);
                room.players.delete(socketId);
                if (leavingPlayer.isCaptain) {
                    const nextInTeam = [...room.players.values()].find(p => p.team === leavingPlayer.team);
                    if (nextInTeam)
                        nextInTeam.isCaptain = true;
                }
                return code;
            }
            if (room.hostSocketId === socketId) {
                return code;
            }
        }
        return null;
    }
    startGame(code) {
        const room = this.rooms.get(code);
        if (!room || room.phase !== 'waiting')
            return false;
        const hasA = [...room.players.values()].some(p => p.team === 'A');
        const hasB = [...room.players.values()].some(p => p.team === 'B');
        if (!hasA || !hasB)
            return false;
        room.phase = 'placing';
        return true;
    }
    placeShips(code, socketId, ships) {
        const room = this.rooms.get(code);
        if (!room || room.phase !== 'placing')
            return 'Fase incorrecta';
        const player = room.players.get(socketId);
        if (!player || !player.isCaptain)
            return 'Solo el capitán puede colocar barcos';
        const teamState = room.teams[player.team];
        if (teamState.placingDone)
            return 'Ya colocaste los barcos';
        if (ships.length !== game_types_1.SHIP_SIZES.length)
            return `Se requieren ${game_types_1.SHIP_SIZES.length} barcos`;
        const newGrid = emptyGrid();
        const newShips = [];
        for (let i = 0; i < ships.length; i++) {
            const ship = ships[i];
            if (ship.cells.length !== game_types_1.SHIP_SIZES[i])
                return `Barco ${i + 1} debe tener ${game_types_1.SHIP_SIZES[i]} celdas`;
            for (const [r, c] of ship.cells) {
                if (r < 0 || r >= game_types_1.GRID_SIZE || c < 0 || c >= game_types_1.GRID_SIZE)
                    return 'Barco fuera del tablero';
                if (newGrid[r][c] !== 'empty')
                    return 'Los barcos se superponen';
                newGrid[r][c] = 'ship';
            }
            newShips.push({ id: (0, uuid_1.v4)(), cells: ship.cells, hits: 0 });
        }
        teamState.grid = newGrid;
        teamState.ships = newShips;
        teamState.placingDone = true;
        if (room.teams.A.placingDone && room.teams.B.placingDone) {
            room.phase = 'battle';
            room.currentTurn = 'A';
        }
        return null;
    }
    startVote(code) {
        const room = this.rooms.get(code);
        if (!room || room.phase !== 'battle' || room.vote)
            return false;
        room.vote = { votes: new Map(), secondsLeft: 20 };
        return true;
    }
    recordVote(code, socketId, row, col) {
        const room = this.rooms.get(code);
        if (!room || room.phase !== 'battle' || !room.vote)
            return false;
        const player = room.players.get(socketId);
        if (!player || player.team !== room.currentTurn)
            return false;
        const defender = room.currentTurn === 'A' ? 'B' : 'A';
        const cell = room.teams[defender].grid[row][col];
        if (cell === 'hit' || cell === 'miss')
            return false;
        room.vote.votes.set(socketId, [row, col]);
        return true;
    }
    resolveAttack(code) {
        const room = this.rooms.get(code);
        if (!room || !room.vote)
            return null;
        const tally = new Map();
        for (const [, [r, c]] of room.vote.votes) {
            const key = `${r},${c}`;
            tally.set(key, (tally.get(key) ?? 0) + 1);
        }
        let target;
        if (tally.size === 0) {
            target = [Math.floor(Math.random() * game_types_1.GRID_SIZE), Math.floor(Math.random() * game_types_1.GRID_SIZE)];
        }
        else {
            const maxVotes = Math.max(...tally.values());
            const tied = [...tally.entries()].filter(([, v]) => v === maxVotes).map(([k]) => k);
            const chosen = tied[Math.floor(Math.random() * tied.length)];
            const [r, c] = chosen.split(',').map(Number);
            target = [r, c];
        }
        const [row, col] = target;
        const defender = room.currentTurn === 'A' ? 'B' : 'A';
        const defTeam = room.teams[defender];
        const cell = defTeam.grid[row][col];
        let hit = false;
        let sunk = false;
        let shipId;
        if (cell === 'ship') {
            hit = true;
            defTeam.grid[row][col] = 'hit';
            for (const ship of defTeam.ships) {
                if (ship.cells.some(([r, c]) => r === row && c === col)) {
                    ship.hits++;
                    shipId = ship.id;
                    sunk = ship.hits === ship.cells.length;
                    break;
                }
            }
        }
        else if (cell === 'empty') {
            defTeam.grid[row][col] = 'miss';
        }
        room.vote = null;
        const allSunk = defTeam.ships.every(s => s.hits === s.cells.length);
        if (allSunk) {
            room.winner = room.currentTurn;
            room.phase = 'ended';
            return { row, col, hit, sunk, shipId, winner: room.currentTurn };
        }
        room.currentTurn = defender;
        return { row, col, hit, sunk, shipId };
    }
    resetRoom(code) {
        const room = this.rooms.get(code);
        if (!room)
            return false;
        room.teams = { A: emptyTeam(), B: emptyTeam() };
        room.phase = 'waiting';
        room.currentTurn = 'A';
        room.vote = null;
        room.winner = null;
        for (const player of room.players.values()) {
            player.isCaptain = false;
        }
        const teamMap = { A: false, B: false };
        for (const player of room.players.values()) {
            if (!teamMap[player.team]) {
                player.isCaptain = true;
                teamMap[player.team] = true;
            }
        }
        return true;
    }
    getPublicState(code, requestingSocketId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const requester = requestingSocketId ? room.players.get(requestingSocketId) : undefined;
        return {
            code: room.code,
            phase: room.phase,
            currentTurn: room.currentTurn,
            winner: room.winner,
            players: [...room.players.values()].map(p => ({
                name: p.name,
                team: p.team,
                isCaptain: p.isCaptain,
                isMe: p.socketId === requestingSocketId,
            })),
            teams: {
                A: {
                    placingDone: room.teams.A.placingDone,
                    grid: this.visibleGrid(room.teams.A.grid, requester?.team === 'A'),
                    shipsRemaining: room.teams.A.ships.filter(s => s.hits < s.cells.length).length,
                    totalShips: room.teams.A.ships.length,
                },
                B: {
                    placingDone: room.teams.B.placingDone,
                    grid: this.visibleGrid(room.teams.B.grid, requester?.team === 'B'),
                    shipsRemaining: room.teams.B.ships.filter(s => s.hits < s.cells.length).length,
                    totalShips: room.teams.B.ships.length,
                },
            },
            voteActive: !!room.vote,
            secondsLeft: room.vote?.secondsLeft ?? 0,
        };
    }
    visibleGrid(grid, isOwner) {
        return grid.map(row => row.map(cell => {
            if (cell === 'hit' || cell === 'miss')
                return cell;
            return isOwner ? cell : 'empty';
        }));
    }
};
exports.GameService = GameService;
exports.GameService = GameService = __decorate([
    (0, common_1.Injectable)()
], GameService);
//# sourceMappingURL=game.service.js.map