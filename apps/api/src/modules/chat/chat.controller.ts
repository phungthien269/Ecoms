import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RateLimit } from "../rateLimit/rate-limit.decorator";
import { RateLimitGuard } from "../rateLimit/rate-limit.guard";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { ChatService } from "./chat.service";

@Controller("chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("conversations")
  listConversations(@CurrentUser("sub") userId: string) {
    return this.chatService.listConversations(userId);
  }

  @Post("conversations")
  createConversation(
    @CurrentUser("sub") userId: string,
    @Body() payload: CreateConversationDto
  ) {
    return this.chatService.createConversation(userId, payload);
  }

  @Get("conversations/:conversationId/messages")
  listMessages(
    @CurrentUser("sub") userId: string,
    @Param("conversationId") conversationId: string
  ) {
    return this.chatService.listMessages(userId, conversationId);
  }

  @Post("conversations/:conversationId/messages")
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: "chat.send_message"
  })
  sendMessage(
    @CurrentUser("sub") userId: string,
    @Param("conversationId") conversationId: string,
    @Body() payload: SendMessageDto
  ) {
    return this.chatService.sendMessage(userId, conversationId, payload);
  }
}
