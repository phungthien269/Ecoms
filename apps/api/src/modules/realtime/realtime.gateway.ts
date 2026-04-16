import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";

@WebSocketGateway({
  namespace: "realtime",
  cors: true
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly authService: AuthService) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.authService.verifyAccessToken(token);
      client.data.userId = payload.sub;
      client.join(this.getUserRoom(payload.sub));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      client.leave(this.getUserRoom(userId));
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(this.getUserRoom(userId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    for (const userId of new Set(userIds)) {
      this.emitToUser(userId, event, payload);
    }
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.length > 0) {
      return authToken;
    }

    const queryToken = client.handshake.query?.token;
    return typeof queryToken === "string" && queryToken.length > 0 ? queryToken : undefined;
  }

  private getUserRoom(userId: string) {
    return `user:${userId}`;
  }
}
