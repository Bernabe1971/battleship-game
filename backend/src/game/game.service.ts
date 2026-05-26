import { Injectable } from '@nestjs/common';
import {
  GameRoom, Player, TeamId, CellState, Ship, TeamState,
  GamePhase, AttackResult, GRID_SIZE, SHIP_SIZES,
} from './game.types';
import { v4 as uuid } from 'uuid';

function emptyGrid(): CellState[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('empty'));
}

function emptyTeam(): TeamState {
  return { grid: emptyGrid(), ships: [], placingDone: false };
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

@Injectable()
export class GameService {
  private rooms = new Map<string, GameRoom>();

  createRoom(hostSocketId: string): { code: string; hostToken: string } {
    let code: string;
    do { code = randomCode(); } while (this.rooms.has(code));

    const hostToken = uuid();
    this.rooms.set(code, {
      code,
      hostSocketId,
      hostToken,
      players: new Map(),
      teams: { A: emptyTeam(), B: emptyTeam() },
      phase: 'waiting',
      currentTurn: 'A',
      vote: null,
      winner: null,
    });
    return { code, hostToken };
  }

  reclaimHost(code: string, token: string, newSocketId: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.hostToken !== token) return false;
    room.hostSocketId = newSocketId;
    return true;
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  findRoomBySocket(socketId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId || room.players.has(socketId)) return room;
    }
  }

  joinRoom(code: string, socketId: string, name: string, team: TeamId): Player | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'waiting') return null;

    const teamPlayers = [...room.players.values()].filter(p => p.team === team);
    const isCaptain = teamPlayers.length === 0;

    const player: Player = { socketId, name, team, isCaptain };
    room.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId: string): string | null {
    for (const [code, room] of this.rooms) {
      if (room.players.has(socketId)) {
        const leavingPlayer = room.players.get(socketId)!;
        room.players.delete(socketId);

        // Reassign captain if needed
        if (leavingPlayer.isCaptain) {
          const nextInTeam = [...room.players.values()].find(p => p.team === leavingPlayer.team);
          if (nextInTeam) nextInTeam.isCaptain = true;
        }
        return code;
      }
      if (room.hostSocketId === socketId) {
        return code;
      }
    }
    return null;
  }

  startGame(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'waiting') return false;

    const hasA = [...room.players.values()].some(p => p.team === 'A');
    const hasB = [...room.players.values()].some(p => p.team === 'B');
    if (!hasA || !hasB) return false;

    room.phase = 'placing';
    return true;
  }

  placeShips(code: string, socketId: string, ships: { cells: [number, number][] }[]): string | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'placing') return 'Fase incorrecta';

    const player = room.players.get(socketId);
    if (!player || !player.isCaptain) return 'Solo el capitán puede colocar barcos';

    const teamState = room.teams[player.team];
    if (teamState.placingDone) return 'Ya colocaste los barcos';

    if (ships.length !== SHIP_SIZES.length) return `Se requieren ${SHIP_SIZES.length} barcos`;

    const newGrid = emptyGrid();
    const newShips: Ship[] = [];

    for (let i = 0; i < ships.length; i++) {
      const ship = ships[i];
      if (ship.cells.length !== SHIP_SIZES[i]) return `Barco ${i + 1} debe tener ${SHIP_SIZES[i]} celdas`;

      for (const [r, c] of ship.cells) {
        if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return 'Barco fuera del tablero';
        if (newGrid[r][c] !== 'empty') return 'Los barcos se superponen';
        newGrid[r][c] = 'ship';
      }
      newShips.push({ id: uuid(), cells: ship.cells, hits: 0 });
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

  startVote(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'battle' || room.vote) return false;
    room.vote = { votes: new Map(), secondsLeft: 10 };
    return true;
  }

  recordVote(code: string, socketId: string, row: number, col: number): boolean {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'battle' || !room.vote) return false;

    const player = room.players.get(socketId);
    if (!player || player.team !== room.currentTurn) return false;

    const defender: TeamId = room.currentTurn === 'A' ? 'B' : 'A';
    const cell = room.teams[defender].grid[row][col];
    if (cell === 'hit' || cell === 'miss') return false;

    room.vote.votes.set(socketId, [row, col]);
    return true;
  }

  resolveAttack(code: string): AttackResult | null {
    const room = this.rooms.get(code);
    if (!room || !room.vote) return null;

    // Tally votes
    const tally = new Map<string, number>();
    for (const [, [r, c]] of room.vote.votes) {
      const key = `${r},${c}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }

    // Pick winner cell (random among tied leaders)
    let target: [number, number];
    if (tally.size === 0) {
      // Random fallback
      target = [Math.floor(Math.random() * GRID_SIZE), Math.floor(Math.random() * GRID_SIZE)];
    } else {
      const maxVotes = Math.max(...tally.values());
      const tied = [...tally.entries()].filter(([, v]) => v === maxVotes).map(([k]) => k);
      const chosen = tied[Math.floor(Math.random() * tied.length)];
      const [r, c] = chosen.split(',').map(Number);
      target = [r, c];
    }

    const [row, col] = target;
    const defender: TeamId = room.currentTurn === 'A' ? 'B' : 'A';
    const defTeam = room.teams[defender];
    const cell = defTeam.grid[row][col];

    let hit = false;
    let sunk = false;
    let shipId: string | undefined;

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
    } else if (cell === 'empty') {
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

  resetRoom(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    room.teams = { A: emptyTeam(), B: emptyTeam() };
    room.phase = 'waiting';
    room.currentTurn = 'A';
    room.vote = null;
    room.winner = null;
    // Keep players but reset captain assignments
    for (const player of room.players.values()) {
      player.isCaptain = false;
    }
    const teamMap: Record<TeamId, boolean> = { A: false, B: false };
    for (const player of room.players.values()) {
      if (!teamMap[player.team]) {
        player.isCaptain = true;
        teamMap[player.team] = true;
      }
    }
    return true;
  }

  getPublicState(code: string, requestingSocketId?: string) {
    const room = this.rooms.get(code);
    if (!room) return null;

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

  private visibleGrid(grid: CellState[][], isOwner: boolean): CellState[][] {
    return grid.map(row =>
      row.map(cell => {
        if (cell === 'hit' || cell === 'miss') return cell;
        return isOwner ? cell : 'empty';
      }),
    );
  }
}
