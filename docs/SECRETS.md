# Secrets Management

This document describes the secrets management strategy for the Loyal Supply Chain API.

## Overview

Secrets (API keys, database credentials, JWT secrets) should never be committed to version control. This document outlines best practices for managing secrets in development and production.

## Required Secrets

The following secrets are required for the application:

- `JWT_SECRET` - Secret key for JWT token signing (minimum 32 characters)
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key (optional, for document extraction)
- `REDIS_URL` - Redis connection string (optional, for caching)

## Development

### Using .env File

1. Create a `.env` file in the `app/` directory:
```bash
cd app
cp .env.example .env
```

2. Fill in the required values:
```env
JWT_SECRET=your-secret-key-minimum-32-characters-long
DATABASE_URL=postgresql://user:password@localhost:5432/database
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379
```

3. **Never commit `.env` to git** - It's already in `.gitignore`

### Verifying .gitignore

Ensure `.env` is in `.gitignore`:
```bash
grep -q "^\.env$" .gitignore && echo "✓ .env is in .gitignore" || echo "✗ .env is NOT in .gitignore"
```

## Production

### Option 1: Environment Variables

Set secrets as environment variables in your deployment platform:

**Docker:**
```bash
docker run -e JWT_SECRET=... -e DATABASE_URL=... ...
```

**Kubernetes:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  JWT_SECRET: "your-secret"
  DATABASE_URL: "postgresql://..."
```

**Docker Compose:**
```yaml
services:
  app:
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=${DATABASE_URL}
```

### Option 2: AWS Secrets Manager

1. Store secrets in AWS Secrets Manager:
```bash
aws secretsmanager create-secret \
  --name loyal-supplychain/secrets \
  --secret-string '{"JWT_SECRET":"...","DATABASE_URL":"..."}'
```

2. Grant IAM role access to secrets

3. Use AWS SDK to retrieve secrets at startup (requires implementation)

### Option 3: HashiCorp Vault

1. Store secrets in Vault:
```bash
vault kv put secret/loyal-supplychain \
  JWT_SECRET=... \
  DATABASE_URL=...
```

2. Use Vault API to retrieve secrets at startup (requires implementation)

## Secret Rotation

### JWT Secret Rotation

1. **Generate new secret:**
```bash
openssl rand -base64 32
```

2. **Update environment variable** in all environments

3. **Restart application** - All existing tokens will be invalidated

4. **Users must re-authenticate** - This is expected behavior

### Database Password Rotation

1. **Update database password** in PostgreSQL

2. **Update DATABASE_URL** in all environments

3. **Restart application** - Connection pool will reconnect with new credentials

### OpenAI API Key Rotation

1. **Generate new API key** in OpenAI dashboard

2. **Update OPENAI_API_KEY** in all environments

3. **Restart application** - New key will be used immediately

4. **Revoke old key** after verification

## Best Practices

1. **Never log secrets** - The logger automatically redacts sensitive data
2. **Use strong secrets** - Minimum 32 characters for JWT_SECRET
3. **Rotate regularly** - Every 90 days for production secrets
4. **Limit access** - Only grant access to necessary personnel
5. **Audit access** - Log who accesses secrets
6. **Use different secrets** - Different secrets for dev/staging/production
7. **Backup secrets securely** - Store encrypted backups off-site

## Security Checklist

- [ ] `.env` is in `.gitignore`
- [ ] No secrets in code or config files
- [ ] Secrets are rotated every 90 days
- [ ] Different secrets for each environment
- [ ] Secrets are stored securely (not in plain text files)
- [ ] Access to secrets is limited and audited
- [ ] Secrets are encrypted at rest
- [ ] Secrets are encrypted in transit
- [ ] Backup secrets are stored securely

## Emergency Procedures

### Secret Compromise

If a secret is compromised:

1. **Immediately rotate the secret** in all environments
2. **Revoke all existing tokens** (for JWT_SECRET)
3. **Force password reset** for all users (if applicable)
4. **Review access logs** for unauthorized access
5. **Notify affected users** if necessary
6. **Document the incident** for security review

### Lost Secret Recovery

If a secret is lost:

1. **Check backup storage** (encrypted backups)
2. **Check deployment platform** secrets management
3. **Regenerate secret** if recovery is not possible
4. **Update all environments** with new secret
5. **Restart application** in all environments

## Monitoring

Monitor for:

- Secret access attempts
- Failed authentication (may indicate compromised secret)
- Unusual API usage (may indicate leaked API key)
- Database connection failures (may indicate wrong credentials)

## Compliance

Ensure secrets management complies with:

- GDPR (if handling EU data)
- SOC 2 (if applicable)
- Industry-specific regulations
- Company security policies

