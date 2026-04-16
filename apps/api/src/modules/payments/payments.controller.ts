import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PaymentsService } from "./payments.service";

@Controller("payments")
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(":paymentId/confirm")
  confirm(@CurrentUser("sub") userId: string, @Param("paymentId") paymentId: string) {
    return this.paymentsService.confirm(userId, paymentId);
  }
}
