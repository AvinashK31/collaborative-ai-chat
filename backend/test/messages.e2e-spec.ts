import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E tests for the Messages API.  These tests verify that the
 * message endpoints behave correctly when fetching messages,
 * marking conversations as read and retrieving unread counts.
 */
describe('MessagesController (e2e)', () => {
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

    // Register and login a test user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'e2e_msg_user@example.com', password: 'password123', name: 'E2E Msg' })
      .expect(201);
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e_msg_user@example.com', password: 'password123' })
      .expect(200);
    accessToken = loginRes.body.access_token;
    // Create a conversation
    const convRes = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Messages Test Conversation' })
      .expect(201);
    conversationId = convRes.body.id;
  });

  afterAll(async () => {
    // Clean up messages, conversations and user
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.deleteMany({ where: { id: conversationId } });
    await prisma.user.deleteMany({ where: { email: 'e2e_msg_user@example.com' } });
    await app.close();
  });

  it('should return empty messages for a new conversation', async () => {
    const res = await request(app.getHttpServer())
      .get(`/messages/conversation/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('should mark conversation as read', async () => {
    await request(app.getHttpServer())
      .post(`/messages/mark-read/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ success: true });
      });
  });

  it('should return unread counts mapping', async () => {
    const res = await request(app.getHttpServer())
      .get('/messages/unread-counts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toHaveProperty(conversationId);
  });
});