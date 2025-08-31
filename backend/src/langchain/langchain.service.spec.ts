import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LangchainService } from './langchain.service';
import { PrismaService } from '../prisma/prisma.service';
import { VectorService } from './vector.service';

/**
 * Unit tests for LangchainService.  These tests verify that the
 * service correctly interprets configuration for different models
 * and exposes a human‑readable model configuration via
 * getModelConfig().  External dependencies (Prisma, VectorService)
 * are stubbed since the focus is on the configuration logic.
 */
describe('LangchainService', () => {
  let service: LangchainService;
  let configService: ConfigService;

  // Provide partial mocks instead of casting to any
  const mockPrismaService: Partial<PrismaService> = {};
  const mockVectorService: Partial<VectorService> = {};

  const createModule = async (env: Record<string, unknown>) => {
    return await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => env],
        }),
      ],
      providers: [
        LangchainService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: VectorService, useValue: mockVectorService },
      ],
    }).compile();
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should report correct config for gpt-5-nano', async () => {
    const module: TestingModule = await createModule({
      OPENAI_MODEL: 'gpt-5-nano',
      OPENAI_MAX_TOKENS: 500,
    });
    service = module.get<LangchainService>(LangchainService);
    configService = module.get<ConfigService>(ConfigService);
    const cfg = service.getModelConfig();
    expect(cfg.modelName).toBe('gpt-5-nano');
    expect(cfg.usesResponsesApi).toBe(true);
    expect(cfg.temperatureIncluded).toBe(false);
    expect(cfg.maxTokensConfigured).toBe(500);
  });

  it('should report correct config for gpt-3.5-turbo', async () => {
    const module: TestingModule = await createModule({
      OPENAI_MODEL: 'gpt-3.5-turbo',
      OPENAI_MAX_TOKENS: 4096,
      OPENAI_TEMPERATURE: 0.5,
    });
    service = module.get<LangchainService>(LangchainService);
    const cfg = service.getModelConfig();
    expect(cfg.modelName).toBe('gpt-3.5-turbo');
    expect(cfg.usesResponsesApi).toBe(false);
    expect(cfg.temperatureIncluded).toBe(true);
    expect(cfg.maxTokensConfigured).toBe(4096);
  });

  it('should report correct config for gpt-4o-mini', async () => {
    const module: TestingModule = await createModule({
      OPENAI_MODEL: 'gpt-4o-mini',
      OPENAI_MAX_TOKENS: 800,
      OPENAI_TEMPERATURE: 0.2,
    });
    service = module.get<LangchainService>(LangchainService);
    const cfg = service.getModelConfig();
    expect(cfg.modelName).toBe('gpt-4o-mini');
    // gpt-4o is part of the responses family
    expect(cfg.usesResponsesApi).toBe(true);
    // gpt-4o supports temperature
    expect(cfg.temperatureIncluded).toBe(true);
    expect(cfg.maxTokensConfigured).toBe(800);
  });
});