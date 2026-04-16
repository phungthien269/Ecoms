import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@ecoms/contracts";
import { compare, hash } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type { UserProfileEntity } from "../users/entities/user-profile.entity";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import type { AuthPayload } from "./types/auth-payload";

interface AuthResponse {
  user: UserProfileEntity;
  accessToken: string;
}

type PersistedUser = {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
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

  async verifyAccessToken(token: string): Promise<AuthPayload> {
    return this.jwtService.verifyAsync<AuthPayload>(token);
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
