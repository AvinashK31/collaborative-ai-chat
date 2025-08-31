import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto } from './dto/auth.dto';

/**
 * Authentication service responsible for user registration, login, and JWT token management.
 * 
 * This service handles:
 * - User registration with password hashing
 * - User authentication with password verification
 * - JWT token generation and validation
 * - User profile retrieval
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Registers a new user with email, password, and optional name.
   * 
   * @param registerDto - Registration data containing email, password, and optional name
   * @returns Promise containing user data and JWT access token
   * @throws ConflictException if user with the email already exists
   * 
   * @example
   * ```typescript
   * const result = await authService.register({
   *   email: 'user@example.com',
   *   password: 'password123',
   *   name: 'John Doe'
   * });
   * ```
   */
  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password using bcrypt with salt rounds of 10
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // Generate JWT access token with user ID and email
    const access_token = this.jwtService.sign({ userId: user.id, email: user.email });

    return {
      user,
      access_token,
    };
  }

  /**
   * Authenticates a user with email and password.
   * 
   * @param loginDto - Login credentials containing email and password
   * @returns Promise containing user data and JWT access token
   * @throws UnauthorizedException if credentials are invalid
   * 
   * @example
   * ```typescript
   * const result = await authService.login({
   *   email: 'user@example.com',
   *   password: 'password123'
   * });
   * ```
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT access token with user ID and email
    const access_token = this.jwtService.sign({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      access_token,
    };
  }

  /**
   * Validates a user by their ID and returns user profile data.
   * 
   * @param userId - The unique identifier of the user
   * @returns Promise containing user profile data or null if user doesn't exist
   * 
   * @example
   * ```typescript
   * const user = await authService.validateUser('user-id-123');
   * if (user) {
   *   console.log('User found:', user.name);
   * }
   * ```
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return user;
  }
} 