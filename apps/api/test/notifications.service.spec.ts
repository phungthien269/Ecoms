import { NotificationsService } from "../src/modules/notifications/notifications.service";

describe("NotificationsService", () => {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    }
  };
  const realtimeGateway = {
    emitToUser: jest.fn()
  };

  const service = new NotificationsService(prisma as never, realtimeGateway as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates and emits a notification", async () => {
    prisma.notification.create.mockResolvedValue({
      id: "notification-1",
      category: "CHAT",
      title: "New message",
      body: "Hello",
      linkUrl: "/chat/1",
      isRead: false,
      createdAt: new Date("2026-04-17T00:00:00.000Z")
    });

    const notification = await service.create({
      userId: "user-1",
      category: "CHAT" as never,
      title: "New message",
      body: "Hello",
      linkUrl: "/chat/1"
    });

    expect(notification.id).toBe("notification-1");
    expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
      "user-1",
      "notification.created",
      expect.objectContaining({ id: "notification-1" })
    );
  });
});
