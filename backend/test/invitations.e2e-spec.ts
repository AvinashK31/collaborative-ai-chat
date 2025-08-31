import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E tests for the Invitations API.  These tests cover sending
 * invitations to join a conversation and retrieving invitations
 * for a user.
 */
describe('InvitationsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let inviteeToken: string;
  let conversationId: string;
  let invitationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
    // Register owner and invitee
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: 'password123', name: 'Owner' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'invitee@example.com', password: 'password123', name: 'Invitee' })
      .expect(201);
    // Login
    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: 'password123' });
    ownerToken = ownerLogin.body.access_token;
    const inviteeLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'invitee@example.com', password: 'password123' });
    inviteeToken = inviteeLogin.body.access_token;
    // Owner creates a conversation
    const convRes = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Invitation Test Conversation' })
      .expect(201);
    conversationId = convRes.body.id;
  });

  afterAll(async () => {
    // Cleanup: delete invitations, conversations and users
    await prisma.invitation.deleteMany({ where: { id: invitationId } });
    await prisma.conversation.deleteMany({ where: { id: conversationId } });
    await prisma.user.deleteMany({ where: { email: { in: ['owner@example.com', 'invitee@example.com'] } } });
    await app.close();
  });

  it('should send an invitation', async () => {
    const res = await request(app.getHttpServer())
      .post('/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ conversationId, email: 'invitee@example.com' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.conversationId).toBe(conversationId);
    expect(res.body.email).toBe('invitee@example.com');
    invitationId = res.body.id;
  });

  it('should return invitations for invitee', async () => {
    const res = await request(app.getHttpServer())
      .get('/invitations')
      .set('Authorization', `Bearer ${inviteeToken}`)
      .expect(200);
    // Should contain one invitation with matching conversationId
    const invites = res.body;
    expect(Array.isArray(invites)).toBe(true);
    const found = invites.find((inv) => inv.id === invitationId);
    expect(found).toBeDefined();
    expect(found.conversationId).toBe(conversationId);
  });
});