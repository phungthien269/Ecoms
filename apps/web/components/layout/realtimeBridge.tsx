"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

export function RealtimeBridge({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}`.replace(
      /\/api$/,
      "/realtime"
    ), {
      transports: ["websocket"],
      auth: {
        token
      }
    });

    const refresh = () => {
      router.refresh();
    };

    socket.on("notification.created", refresh);
    socket.on("notification.read", refresh);
    socket.on("notification.read-all", refresh);
    socket.on("notification.unread-count", refresh);
    socket.on("chat.message", refresh);
    socket.on("chat.unread-count", refresh);
    socket.on("presence.changed", refresh);

    return () => {
      socket.off("notification.created", refresh);
      socket.off("notification.read", refresh);
      socket.off("notification.read-all", refresh);
      socket.off("notification.unread-count", refresh);
      socket.off("chat.message", refresh);
      socket.off("chat.unread-count", refresh);
      socket.off("presence.changed", refresh);
      socket.disconnect();
    };
  }, [router, token]);

  return null;
}
