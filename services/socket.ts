import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../types';

// Dynamic URL detection to support LAN/Network access and production deployment
const getSocketUrl = (): string | undefined => {
  // Check for environment variable first (production deployment)
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl) {
    return envUrl;
  }

  if (typeof window === 'undefined') return 'http://localhost:3001';
  
  const { protocol, hostname, port } = window.location;
  
  // If HTTPS, we assume the backend is behind the same reverse proxy/origin
  if (protocol === 'https:') {
      return undefined;
  }
  
  // If served from the backend port (3001), use relative path
  if (port === '3001') {
    return undefined;
  }
  
  // For standard local dev (e.g. Vite on 3000), assume backend is on port 3001 of the same host
  return `${protocol}//${hostname}:3001`;
};

const SERVER_URL = getSocketUrl();

class SignalingService {
  public socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private myUserId: string = '';

  constructor() {
    try {
      this.socket = io(SERVER_URL, {
        transports: ['websocket'],
        autoConnect: false,
        reconnectionAttempts: Infinity,
        timeout: 10000,
      });
    } catch (e) {
      console.warn('Socket.io client failed to initialize.');
    }
  }

  public get connected(): boolean {
      return this.socket?.connected || false;
  }

  public connect(userId: string) {
    this.myUserId = userId;
    
    if (this.socket) {
        this.socket.auth = { userId };
        if (!this.socket.connected) {
            this.socket.connect();
        }
        
        // Remove existing listeners to prevent duplicates if called multiple times
        this.socket.off('connect');
        this.socket.off('connect_error');

        this.socket.on('connect', () => {
            console.log('Connected to Signaling Server');
        });

        this.socket.on('connect_error', (err) => {
            console.warn('Socket connection error:', err.message);
        });
    }
  }

  public async getLatency(): Promise<number> {
      const start = Date.now();
      return new Promise((resolve) => {
          if (!this.socket?.connected) {
              resolve(-1);
              return;
          }

          // Emit ping with ack
          this.socket.emit('ping', () => {
              resolve(Date.now() - start);
          });

          // Timeout fallback
          setTimeout(() => resolve(-1), 1000);
      });
  }

  public on<K extends keyof ServerToClientEvents>(event: string, callback: any) {
    if (this.socket) {
        this.socket.on(event as any, callback);
    }
  }

  public off(event: string, callback?: Function) {
    if (this.socket) {
        if (callback) {
            this.socket.off(event, callback as any);
        } else {
            this.socket.off(event);
        }
    }
  }

  public emit(event: string, ...args: any[]) {
      if (this.socket) {
          // CRITICAL FIX: Do not check this.socket.connected here.
          // Socket.IO client automatically buffers events emitted while disconnected
          // and sends them once the connection is established.
          // Blocking them here causes "ghost rooms" where the user joins locally
          // but the server never receives the join-room event.
          this.socket.emit(event, ...args);
      } else {
          console.warn(`Cannot emit '${event}': Socket not initialized.`);
      }
  }
}

export const signaling = new SignalingService();