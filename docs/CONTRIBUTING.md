# Contributing Guide

Thank you for your interest in contributing to the Loyal Supply Chain project! This guide will help you get started.

## Getting Started

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/your-username/loyal-supplychain.git
   cd loyal-supplychain
   ```

3. **Set up development environment:**
   ```bash
   # Install dependencies
   npm install
   cd app && npm install
   cd ../vibe && npm install
   
   # Set up environment variables
   cd app
   cp .env.example .env
   # Edit .env with your configuration
   
   # Run migrations
   npm run db:up
   ```

4. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### 1. Make Changes

- Write clean, readable code
- Follow the code style guidelines
- Add tests for new features
- Update documentation

### 2. Test Your Changes

```bash
# Backend tests
cd app
npm test
npm run lint

# Frontend tests
cd vibe
npm test
npm run lint
```

### 3. Commit Your Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve database connection issue"
git commit -m "docs: update API documentation"
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 4. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Code Style

### TypeScript

- Use TypeScript strict mode
- Avoid `any` types
- Use interfaces for object shapes
- Use enums for constants

### Formatting

- Use Prettier for formatting
- Run `npm run format` before committing
- Pre-commit hooks will auto-format

### Linting

- Follow ESLint rules
- Fix linting errors before committing
- Pre-commit hooks will check linting

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] No sensitive data in code

### PR Description

Include:
- **What** - What changes were made
- **Why** - Why these changes were needed
- **How** - How the changes were implemented
- **Testing** - How to test the changes

### Review Process

1. **Automated checks** - CI/CD runs tests and linting
2. **Code review** - Team members review the code
3. **Approval** - At least one approval required
4. **Merge** - Squash and merge to `develop`

## Coding Standards

### Naming Conventions

- **Files**: `camelCase.ts` or `PascalCase.tsx`
- **Functions**: `camelCase`
- **Classes**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Variables**: `camelCase`

### Code Organization

- **One file per component/class**
- **Group related functions**
- **Use meaningful names**
- **Keep functions small and focused**

### Comments

- **Document complex logic**
- **Explain "why" not "what"**
- **Use JSDoc for functions**
- **Keep comments up to date**

## Testing Requirements

### Unit Tests

- Write tests for all new functions
- Aim for >80% code coverage
- Test edge cases and error conditions

### Integration Tests

- Test API endpoints
- Test database interactions
- Test error handling

### E2E Tests

- Test critical user workflows
- Test new features end-to-end

## Documentation

### Code Documentation

- Document public APIs
- Use JSDoc for functions
- Add comments for complex logic

### API Documentation

- Document new endpoints with Swagger
- Update API.md if needed
- Include request/response examples

### User Documentation

- Update README.md if needed
- Add to relevant docs/ files
- Include examples

## Issue Reporting

### Bug Reports

Include:
- **Description** - What happened
- **Steps to reproduce** - How to reproduce
- **Expected behavior** - What should happen
- **Actual behavior** - What actually happened
- **Environment** - OS, Node version, etc.
- **Screenshots** - If applicable

### Feature Requests

Include:
- **Description** - What feature you want
- **Use case** - Why this feature is needed
- **Proposed solution** - How it could work
- **Alternatives** - Other solutions considered

## Communication

### Questions

- Check existing documentation first
- Search existing issues
- Ask in discussions or create an issue

### Discussions

- Use GitHub Discussions for questions
- Be respectful and constructive
- Help others when possible

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Appreciated by the team!

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the project

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal attacks
- Any other unprofessional conduct

## Getting Help

- **Documentation**: Check `docs/` directory
- **Issues**: Search existing issues
- **Discussions**: Ask in GitHub Discussions
- **Email**: Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

Thank you for contributing! 🎉

