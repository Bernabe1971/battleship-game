import { io } from 'socket.io-client';

const URL = window.location.origin;

export const socket = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  timeout: 10000,
});
