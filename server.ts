import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Room metadata
interface RoomMeta {
  isPublic: boolean;
  name?: string;
  hostId?: string;        // The user who created the room
  isLocked: boolean;      // Whether the room is locked
  waitingRoom: boolean;   // Whether waiting room is enabled
}

// Waiting room user info
interface WaitingUser {
  odId: string;
  socketId: string;
  userName: string;
}

// Store users in memory: RoomID -> Set<UserId>
const rooms = new Map<string, Set<string>>();
const roomMetadata = new Map<string, RoomMeta>();
const waitingRooms = new Map<string, Map<string, WaitingUser>>(); // roomId -> Map<odId, WaitingUser>

// Map socket ID to User ID for cleanup
const socketToUser = new Map<string, string>();
const userToRoom = new Map<string, string>();
const userNames = new Map<string, string>(); // odId -> userName

const getPublicRooms = () => {
  const publicRooms = [];
  for (const [roomId, metadata] of roomMetadata.entries()) {
    if (metadata.isPublic) {
      const count = rooms.get(roomId)?.size || 0;
      if (count > 0) {
        publicRooms.push({
          roomId,
          name: metadata.name,
          count,
          isPublic: true,
          isLocked: metadata.isLocked,
          waitingRoom: metadata.waitingRoom
        });
      }
    }
  }
  return publicRooms;
};

const broadcastPublicRooms = () => {
  const publicRooms = getPublicRooms();
  console.log(`Broadcasting ${publicRooms.length} public rooms to all clients`);
  io.emit('rooms-update', publicRooms);
};

