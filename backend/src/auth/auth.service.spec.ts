import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
    };

    it('should register a new user successfully', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          password: 'hashedPassword',
          name: registerDto.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
      });
      expect(result).toEqual({
        user: mockUser,
        access_token: 'mock-jwt-token',
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedPassword',
      createdAt: new Date(),
    };

    it('should login user successfully with valid credentials', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
      });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          createdAt: mockUser.createdAt,
        },
        access_token: 'mock-jwt-token',
      });
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    const userId = '1';
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
    };

    it('should return user if user exists', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.validateUser(userId);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user does not exist', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.validateUser(userId);

      // Assert
      expect(result).toBeNull();
    });
  });
});
