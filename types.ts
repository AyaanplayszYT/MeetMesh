

export interface PeerSignal {
  userId: string;
  signal: RTCSessionDescriptionInit;
}

export interface PeerCandidate {
  userId: string;
  candidate: RTCIceCandidateInit;
}

export interface User {
  id: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface Reaction {
  senderId: string;
  emoji: string;
  timestamp: number;
}

export interface RoomInfo {
  roomId: string;
  name?: string;
  count: number;
  isPublic: boolean;
  isLocked?: boolean;
  waitingRoom?: boolean;
}

export interface RoomSettings {
  isLocked: boolean;
  waitingRoom: boolean;
  hostId?: string;
}

export interface WaitingUser {
  odId: string;
  userName: string;
}

export interface ConnectionStats {
  rtt: number;              // Round Trip Time in ms
  jitter: number;           // Jitter in ms
  packetLossPercentage: number; // Real-time packet loss %
  packetsLost: number;      // Cumulative packets lost
  resolution?: string;      // Video resolution (e.g., 1920x1080)
  frameRate?: number;       // Frames per second
}

export interface DrawLine {
  prevX: number;
  prevY: number;
  currX: number;
  currY: number;
  color: string;
  width: number;
}

export interface Caption {
  senderId: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

// Events that the client listens to from the server
export interface ServerToClientEvents {
  'user-connected': (userId: string) => void;
  'user-disconnected': (userId: string) => void;
  'offer': (payload: { callerId: string; userName: string; isScreenShare: boolean; offer: RTCSessionDescriptionInit }) => void;
  'answer': (payload: { callerId: string; userName: string; isScreenShare: boolean; answer: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (payload: { callerId: string; candidate: RTCIceCandidateInit }) => void;
  'chat-message': (message: ChatMessage) => void;
  'reaction': (reaction: Reaction) => void;
  'room-full': () => void;
  'rooms-update': (rooms: RoomInfo[]) => void;
  'whiteboard-draw': (data: DrawLine) => void;
  'whiteboard-clear': () => void;
  'caption': (caption: Caption) => void;
  // Waiting room & lock events
  'room-joined': (payload: { roomId: string; isHost: boolean; settings: RoomSettings }) => void;
  'room-locked': (payload: { roomId: string }) => void;
  'waiting-room': (payload: { roomId: string; position: number }) => void;
  'waiting-room-update': (payload: { roomId: string; waitingUsers: WaitingUser[] }) => void;
  'admitted': (payload: { roomId: string; isHost: boolean; settings: RoomSettings }) => void;
  'denied': (payload: { roomId: string }) => void;
  'room-settings-update': (settings: RoomSettings) => void;
  'host-changed': (payload: { isHost: boolean }) => void;
  'room-closed': (payload: { roomId: string }) => void;
}

// Events that the client sends to the server
export interface ClientToServerEvents {
  'join-room': (roomId: string, userId: string, config?: { isPublic: boolean; name: string; waitingRoom?: boolean }, userName?: string) => void;
  'leave-room': (payload: { roomId: string; userId: string }) => void;
  'offer': (payload: { targetUserId: string; userName: string; isScreenShare: boolean; offer: RTCSessionDescriptionInit }) => void;
  'answer': (payload: { targetUserId: string; userName: string; isScreenShare: boolean; answer: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (payload: { targetUserId: string; candidate: RTCIceCandidateInit }) => void;
  'chat-message': (payload: { roomId: string; message: ChatMessage }) => void;
  'reaction': (payload: { roomId: string; reaction: Reaction }) => void;
  'get-rooms': () => void;
  'ping': (callback: () => void) => void;
  'whiteboard-draw': (payload: { roomId: string; data: DrawLine }) => void;
  'whiteboard-clear': (payload: { roomId: string }) => void;
  'caption': (payload: { roomId: string; caption: Caption }) => void;
  // Host controls
  'admit-user': (payload: { roomId: string; odId: string }) => void;
  'deny-user': (payload: { roomId: string; odId: string }) => void;
  'toggle-lock': (payload: { roomId: string }) => void;
  'toggle-waiting-room': (payload: { roomId: string }) => void;
}