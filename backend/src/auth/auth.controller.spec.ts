import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
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

    const mockResponse = {
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
      },
      access_token: 'mock-jwt-token',
    };

    it('should register a new user successfully', async () => {
      // Arrange
      mockAuthService.register.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.register(registerDto);

      // Assert
      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockResponse);
    });

    it('should handle registration errors', async () => {
      // Arrange
      const error = new Error('Registration failed');
      mockAuthService.register.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.register(registerDto)).rejects.toThrow(error);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockResponse = {
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
      },
      access_token: 'mock-jwt-token',
    };

    it('should login user successfully', async () => {
      // Arrange
      mockAuthService.login.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.login(loginDto);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockResponse);
    });

    it('should handle login errors', async () => {
      // Arrange
      const error = new Error('Login failed');
      mockAuthService.login.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow(error);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('getProfile', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
    };

    const mockRequest = {
      user: mockUser,
    };

    it('should return user profile', async () => {
      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result).toEqual(mockUser);
    });
  });
});
