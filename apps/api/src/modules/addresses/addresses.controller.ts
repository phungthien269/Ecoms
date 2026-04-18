import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AddressesService } from "./addresses.service";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";

@Controller("addresses")
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  listOwn(@CurrentUser("sub") userId: string) {
    return this.addressesService.listOwn(userId);
  }

  @Post()
  create(@CurrentUser("sub") userId: string, @Body() payload: CreateAddressDto) {
    return this.addressesService.create(userId, payload);
  }

  @Patch(":addressId")
  update(
    @CurrentUser("sub") userId: string,
    @Param("addressId") addressId: string,
    @Body() payload: UpdateAddressDto
  ) {
    return this.addressesService.update(userId, addressId, payload);
  }

  @Post(":addressId/default")
  setDefault(@CurrentUser("sub") userId: string, @Param("addressId") addressId: string) {
    return this.addressesService.setDefault(userId, addressId);
  }

  @Delete(":addressId")
  remove(@CurrentUser("sub") userId: string, @Param("addressId") addressId: string) {
    return this.addressesService.remove(userId, addressId);
  }
}
