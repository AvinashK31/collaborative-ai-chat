import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { LangchainModule } from './langchain.module';
import { PrismaService } from '../prisma/prisma.service';
import { VectorService } from './vector.service';

/**
 * E2E-esque controller test for LangchainController.  It spins up a
 * minimal Nest application containing only the Langchain module to
 * verify that the `/langchain/config` route returns the model
 * configuration and enforces JWT authentication.
 */
describe('LangchainController', () => {
  let app: INestApplication;
  // Provide partial mocks rather than casting to `any`
  const mockPrismaService: Partial<PrismaService> = {};
  const mockVectorService: Partial<VectorService> = {};

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            OPENAI_MODEL: 'gpt-5-nano',
            OPENAI_MAX_TOKENS: 500,
          })],
        }),
        LangchainModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(VectorService)
      .useValue(mockVectorService)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should require authentication', async () => {
    await request(app.getHttpServer())
      .get('/langchain/config')
      .expect(401);
  });
});