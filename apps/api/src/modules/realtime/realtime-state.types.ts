export interface PresenceStore {
  connect(userId: string, socketId: string): Promise<void>;
  disconnect(userId: string, socketId: string): Promise<void>;
  getOnlineUserIds(userIds: string[]): Promise<Set<string>>;
}
