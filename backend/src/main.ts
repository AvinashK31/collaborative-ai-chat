import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });
  const configService = app.get(ConfigService);

  // Enable validation pipes
  app.useGlobalPipes(new ValidationPipe());

  // Enable CORS with more specific configuration for WebSocket
  app.enableCors({
    origin: [
      configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
      'http://localhost:4040',
      'http://127.0.0.1:4040'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    credentials: true,
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Collaborative AI Chat API')
    .setDescription('A comprehensive API for collaborative AI-powered chat application')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('conversations', 'Conversation management')
    .addTag('messages', 'Message handling and AI integration')
    .addTag('invitations', 'User invitation system')
    .addTag('users', 'User management')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('PORT') || 9000;
  await app.listen(port);
  
  console.log(` Application is running on: http://localhost:${port}`);
  console.log(`WebSocket server running on: ws://localhost:${port}`);
  console.log(` API Documentation available at: http://localhost:${port}/api-docs`);
}

bootstrap(); 