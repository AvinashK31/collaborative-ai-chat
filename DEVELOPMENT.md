# Development Guide

## Quick Start

### Development Mode (Hot Reloading) 🚀
For development with automatic code reloading:

```bash
./dev.sh
```

**Features:**
- ✅ Changes to TypeScript/JavaScript files are reflected immediately
- ✅ Hot reloading for both frontend and backend
- ✅ No need to rebuild containers for code changes
- ✅ Source code is mounted as volumes
- ✅ Frontend runs on http://localhost:3000
- ✅ Backend API runs on http://localhost:9000

### Production Mode 📦
For production deployment:

```bash
./prod.sh
```

**Features:**
- ✅ Optimized builds
- ✅ Compiled JavaScript
- ✅ Production-ready configuration

## Manual Commands

### Development Mode
```bash
# Stop existing containers
docker-compose down

# Start in development mode
docker-compose -f docker-compose.dev.yml up --build
```

### Production Mode
```bash
# Stop existing containers
docker-compose down

# Start in production mode
docker-compose up --build
```

## Why Changes Weren't Reflecting Before

The original setup used production Dockerfiles that:
1. **Build once**: Code is compiled during the build process
2. **No volume mounts**: Source code changes don't reach the container
3. **Requires rebuild**: Any code change needs `docker-compose up --build`

## Development Mode Benefits

The new development setup:
1. **Volume mounts**: Source code is mounted directly into containers
2. **Hot reloading**: NestJS and Vite watch for file changes
3. **No rebuilds needed**: Changes are reflected immediately
4. **Development tools**: Full debugging and development experience

## Ports

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9000
- **Database**: localhost:3307
- **Vector DB**: http://localhost:8000

## Troubleshooting

### If changes still don't reflect:
1. Make sure you're using `./dev.sh` or `docker-compose -f docker-compose.dev.yml up --build`
2. Check that the containers are running in development mode
3. Verify the volume mounts are working: `docker-compose -f docker-compose.dev.yml ps`

### If you need to rebuild:
```bash
# Stop and rebuild development containers
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up --build
```
