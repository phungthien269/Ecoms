import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@ecoms/contracts";
import { compare, hash } from "bcryptjs";
import { MailerService } from "../mailer/mailer.service";
import { PrismaService } from "../prisma/prisma.service";
import type { UserProfileEntity } from "../users/entities/user-profile.entity";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import type { AuthPayload } from "./types/auth-payload";

interface AuthResponse {
  user: UserProfileEntity;
  accessToken: string;
}

interface GoogleProfile {
  subject: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
}

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

interface GoogleStatePayload {
  purpose: "google_oauth_state";
  redirectTo: string;
}

type PersistedUser = {
  id: string;
  email: string;
  googleSubject?: string | null;
  fullName: string;
  phoneNumber: string | null;
  role: string;
  isActive?: boolean;
  deletedAt?: Date | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService
  ) {}

  async register(payload: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (existingUser && !existingUser.deletedAt) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await hash(payload.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        passwordHash,
        fullName: payload.fullName,
        phoneNumber: payload.phoneNumber,
        role: UserRole.CUSTOMER
      }
    });

    const role = user.role as UserRole;
    await this.sendWelcomeEmail(user.email, user.fullName);
    return {
      user: this.toUserProfile(user, role),
      accessToken: await this.signToken(user.id, user.email, role)
    };
  }

  async login(payload: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (!user || !user.passwordHash || user.deletedAt) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const role = user.role as UserRole;
    return {
      user: this.toUserProfile(user, role),
      accessToken: await this.signToken(user.id, user.email, role)
    };
  }

  async getGoogleAuthorizationUrl(redirectTo?: string): Promise<string> {
    const { clientId, redirectUri } = this.getGoogleOAuthConfig();
    const statePayload: GoogleStatePayload = {
      purpose: "google_oauth_state",
      redirectTo: this.resolveFrontendRedirect(redirectTo)
    };
    const state = await this.jwtService.signAsync(statePayload, {
      expiresIn: "10m"
    });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
      state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async authenticateGoogleCallback(
    code: string,
    state: string
  ): Promise<{ auth: AuthResponse; redirectTo: string }> {
    const redirectTo = await this.verifyGoogleState(state);
    const profile = await this.fetchGoogleProfile(code);

    return {
      auth: await this.loginWithGoogleProfile(profile),
      redirectTo
    };
  }

  async loginWithGoogleProfile(profile: GoogleProfile): Promise<AuthResponse> {
    if (!profile.emailVerified) {
      throw new UnauthorizedException("Google account email is not verified");
    }

    const normalizedEmail = profile.email.trim().toLowerCase();
    const userByGoogleSubject = await this.prisma.user.findUnique({
      where: { googleSubject: profile.subject }
    });

    if (userByGoogleSubject) {
      this.ensureUserIsAvailable(userByGoogleSubject);
      const role = userByGoogleSubject.role as UserRole;
      return {
        user: this.toUserProfile(userByGoogleSubject, role),
        accessToken: await this.signToken(
          userByGoogleSubject.id,
          userByGoogleSubject.email,
          role
        )
      };
    }

    const userByEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (userByEmail) {
      this.ensureUserIsAvailable(userByEmail);
      const linkedUser = await this.prisma.user.update({
        where: { id: userByEmail.id },
        data: {
          googleSubject: profile.subject
        }
      });
      const role = linkedUser.role as UserRole;
      return {
        user: this.toUserProfile(linkedUser, role),
        accessToken: await this.signToken(linkedUser.id, linkedUser.email, role)
      };
    }

    const createdUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        googleSubject: profile.subject,
        fullName: profile.fullName,
        role: UserRole.CUSTOMER
      }
    });
    const role = createdUser.role as UserRole;
    await this.sendWelcomeEmail(createdUser.email, createdUser.fullName);

    return {
      user: this.toUserProfile(createdUser, role),
      accessToken: await this.signToken(createdUser.id, createdUser.email, role)
    };
  }

  async verifyAccessToken(token: string): Promise<AuthPayload> {
    return this.jwtService.verifyAsync<AuthPayload>(token);
  }

  private async verifyGoogleState(state: string): Promise<string> {
    try {
      const payload = await this.jwtService.verifyAsync<GoogleStatePayload>(state);

      if (payload.purpose !== "google_oauth_state") {
        throw new UnauthorizedException("Invalid Google OAuth state");
      }

      return this.resolveFrontendRedirect(payload.redirectTo);
    } catch {
      throw new UnauthorizedException("Invalid Google OAuth state");
    }
  }

  private async fetchGoogleProfile(code: string): Promise<GoogleProfile> {
    const { clientId, clientSecret, redirectUri } = this.getGoogleOAuthConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException("Unable to verify Google OAuth code");
    }

    const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenPayload.access_token) {
      throw new UnauthorizedException("Google OAuth token exchange failed");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`
      }
    });

    if (!profileResponse.ok) {
      throw new UnauthorizedException("Unable to fetch Google user profile");
    }

    const profile = (await profileResponse.json()) as GoogleUserInfoResponse;
    if (!profile.sub || !profile.email || !profile.name) {
      throw new UnauthorizedException("Google profile is incomplete");
    }

    return {
      subject: profile.sub,
      email: profile.email,
      fullName: profile.name,
      emailVerified: profile.email_verified === true
    };
  }

  private async signToken(
    userId: string,
    email: string,
    role: UserRole
  ): Promise<string> {
    return this.jwtService.signAsync({
      sub: userId,
      email,
      role
    });
  }

  private ensureUserIsAvailable(user: PersistedUser) {
    if (user.deletedAt || user.isActive === false) {
      throw new UnauthorizedException("User account is unavailable");
    }
  }

  private getGoogleOAuthConfig() {
    const clientId = this.configService.get<string>("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = this.configService.get<string>("GOOGLE_OAUTH_CLIENT_SECRET");
    const redirectUri = this.configService.get<string>("GOOGLE_OAUTH_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException("Google OAuth is not configured");
    }

    return {
      clientId,
      clientSecret,
      redirectUri
    };
  }

  private resolveFrontendRedirect(redirectTo?: string): string {
    const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");
    const defaultUrl = new URL("/cart", frontendUrl);

    if (!redirectTo) {
      return defaultUrl.toString();
    }

    try {
      const candidateUrl = new URL(redirectTo, frontendUrl);
      return candidateUrl.origin === defaultUrl.origin
        ? candidateUrl.toString()
        : defaultUrl.toString();
    } catch {
      return defaultUrl.toString();
    }
  }

  private async sendWelcomeEmail(email: string, fullName: string) {
    await this.mailerService.sendSafely({
      to: email,
      subject: "Welcome to Ecoms",
      html: `<p>Hello ${fullName},</p><p>Your Ecoms account is ready. You can now browse products, place orders, and track updates in real time.</p>`,
      text: `Hello ${fullName}, your Ecoms account is ready. You can now browse products, place orders, and track updates in real time.`,
      tags: ["signup"]
    });
  }

  private toUserProfile(user: PersistedUser, role: UserRole): UserProfileEntity {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role
    };
  }
}
