import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E tests for the Conversations API.  These tests exercise the
 * full HTTP stack by spinning up a Nest application with the
 * `AppModule` and issuing requests against it via supertest.  Each
 * test performs end‑to‑end validation of controller routing,
 * authentication and service logic.
 */
describe('ConversationsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let conversationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Create a test user and obtain a JWT token
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'e2e_user@example.com', password: 'password123', name: 'E2E User' })
      .expect(201);
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e_user@example.com', password: 'password123' })
      .expect(200);
    accessToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    // Clean up conversations and user
    if (conversationId) {
      await prisma.conversation.deleteMany({ where: { id: conversationId } });
    }
    await prisma.user.deleteMany({ where: { email: 'e2e_user@example.com' } });
    await app.close();
  });

  it('should create a new conversation', async () => {
    const res = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Test Conversation' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Test Conversation');
    conversationId = res.body.id;
  });

  it('should return user conversations', async () => {
    const res = await request(app.getHttpServer())
      .get('/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should get conversation by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('id', conversationId);
    expect(res.body).toHaveProperty('title', 'Test Conversation');
  });

  it('should update conversation', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Updated Title' })
      .expect(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('should delete conversation', async () => {
    await request(app.getHttpServer())
      .delete(`/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
    // Ensure conversation is removed
    await request(app.getHttpServer())
      .get(`/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});