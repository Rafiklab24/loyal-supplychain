# Docker Production Deployment Guide

This guide explains how to deploy the Loyal Supply Chain application using Docker on a cloud server (DigitalOcean Droplet, AWS EC2, etc.).

## Prerequisites

- A server with Docker and Docker Compose installed
- A domain name pointing to your server's IP address
- SSH access to your server

## Quick Start

### 1. Set Up Your Server

```bash
# SSH into your server
ssh root@your-server-ip

# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt-get update && apt-get install -y docker-compose-plugin

# Create app directory
mkdir -p /opt/loyal-supplychain
cd /opt/loyal-supplychain
```

### 2. Clone the Repository

```bash
git clone https://github.com/Rafiklab24/loyal-supplychain.git .
```

### 3. Configure Environment Variables

Create a `.env.production` file:

```bash
cat > .env.production << 'EOF'
# Domain name (used by Caddy for automatic SSL)
DOMAIN=your-domain.com

# Database credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password-here
POSTGRES_DB=loyal_supplychain

# JWT Secret (must be at least 32 characters)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars

# Allowed CORS origins
ALLOWED_ORIGINS=https://your-domain.com

# API URL for frontend
VITE_API_BASE_URL=/api

# Log level
LOG_LEVEL=info
EOF
```

**Important:** Replace the placeholder values with your actual values!

### 4. Update Caddyfile with Your Domain

Edit the `Caddyfile` and replace `{$DOMAIN:localhost}` with your domain:

```bash
# Option 1: Use environment variable (recommended)
# The Caddyfile already supports this, just make sure DOMAIN is set in .env.production

# Option 2: Hardcode the domain
sed -i 's/{$DOMAIN:localhost}/your-domain.com/g' Caddyfile
```

### 5. Build and Start Services

```bash
# Build the images
docker compose -f docker-compose.production.yml build

# Start all services
docker compose -f docker-compose.production.yml --env-file .env.production up -d

# Check status
docker compose -f docker-compose.production.yml ps

# View logs
docker compose -f docker-compose.production.yml logs -f
```

### 6. Initialize the Database

If this is a fresh deployment, you need to run migrations:

```bash
# Run migrations
docker compose -f docker-compose.production.yml exec backend npm run migrate
```

## Architecture

```
Internet
    │
    ▼
┌──────────────────┐
│   Caddy (443)    │  ← Automatic HTTPS with Let's Encrypt
│   Reverse Proxy  │
└──────────────────┘
    │
    ├─────────────┬────────────────┐
    │             │                │
    ▼             ▼                ▼
┌─────────┐  ┌─────────┐    ┌───────────┐
│Frontend │  │ Backend │    │quality-   │
│ (Nginx) │  │ (Node)  │    │media files│
│  :80    │  │  :3000  │    │           │
└─────────┘  └─────────┘    └───────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
    ┌─────────┐    ┌─────────┐
    │PostgreSQL│   │  Redis  │
    │  :5432  │    │  :6379  │
    └─────────┘    └─────────┘
```

## Common Commands

```bash
# View all containers
docker compose -f docker-compose.production.yml ps

# View logs for all services
docker compose -f docker-compose.production.yml logs -f

# View logs for specific service
docker compose -f docker-compose.production.yml logs -f backend

# Restart all services
docker compose -f docker-compose.production.yml restart

# Restart specific service
docker compose -f docker-compose.production.yml restart backend

# Stop all services
docker compose -f docker-compose.production.yml down

# Stop and remove volumes (WARNING: Deletes data!)
docker compose -f docker-compose.production.yml down -v

# Rebuild and restart
docker compose -f docker-compose.production.yml up -d --build
```

## Updating the Application

```bash
cd /opt/loyal-supplychain

# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.production.yml up -d --build

# Run any new migrations
docker compose -f docker-compose.production.yml exec backend npm run migrate
```

## Backup Database

```bash
# Create backup
docker compose -f docker-compose.production.yml exec postgres pg_dump -U postgres loyal_supplychain > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
cat backup_file.sql | docker compose -f docker-compose.production.yml exec -T postgres psql -U postgres loyal_supplychain
```

## SSL Certificate

Caddy automatically obtains and renews SSL certificates from Let's Encrypt. Requirements:
- Your domain must point to your server's IP
- Ports 80 and 443 must be open
- The domain in Caddyfile must match your actual domain

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose -f docker-compose.production.yml logs backend

# Check if ports are in use
netstat -tlnp | grep -E '80|443|3000'
```

### Database connection issues
```bash
# Check if postgres is running
docker compose -f docker-compose.production.yml ps postgres

# Test connection
docker compose -f docker-compose.production.yml exec postgres psql -U postgres -c "SELECT 1"
```

### SSL certificate issues
```bash
# Check Caddy logs
docker compose -f docker-compose.production.yml logs caddy

# Ensure DNS is properly configured
nslookup your-domain.com
```

## Security Recommendations

1. **Firewall**: Only allow ports 80, 443, and 22 (SSH)
2. **SSH Keys**: Disable password authentication for SSH
3. **Updates**: Keep your server and Docker updated
4. **Backups**: Set up automated database backups
5. **Monitoring**: Set up uptime monitoring (e.g., UptimeRobot)
