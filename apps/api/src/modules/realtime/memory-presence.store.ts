import { Injectable } from "@nestjs/common";
import type { PresenceStore } from "./realtime-state.types";

@Injectable()
export class MemoryPresenceStore implements PresenceStore {
  private readonly socketsByUser = new Map<string, Set<string>>();

  async connect(userId: string, socketId: string) {
    const sockets = this.socketsByUser.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.socketsByUser.set(userId, sockets);
  }

  async disconnect(userId: string, socketId: string) {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets) {
      return;
    }

    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.socketsByUser.delete(userId);
    }
  }

  async getOnlineUserIds(userIds: string[]) {
    return new Set(userIds.filter((userId) => (this.socketsByUser.get(userId)?.size ?? 0) > 0));
  }
}