// Helper to get room settings for a user
const getRoomSettings = (roomId: string) => {
  const meta = roomMetadata.get(roomId);
  return {
    isLocked: meta?.isLocked || false,
    waitingRoom: meta?.waitingRoom || false,
    hostId: meta?.hostId
  };
};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Send initial room list only to the requester
  socket.on('get-rooms', () => {
    socket.emit('rooms-update', getPublicRooms());
  });

  socket.on('ping', (callback) => {
    if (typeof callback === 'function') callback();
  });

  // Request to join room (may go to waiting room)
  socket.on('join-room', (roomId: string, odId: string, config?: { isPublic: boolean; name: string; waitingRoom?: boolean }, userName?: string) => {
    // Store user name
    if (userName) {
      userNames.set(odId, userName);
    }
    
    const existingMeta = roomMetadata.get(roomId);
    const isNewRoom = !existingMeta;
    
    // Check if room is locked
    if (existingMeta?.isLocked) {
      socket.emit('room-locked', { roomId });
      console.log(`User ${odId} blocked - room ${roomId} is locked`);
      return;
    }
    
    // Check if waiting room is enabled and user is not the host
    if (existingMeta?.waitingRoom && existingMeta.hostId !== odId) {
      // Add to waiting room
      if (!waitingRooms.has(roomId)) {
        waitingRooms.set(roomId, new Map());
      }
      
      const waiting = waitingRooms.get(roomId)!;
      waiting.set(odId, { odId, socketId: socket.id, userName: userName || odId });
      
      // Store mappings for cleanup
      socketToUser.set(socket.id, odId);
      
      // Notify user they're in waiting room
      socket.emit('waiting-room', { roomId, position: waiting.size });
      
      // Notify host about new waiting user
      const hostSocketId = Array.from(socketToUser.entries())
        .find(([_, odId]) => odId === existingMeta.hostId)?.[0];
      
      if (hostSocketId) {
        io.to(hostSocketId).emit('waiting-room-update', {
          roomId,
          waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
        });
      }
      
      console.log(`User ${odId} added to waiting room for ${roomId}`);
      return;
    }
    
    // Direct join (no waiting room or is host)
    socket.join(roomId);
    
    // Track user
    socketToUser.set(socket.id, odId);
    userToRoom.set(odId, roomId);

    // Initialize room if it doesn't exist
    if (isNewRoom) {
      rooms.set(roomId, new Set());
      roomMetadata.set(roomId, {
        isPublic: config?.isPublic || false,
        name: config?.name || `Room ${roomId}`,
        hostId: odId,  // First user is host
        isLocked: false,
        waitingRoom: config?.waitingRoom || false
      });
      waitingRooms.set(roomId, new Map());
      console.log(`Created new room: ${roomId}, Public: ${config?.isPublic}, WaitingRoom: ${config?.waitingRoom}`);
    }
    
    const roomUsers = rooms.get(roomId);
    
    if (roomUsers) {
      // Notify others in the room
      socket.to(roomId).emit('user-connected', odId);
      roomUsers.add(odId);
    }
    
    // Send room settings to user
    const meta = roomMetadata.get(roomId);
    socket.emit('room-joined', { 
      roomId, 
      isHost: meta?.hostId === odId,
      settings: getRoomSettings(roomId)
    });
    
    console.log(`User ${odId} joined room ${roomId} [${config?.isPublic ? 'Public' : 'Private'}]`);
    broadcastPublicRooms();
  });

  // Host admits user from waiting room
  socket.on('admit-user', (payload: { roomId: string; odId: string }) => {
    const { roomId, odId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);
    
    // Verify sender is host
    if (meta?.hostId !== hostUserId) {
      console.log(`Non-host ${hostUserId} tried to admit user`);
      return;
    }
    
    const waiting = waitingRooms.get(roomId);
    const waitingUser = waiting?.get(odId);
    
    if (waitingUser) {
      // Remove from waiting room
      waiting?.delete(odId);
      
      // Add to actual room
      const targetSocket = io.sockets.sockets.get(waitingUser.socketId);
      if (targetSocket) {
        targetSocket.join(roomId);
        userToRoom.set(odId, roomId);
        
        const roomUsers = rooms.get(roomId);
        if (roomUsers) {
          targetSocket.to(roomId).emit('user-connected', odId);
          roomUsers.add(odId);
        }
        
        // Notify admitted user
        targetSocket.emit('admitted', { 
          roomId,
          isHost: false,
          settings: getRoomSettings(roomId)
        });
        
        console.log(`User ${odId} admitted to room ${roomId}`);
      }
      
      // Update host's waiting list
      socket.emit('waiting-room-update', {
        roomId,
        waitingUsers: Array.from(waiting?.values() || []).map(u => ({ odId: u.odId, userName: u.userName }))
      });
      
      broadcastPublicRooms();
    }
  });

  // Host denies user from waiting room
  socket.on('deny-user', (payload: { roomId: string; odId: string }) => {
    const { roomId, odId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);
    
    // Verify sender is host
    if (meta?.hostId !== hostUserId) {
      return;
    }
    
    const waiting = waitingRooms.get(roomId);
    const waitingUser = waiting?.get(odId);
    
    if (waitingUser) {
      // Remove from waiting room
      waiting?.delete(odId);
      
      // Notify denied user
      const targetSocket = io.sockets.sockets.get(waitingUser.socketId);
      if (targetSocket) {
        targetSocket.emit('denied', { roomId });
        socketToUser.delete(waitingUser.socketId);
      }
      
      console.log(`User ${odId} denied from room ${roomId}`);
      
      // Update host's waiting list
      socket.emit('waiting-room-update', {
        roomId,
        waitingUsers: Array.from(waiting?.values() || []).map(u => ({ odId: u.odId, userName: u.userName }))
      });
    }
  });

  // Host toggles room lock
  socket.on('toggle-lock', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);
    
    // Verify sender is host
    if (meta?.hostId !== hostUserId) {
      return;
    }
    
    meta.isLocked = !meta.isLocked;
    console.log(`Room ${roomId} lock toggled: ${meta.isLocked}`);
    
    // Notify all users in room
    io.to(roomId).emit('room-settings-update', getRoomSettings(roomId));
    broadcastPublicRooms();
  });

  // Host toggles waiting room
  socket.on('toggle-waiting-room', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);
    
    // Verify sender is host
    if (meta?.hostId !== hostUserId) {
      return;
    }
    
    meta.waitingRoom = !meta.waitingRoom;
    console.log(`Room ${roomId} waiting room toggled: ${meta.waitingRoom}`);
    
    // Notify all users in room
    io.to(roomId).emit('room-settings-update', getRoomSettings(roomId));
    broadcastPublicRooms();
  });

  socket.on('offer', (payload) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (roomId) {
        socket.to(roomId).emit('offer', {
            callerId: socketToUser.get(socket.id),
            userName: payload.userName,
            isScreenShare: payload.isScreenShare,
            offer: payload.offer,
            targetUserId: payload.targetUserId
        });
    }
  });

  socket.on('answer', (payload) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (roomId) {
        socket.to(roomId).emit('answer', {
            callerId: socketToUser.get(socket.id),
            userName: payload.userName,
            isScreenShare: payload.isScreenShare,
            answer: payload.answer,
            targetUserId: payload.targetUserId
        });
    }
  });

  socket.on('ice-candidate', (payload) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (roomId) {
        socket.to(roomId).emit('ice-candidate', {
            callerId: socketToUser.get(socket.id),
            candidate: payload.candidate,
            targetUserId: payload.targetUserId
        });
    }
  });

  socket.on('chat-message', (payload) => {
    socket.to(payload.roomId).emit('chat-message', payload.message);
  });

  socket.on('reaction', (payload) => {
    socket.to(payload.roomId).emit('reaction', payload.reaction);
  });

  socket.on('caption', (payload) => {
    socket.to(payload.roomId).emit('caption', payload.caption);
  });

  // Whiteboard Events
  socket.on('whiteboard-draw', (payload) => {
    socket.to(payload.roomId).emit('whiteboard-draw', payload.data);
  });

  socket.on('whiteboard-clear', (payload) => {
    socket.to(payload.roomId).emit('whiteboard-clear');
  });

  // Handle explicit room leave (user clicks Leave button)
  socket.on('leave-room', (payload: { roomId: string; userId: string }) => {
    const { roomId, userId } = payload;
    console.log(`User ${userId} leaving room ${roomId}`);
    
    // Leave the socket.io room
    socket.leave(roomId);
    
    // Clean up user from room
    const roomUsers = rooms.get(roomId);
    const meta = roomMetadata.get(roomId);
    
    if (roomUsers) {
      roomUsers.delete(userId);
      
      // If host leaves, transfer host to next user or cleanup
      if (meta?.hostId === userId && roomUsers.size > 0) {
        const newHostId = roomUsers.values().next().value;
        meta.hostId = newHostId;
        
        // Notify new host
        const newHostSocketId = Array.from(socketToUser.entries())
          .find(([_, id]) => id === newHostId)?.[0];
        if (newHostSocketId) {
          io.to(newHostSocketId).emit('host-changed', { isHost: true });
          io.to(newHostSocketId).emit('room-settings-update', getRoomSettings(roomId));
          
          // Send waiting list to new host
          const waiting = waitingRooms.get(roomId);
          if (waiting && waiting.size > 0) {
            io.to(newHostSocketId).emit('waiting-room-update', {
              roomId,
              waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
            });
          }
        }
        console.log(`Host transferred to ${newHostId} in room ${roomId}`);
      }
      
      // Cleanup empty room
      if (roomUsers.size === 0) {
        rooms.delete(roomId);
        roomMetadata.delete(roomId);
        
        // Also clean waiting room and notify waiting users
        const waiting = waitingRooms.get(roomId);
        if (waiting) {
          for (const user of waiting.values()) {
            const ws = io.sockets.sockets.get(user.socketId);
            if (ws) {
              ws.emit('room-closed', { roomId });
              socketToUser.delete(user.socketId);
            }
          }
          waitingRooms.delete(roomId);
        }
        
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }
    
    // Notify others in the room
    socket.to(roomId).emit('user-disconnected', userId);
    
    // Clean up mappings
    userToRoom.delete(userId);
    userNames.delete(userId);
    
    // Broadcast updated room list
    broadcastPublicRooms();
  });

  socket.on('disconnect', () => {
    const odId = socketToUser.get(socket.id);
    if (odId) {
      const roomId = userToRoom.get(odId);
      
      // Check if user was in waiting room
      for (const [rid, waiting] of waitingRooms.entries()) {
        if (waiting.has(odId)) {
          waiting.delete(odId);
          
          // Notify host
          const meta = roomMetadata.get(rid);
          if (meta?.hostId) {
            const hostSocketId = Array.from(socketToUser.entries())
              .find(([_, id]) => id === meta.hostId)?.[0];
            if (hostSocketId) {
              io.to(hostSocketId).emit('waiting-room-update', {
                roomId: rid,
                waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
              });
            }
          }
          break;
        }
      }
      
      if (roomId) {
        const roomUsers = rooms.get(roomId);
        const meta = roomMetadata.get(roomId);
        
        roomUsers?.delete(odId);
        
        // If host disconnects, transfer host
        if (meta?.hostId === odId && roomUsers && roomUsers.size > 0) {
          const newHostId = roomUsers.values().next().value;
          meta.hostId = newHostId;
          
          const newHostSocketId = Array.from(socketToUser.entries())
            .find(([_, id]) => id === newHostId)?.[0];
          if (newHostSocketId) {
            io.to(newHostSocketId).emit('host-changed', { isHost: true });
            io.to(newHostSocketId).emit('room-settings-update', getRoomSettings(roomId));
            
            const waiting = waitingRooms.get(roomId);
            if (waiting && waiting.size > 0) {
              io.to(newHostSocketId).emit('waiting-room-update', {
                roomId,
                waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
              });
            }
          }
          console.log(`Host transferred to ${newHostId} in room ${roomId}`);
        }
        
        // Cleanup empty room
        if (roomUsers?.size === 0) {
          rooms.delete(roomId);
          roomMetadata.delete(roomId);
          
          const waiting = waitingRooms.get(roomId);
          if (waiting) {
            for (const user of waiting.values()) {
              const ws = io.sockets.sockets.get(user.socketId);
              if (ws) {
                ws.emit('room-closed', { roomId });
                socketToUser.delete(user.socketId);
              }
            }
            waitingRooms.delete(roomId);
          }
          
          console.log(`Room ${roomId} deleted (empty)`);
        }
        
        socket.to(roomId).emit('user-disconnected', odId);
        broadcastPublicRooms();
      }
      socketToUser.delete(socket.id);
      userToRoom.delete(odId);
      userNames.delete(odId);
      console.log(`User ${odId} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});