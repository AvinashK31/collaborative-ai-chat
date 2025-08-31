import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebSocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  broadcastToConversation(conversationId: string, event: string, data: unknown) {
    if (this.server) {
      console.log(`📡 WebSocketService: Broadcasting ${event} to conversation ${conversationId}`);
      console.log(`📡 WebSocketService: Data being sent:`, JSON.stringify(data, null, 2));
      console.log(`📡 WebSocketService: Room size:`, this.getClientCount(conversationId));
      
      // Get all sockets in the room
      const room = this.server.sockets.adapter.rooms.get(conversationId);
      if (room) {
        console.log(`📡 WebSocketService: Sockets in room ${conversationId}:`, Array.from(room));
      } else {
        console.log(`📡 WebSocketService: No sockets found in room ${conversationId}`);
      }
      
      this.server.to(conversationId).emit(event, data);
      console.log(`📡 WebSocketService: Event ${event} emitted to room ${conversationId}`);
    } else {
      console.warn('📡 WebSocketService: Server not initialized');
    }
  }

  getClientCount(conversationId: string): number {
    if (this.server) {
      const room = this.server.sockets.adapter.rooms.get(conversationId);
      return room ? room.size : 0;
    }
    return 0;
  }
}
