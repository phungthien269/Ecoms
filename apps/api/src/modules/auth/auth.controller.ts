import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RateLimit } from "../rateLimit/rate-limit.decorator";
import { RateLimitGuard } from "../rateLimit/rate-limit.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import type { UserProfileEntity } from "../users/entities/user-profile.entity";
import type { Response } from "express";

interface AuthResponseDto {
  user: UserProfileEntity;
  accessToken: string;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Post("register")
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: "auth.register"
  })
  register(@Body() payload: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(payload);
  }

  @Post("login")
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: "auth.login"
  })
  login(@Body() payload: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(payload);
  }

  @Get("google/start")
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: "auth.google"
  })
  async googleStart(
    @Query("redirectTo") redirectTo: string | undefined,
    @Res() response: Response
  ) {
    response.redirect(await this.authService.getGoogleAuthorizationUrl(redirectTo));
  }

  @Get("google/callback")
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: "auth.google"
  })
  async googleCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Res() response: Response
  ) {
    if (!code || !state) {
      throw new BadRequestException("Missing Google OAuth callback parameters");
    }

    const { auth, redirectTo } = await this.authService.authenticateGoogleCallback(
      code,
      state
    );
    this.applyAuthCookies(response, auth);
    response.redirect(redirectTo);
  }

  private applyAuthCookies(response: Response, auth: AuthResponseDto) {
    const cookieDomain = this.configService.get<string>("AUTH_COOKIE_DOMAIN");
    const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");
    const sharedOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: frontendUrl.startsWith("https://"),
      path: "/",
      ...(cookieDomain ? { domain: cookieDomain } : {})
    };

    response.cookie("ecoms_access_token", auth.accessToken, sharedOptions);
    response.cookie("ecoms_user_email", auth.user.email, sharedOptions);
    response.cookie("ecoms_user_role", auth.user.role, sharedOptions);
  }
}
