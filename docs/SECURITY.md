# Security Guide

This document outlines security practices, threats, and mitigation strategies for the Loyal Supply Chain system.

## Security Overview

The system implements multiple layers of security:
- Authentication and authorization
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting
- Security headers
- Audit logging

## Authentication

### JWT Tokens

- **Algorithm**: HS256
- **Expiration**: Configurable (default: 1h production, 24h development)
- **Storage**: HTTP-only cookies (recommended) or localStorage
- **Refresh**: Implement refresh token pattern for long-lived sessions

### Password Security

- **Hashing**: bcrypt with 10 rounds
- **Requirements**: Minimum length, complexity rules
- **Storage**: Never stored in plain text
- **Reset**: Secure password reset flow with time-limited tokens

### Token Theft Detection

The system detects token theft by:
- Tracking token usage patterns
- Monitoring IP address changes
- Detecting concurrent sessions
- Invalidating compromised tokens

## Authorization

### Role-Based Access Control (RBAC)

**Roles:**
- `admin` - Full system access
- `user` - Standard user access
- `viewer` - Read-only access

**Permissions:**
- Fine-grained permissions per resource
- Permission inheritance
- Dynamic permission checks

### Branch-Based Access

- Users assigned to branches
- Data filtered by branch access
- Prevents cross-branch data access

## Input Validation

### Validation Strategy

- **Zod schemas** for all API inputs
- **Type checking** at runtime
- **Sanitization** of user inputs
- **Whitelist approach** (reject unknown fields)

### SQL Injection Prevention

- **Parameterized queries** (pg library)
- **No string concatenation** in SQL
- **Input validation** before database queries
- **Least privilege** database users

### XSS Prevention

- **Output encoding** in templates
- **Content Security Policy** headers
- **Sanitization** of user-generated content
- **React's built-in XSS protection**

## API Security

### Rate Limiting

- **General endpoints**: 100 requests per 15 minutes (production)
- **Authentication endpoints**: 10 attempts per 15 minutes
- **Password reset**: 5 attempts per hour
- **Document upload**: 20 uploads per 15 minutes

### CORS Configuration

- **Production**: Whitelisted origins only
- **Development**: All origins (with warnings)
- **Credentials**: Enabled for authenticated requests

### Security Headers

Implemented via Helmet.js:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HTTPS only)
- `Content-Security-Policy`

## Data Protection

### Sensitive Data

**Never log:**
- Passwords
- API keys
- JWT secrets
- Credit card numbers
- Personal identification numbers

**Encryption:**
- Passwords: bcrypt hashing
- API keys: Encrypted at rest (if stored)
- Database: Use encrypted connections (SSL/TLS)

### Data Privacy

- **GDPR compliance** (if handling EU data)
- **Data retention policies**
- **Right to deletion**
- **Data export capabilities**

## Audit Logging

### What's Logged

- User authentication events
- Data modifications (INSERT/UPDATE/DELETE)
- Permission changes
- Failed access attempts
- Administrative actions

### Audit Trail

- **Immutable logs** in database
- **Before/after snapshots** for changes
- **User attribution** for all actions
- **Timestamp tracking**

## Secrets Management

### Environment Variables

- **Never commit** `.env` files
- **Use secrets manager** in production (AWS Secrets Manager, Vault)
- **Rotate secrets** regularly (every 90 days)
- **Different secrets** per environment

See [SECRETS.md](SECRETS.md) for detailed secrets management guide.

## Network Security

### HTTPS

- **Always use HTTPS** in production
- **TLS 1.2+** required
- **Certificate management** (Let's Encrypt, etc.)
- **HSTS** headers enabled

### Firewall Rules

- **Restrict database access** to application servers only
- **Limit Redis access** to internal network
- **Block unnecessary ports**
- **Use security groups** (AWS) or firewall rules

## Dependency Security

### Dependency Management

- **Regular updates** of dependencies
- **Security audits** (`npm audit`)
- **Dependency scanning** in CI/CD
- **Pin versions** in production

### Vulnerability Response

1. **Monitor** security advisories
2. **Assess** impact of vulnerabilities
3. **Update** dependencies promptly
4. **Test** after updates
5. **Deploy** security patches

## Security Testing

### Testing Practices

- **Penetration testing** (quarterly)
- **Security code reviews**
- **Automated security scanning**
- **Dependency vulnerability scanning**

### Common Vulnerabilities

**OWASP Top 10:**
1. Injection (SQL, NoSQL, etc.)
2. Broken Authentication
3. Sensitive Data Exposure
4. XML External Entities (XXE)
5. Broken Access Control
6. Security Misconfiguration
7. Cross-Site Scripting (XSS)
8. Insecure Deserialization
9. Using Components with Known Vulnerabilities
10. Insufficient Logging & Monitoring

## Incident Response

### Security Incident Procedure

1. **Identify** the incident
2. **Contain** the threat
3. **Assess** the damage
4. **Notify** stakeholders
5. **Remediate** vulnerabilities
6. **Document** the incident
7. **Review** and improve

### Breach Notification

- **Notify users** if personal data compromised
- **Report to authorities** if required (GDPR, etc.)
- **Document** all actions taken
- **Review** security measures

## Compliance

### Standards

- **SOC 2** (if applicable)
- **GDPR** (EU data)
- **Industry-specific** regulations
- **Company security policies**

### Security Checklist

- [ ] Authentication implemented
- [ ] Authorization configured
- [ ] Input validation in place
- [ ] SQL injection prevented
- [ ] XSS protection enabled
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Security headers set
- [ ] Secrets managed securely
- [ ] Audit logging enabled
- [ ] HTTPS enforced
- [ ] Dependencies updated
- [ ] Security testing performed

## Security Best Practices

### Development

- **Never commit secrets**
- **Use parameterized queries**
- **Validate all inputs**
- **Sanitize outputs**
- **Follow principle of least privilege**
- **Keep dependencies updated**

### Operations

- **Regular security audits**
- **Monitor for suspicious activity**
- **Keep systems patched**
- **Use strong passwords**
- **Enable MFA** (if available)
- **Regular backups**

### Code Review

- **Security-focused reviews**
- **Check for common vulnerabilities**
- **Verify input validation**
- **Review authentication/authorization**
- **Check for exposed secrets**

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Secrets Management Guide](SECRETS.md)
- [Deployment Security](DEPLOYMENT.md#security)

