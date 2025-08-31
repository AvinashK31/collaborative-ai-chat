# Collaborative AI Chat

A modern, full-stack collaborative chat application powered by AI, built with React, TypeScript, NestJS, and OpenAI integration.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Development](#development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Overview

Collaborative AI Chat is a real-time messaging application that enables users to collaborate in conversations with AI assistance. The application features user authentication, real-time messaging, AI-powered responses, and invitation systems for team collaboration.

### Key Features

- **Real-time Messaging**: WebSocket-based instant messaging
- **AI Integration**: OpenAI-powered intelligent responses
- **User Authentication**: JWT-based secure authentication
- **Collaborative Conversations**: Invite users to join conversations
- **Modern UI**: Responsive design with Tailwind CSS
- **Type Safety**: Full TypeScript implementation

## ✨ Features

### Authentication & User Management
- User registration and login
- JWT token-based authentication
- Password hashing with bcrypt
- User profile management

### Real-time Communication
- WebSocket-based real-time messaging
- Message history persistence
- Read status tracking
- Typing indicators

### AI Integration
- OpenAI integration (configurable via `OPENAI_MODEL`, supports GPT‑4, GPT‑4o, GPT‑5 and future models)
- Context-aware conversations
- Streaming AI responses
- Conversation memory

### Collaboration Features
- User invitation system
- Conversation sharing
- Role-based access control
- Email notifications

### Vector Database Integration

To enrich AI responses with semantically similar context, the application integrates a vector database. Each message is embedded using OpenAI embeddings and stored in a vector store (in memory by default). When generating an AI reply, the system performs a similarity search to retrieve relevant past messages from the same conversation and includes them in the prompt sent to the language model.

Supported vector providers:

* **In‑memory** – default, uses LangChain's `MemoryVectorStore`.
* **ChromaDB** – persistent store; set `VECTOR_DB_PROVIDER=chroma` and supply `VECTOR_DB_URL` and `VECTOR_DB_COLLECTION`.
* **Weaviate** – additional providers can be added by extending `src/langchain/vector.service.ts`.

This integration enables smarter, context‑aware AI interactions and paves the way for search across conversations.

## 🛠 Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Client-side routing
- **Socket.io Client** - Real-time communication
- **Axios** - HTTP client
- **React Hook Form** - Form management
- **React Hot Toast** - Notifications

### Backend
- **NestJS** - Node.js framework
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **MySQL** - Database
- **Socket.io** - WebSocket server
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **OpenAI API** - AI integration
- **Nodemailer** - Email service

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **Vitest** - Frontend testing
- **Swagger** - API documentation

## ⚡ Quick Start

The fastest way to get started is using our provided scripts:

### Development Mode (Recommended for Development) 🚀
For development with hot reloading and automatic code updates:

```bash
./dev.sh
```

**Features:**
- ✅ Hot reloading for both frontend and backend
- ✅ Changes to source code are reflected immediately
- ✅ No need to rebuild containers for code changes
- ✅ Full development experience with debugging

### Production Mode 📦
For production deployment:

```bash
./prod.sh
```

**Features:**
- ✅ Optimized builds
- ✅ Compiled JavaScript
- ✅ Production-ready configuration

### Access Points
After running either script, access the application at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9000
- **API Documentation**: http://localhost:9000/api-docs
- **Database**: localhost:3307
- **Vector DB**: http://localhost:8000

## 📁 Project Structure

```
collaborative-ai-chat/
├── backend/                 # NestJS backend application
│   ├── src/
│   │   ├── auth/           # Authentication module
│   │   ├── chat/           # WebSocket chat functionality
│   │   ├── conversations/  # Conversation management
│   │   ├── messages/       # Message handling
│   │   ├── invitations/    # User invitation system
│   │   ├── users/          # User management
│   │   ├── langchain/      # AI integration
│   │   ├── email/          # Email service
│   │   └── prisma/         # Database service
│   ├── prisma/             # Database schema and migrations
│   ├── test/               # End-to-end tests
│   └── package.json
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── test/           # Test setup
│   └── package.json
├── dev.sh                  # Development startup script
├── prod.sh                 # Production startup script
├── docker-compose.yml      # Production Docker configuration
├── docker-compose.dev.yml  # Development Docker configuration
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Docker** and **Docker Compose** (recommended)
- **Node.js** (v18 or higher) - for local development
- **npm** or **yarn** - for local development
- **MySQL** database - included in Docker setup
- **OpenAI API key**

### Quick Setup with Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collaborative-ai-chat
   ```

2. **Set up environment variables**
   ```bash
   # Backend
   cp backend/env.example backend/.env
   # Edit backend/.env with your OpenAI API key and other configuration
   
   # Frontend
   cp frontend/env.example frontend/.env
   # Edit frontend/.env with your configuration
   ```

3. **Start the application**
   ```bash
   # For development (with hot reloading)
   ./dev.sh
   
   # For production
   ./prod.sh
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:9000
- API Documentation: http://localhost:9000/api-docs

### Manual Docker Setup

If you prefer to run Docker commands manually:

#### Development Mode
```bash
# Stop existing containers
docker-compose down

# Start in development mode with hot reloading
docker-compose -f docker-compose.dev.yml up --build
```

#### Production Mode
```bash
# Stop existing containers
docker-compose down

# Start in production mode
docker-compose up --build
```

### Local Development Setup

If you prefer to run the application locally without Docker:

1. **Install backend dependencies**
   ```bash
   cd backend
   yarn install
   ```

2. **Install frontend dependencies**
   ```bash
   cd ../frontend
   yarn install
   ```

3. **Set up the database**
   ```bash
   cd ../backend
   npx prisma generate
   npx prisma db push
   ```

4. **Start the development servers**
   ```bash
   # Backend (Terminal 1)
   cd backend
   yarn run start:dev
   
   # Frontend (Terminal 2)
   cd frontend
   yarn run dev
   ```

The application will be available at:
- Frontend: http://localhost:4040
- Backend API: http://localhost:9000
- API Documentation: http://localhost:9000/api-docs

## 🔧 Environment Variables

### Backend (.env)

```env
# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/collaborative_chat"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# Server Configuration
PORT=9000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN="http://localhost:4040"
FRONTEND_URL="http://localhost:4040"

# WebSocket Configuration
WEBSOCKET_CORS="*"

# Email Configuration
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
EMAIL_FROM="noreply@collaborativechat.com"
EMAIL_SECURE=false

# OpenAI Configuration
OPENAI_API_KEY="your-open-ai-key"
OPENAI_MODEL="gpt-4o-mini"
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.7

# Vector database configuration (optional)
VECTOR_DB_PROVIDER="memory" # Use "chroma" to enable ChromaDB
VECTOR_DB_URL="http://localhost:8000" # URL of your vector DB service
VECTOR_DB_COLLECTION="messages" # Name of the collection/table used by the vector store

# Application Configuration
APP_NAME="Collaborative AI Chat"
APP_VERSION="1.0.0"
LOG_LEVEL="info"

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (.env)

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:9000

# WebSocket Configuration
VITE_WS_URL=ws://localhost:9000

# Development Server Configuration
VITE_PORT=4040

# Application Configuration
VITE_APP_NAME=Collaborative AI Chat
VITE_APP_VERSION=1.0.0

# Development Configuration
VITE_DEV_MODE=true
VITE_LOG_LEVEL=info

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG_MODE=false
```

## 📚 API Documentation

The API documentation is automatically generated using Swagger and is available at:

**http://localhost:9000/api-docs**

### API Endpoints

#### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /auth/profile` - Get user profile (protected)

#### Conversations
- `GET /conversations` - Get user conversations
- `POST /conversations` - Create new conversation
- `GET /conversations/:id` - Get conversation details
- `PATCH /conversations/:id` - Update conversation
- `DELETE /conversations/:id` - Delete conversation

#### Messages
- `GET /messages/conversation/:id` - Get conversation messages
- `POST /messages/send-with-ai` - Send message with AI response
- `PATCH /messages/:id` - Update message
- `GET /messages/unread-counts` - Get unread message counts
- `POST /messages/mark-read/:id` - Mark conversation as read

#### Invitations
- `POST /invitations` - Send invitation
- `GET /invitations` - Get user invitations
- `POST /invitations/:id/accept` - Accept invitation
- `POST /invitations/:id/decline` - Decline invitation

## 🧪 Testing

### Backend Testing

```bash
cd backend

# Run unit tests
yarn test

# Run tests in watch mode
yarn run test:watch

# Run tests with coverage
yarn run test:cov

# Run end-to-end tests
yarn run test:e2e
```

### Frontend Testing

```bash
cd frontend

# Run tests
yarn test

# Run tests with UI
yarn run test:ui

# Run tests with coverage
yarn run test:coverage
```

### Test Coverage

The project includes comprehensive test coverage for:
- Unit tests for all services and controllers
- Integration tests for API endpoints
- Component tests for React components
- End-to-end tests for critical user flows

## 🛠 Development

### Development Workflow

The project provides two main development approaches:

#### 1. Docker-based Development (Recommended)
Use the provided scripts for the best development experience:

```bash
# Development mode with hot reloading
./dev.sh

# Production mode for testing
./prod.sh
```

**Benefits of Docker Development:**
- ✅ Consistent environment across all developers
- ✅ Hot reloading for both frontend and backend
- ✅ No need to install Node.js, MySQL, or other dependencies locally
- ✅ Easy switching between development and production modes
- ✅ All services (database, vector DB) are automatically configured

#### 2. Local Development
For developers who prefer to run services locally:

```bash
# Backend development
cd backend
yarn run start:dev

# Frontend development (in another terminal)
cd frontend
yarn run dev
```

### Code Quality

The project uses several tools to maintain code quality:

- **ESLint** - Code linting and style enforcement
- **Prettier** - Code formatting
- **TypeScript** - Type safety and IntelliSense

### Development Scripts

#### Docker Scripts
```bash
./dev.sh               # Start development environment with hot reloading
./prod.sh              # Start production environment
```

#### Backend Scripts
```bash
yarn run start:dev      # Start development server
yarn run build          # Build for production
yarn run start:prod     # Start production server
yarn run lint           # Run ESLint
yarn run format         # Format code with Prettier
```

#### Frontend Scripts
```bash
yarn run dev            # Start development server
yarn run build          # Build for production
yarn run preview        # Preview production build
yarn run lint           # Run ESLint
```

### Development vs Production Modes

#### Development Mode (`./dev.sh`)
- Uses `docker-compose.dev.yml`
- Source code is mounted as volumes for hot reloading
- Development Dockerfiles with development tools
- Changes to code are reflected immediately
- Full debugging capabilities

#### Production Mode (`./prod.sh`)
- Uses `docker-compose.yml`
- Optimized builds with compiled JavaScript
- Production Dockerfiles
- No source code mounting
- Optimized for performance and security

### Database Management

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Push schema changes to database
npx prisma db push

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## 🚀 Deployment

### Docker-based Deployment (Recommended)

The easiest way to deploy the application is using Docker:

#### 1. Production Deployment
```bash
# Clone the repository
git clone <repository-url>
cd collaborative-ai-chat

# Set up environment variables
cp backend/env.example backend/.env
cp frontend/env.example frontend/.env
# Edit both .env files with production values

# Start production environment
./prod.sh
```

#### 2. Environment Variables for Production

Make sure to update all environment variables for production:
- Use strong JWT secrets
- Configure production database credentials
- Set up proper CORS origins
- Configure email service
- Set up OpenAI API key
- Set `NODE_ENV=production`

### Cloud Deployment

#### Docker Compose on VPS/Cloud Server
1. **Upload the project to your server**
2. **Set up environment variables**
3. **Run the production script:**
   ```bash
   ./prod.sh
   ```

#### Kubernetes Deployment
The application can be deployed to Kubernetes using the provided Docker images:
- Backend: `collaborative-ai-chat-backend`
- Frontend: `collaborative-ai-chat-frontend`
- Database: Use managed MySQL service
- Vector DB: Use managed ChromaDB or similar

#### Platform-specific Deployment

##### Heroku
1. **Set up Heroku app**
2. **Configure environment variables**
3. **Deploy using Heroku container registry**

##### AWS ECS
1. **Build and push Docker images to ECR**
2. **Create ECS cluster and services**
3. **Configure load balancer and auto-scaling**

##### Google Cloud Run
1. **Build and push to Google Container Registry**
2. **Deploy services to Cloud Run**
3. **Configure networking and environment variables**

### Manual Deployment

#### Backend Deployment

1. **Build the application**
   ```bash
   cd backend
   yarn run build
   ```

2. **Set up production environment variables**
   ```bash
   cp env.example .env.production
   # Edit .env.production with production values
   ```

3. **Deploy to your preferred platform**
   - **PM2**: Use PM2 for process management
   - **Docker**: Use the provided Dockerfile
   - **Serverless**: Deploy to AWS Lambda or similar

#### Frontend Deployment

1. **Build the application**
   ```bash
   cd frontend
   yarn run build
   ```

2. **Deploy the `dist` folder**
   - **Vercel**: Connect your repository
   - **Netlify**: Upload the `dist` folder
   - **AWS S3**: Upload to S3 bucket with CloudFront
   - **Nginx**: Serve static files with Nginx

## 🔧 Troubleshooting

### Common Issues

#### Docker Issues
**Problem**: Changes not reflecting in development mode
**Solution**: Make sure you're using `./dev.sh` or `docker-compose -f docker-compose.dev.yml up --build`

**Problem**: Port conflicts
**Solution**: Check if ports 3000, 9000, 3307, or 8000 are already in use:
```bash
# Check port usage
lsof -i :3000
lsof -i :9000
lsof -i :3307
lsof -i :8000
```

**Problem**: Database connection issues
**Solution**: Ensure the database container is healthy:
```bash
docker-compose ps
# Wait for db service to show "healthy" status
```

#### Environment Variables
**Problem**: OpenAI API not working
**Solution**: Check your `backend/.env` file has a valid `OPENAI_API_KEY`

**Problem**: JWT authentication failing
**Solution**: Ensure `JWT_SECRET` is set in `backend/.env`

#### Development Issues
**Problem**: Hot reloading not working
**Solution**: 
1. Verify you're using `./dev.sh`
2. Check volume mounts: `docker-compose -f docker-compose.dev.yml ps`
3. Restart containers: `docker-compose -f docker-compose.dev.yml down && ./dev.sh`

### Getting Help

1. Check the [API Documentation](http://localhost:9000/api-docs)
2. Review the [Development Guide](DEVELOPMENT.md)
3. Check existing issues in the repository
4. Create a new issue with detailed information including:
   - Your operating system
   - Docker version
   - Node.js version
   - Error messages
   - Steps to reproduce

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting
- Use the provided development scripts (`./dev.sh`) for testing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [API Documentation](http://localhost:9000/api-docs)
2. Review the existing issues
3. Create a new issue with detailed information

## 🔮 Roadmap

### Planned Features
- [ ] File upload and sharing
- [ ] Voice messages
- [ ] Video calls integration
- [ ] Advanced AI models support
- [ ] Mobile application
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Advanced search functionality
- [ ] Export conversation history

### Performance Improvements
- [ ] Database query optimization
- [ ] Caching implementation
- [ ] CDN integration
- [ ] Image optimization
- [ ] Bundle size optimization

---

**Built with ❤️ using modern web technologies**
