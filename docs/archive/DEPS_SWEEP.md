# Loyal Supply Chain - Comprehensive Dependency Sweep

**Generated**: 2025-01-13  
**Codebase**: Monorepo (3 workspaces)

---

## Runtime & Core

| Component | Technology | Version | Notes |
|-----------|-----------|---------|-------|
| **Runtime** | Node.js | 20.x | Inferred from `@types/node@^20.0.0` (backend/ETL), `@types/node@^24.9.1` (frontend) |
| **Package Manager** | npm | — | Using `package-lock.json` in all workspaces |
| **TypeScript** | TypeScript | `^5.0.0` (BE/ETL), `~5.9.3` (FE) | Strict mode enabled across all projects |
| **Module System** | CommonJS | Backend/ETL | `"module": "commonjs"` in tsconfig |
| **Module System** | ESM | Frontend | `"type": "module"` in package.json |

---

## Backend API (`app/`)

### Production Dependencies (4)

| Package | Version | Category | Purpose |
|---------|---------|----------|---------|
| `express` | `^4.18.2` | Framework | Web server & REST API |
| `cors` | `^2.8.5` | Middleware | Cross-Origin Resource Sharing |
| `dotenv` | `^17.2.3` | Config | Environment variable loader |
| `pg` | `^8.11.3` | Database | PostgreSQL client (raw SQL, no ORM) |

### Development Dependencies (6)

| Package | Version | Category | Purpose |
|---------|---------|----------|---------|
| `typescript` | `^5.0.0` | Language | TypeScript compiler |
| `ts-node` | `^10.9.0` | Runtime | Execute TypeScript directly |
| `@types/node` | `^20.0.0` | Types | Node.js type definitions |
| `@types/express` | `^4.17.17` | Types | Express type definitions |
| `@types/cors` | `^2.8.13` | Types | CORS type definitions |
| `@types/pg` | `^8.10.0` | Types | PostgreSQL type definitions |

### Scripts

```json
{
  "start": "node dist/index.js",           // Production: Run compiled JS
  "dev": "ts-node src/index.ts",           // Development: Hot reload
  "build": "tsc",                           // Compile TypeScript to dist/
  "db:up": "ts-node src/db/migrate.ts up"  // Run database migrations
}
```

### TypeScript Config

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
```

---

## Frontend SPA (`vibe/`)

### Production Dependencies (11)

| Package | Version | Category | Purpose |
|---------|---------|----------|---------|
| **Core Framework** ||||
| `react` | `^19.1.1` | Framework | UI library |
| `react-dom` | `^19.1.1` | Framework | DOM renderer for React |
| **Routing** ||||
| `react-router-dom` | `^7.9.4` | Routing | Client-side routing (SPA mode) |
| **State Management** ||||
| `@tanstack/react-query` | `^5.90.5` | State | Server state management & caching |
| **HTTP Client** ||||
| `axios` | `^1.12.2` | HTTP | REST API calls |
| **Internationalization** ||||
| `i18next` | `^25.6.0` | i18n | Core i18n framework |
| `react-i18next` | `^16.2.1` | i18n | React bindings for i18next |
| `i18next-browser-languagedetector` | `^8.2.0` | i18n | Auto-detect browser language |
| **UI Components** ||||
| `@headlessui/react` | `^2.2.9` | UI | Unstyled accessible components |
| `@heroicons/react` | `^2.2.0` | Icons | SVG icon library |
| **Utilities** ||||
| `clsx` | `^2.1.1` | Utility | Conditional class names |
| `tailwind-merge` | `^3.3.1` | Utility | Merge Tailwind classes smartly |
| `date-fns` | `^4.1.0` | Date | Date manipulation & formatting |

### Development Dependencies (17)

| Package | Version | Category | Purpose |
|---------|---------|----------|---------|
| **Build Tool** ||||
| `vite` | `^7.1.7` | Build | Fast build tool & dev server |
| `@vitejs/plugin-react` | `^5.0.4` | Build | React plugin for Vite |
| **Styling** ||||
| `tailwindcss` | `^4.1.16` | CSS | Utility-first CSS framework |
| `@tailwindcss/postcss` | `^4.1.16` | CSS | PostCSS integration |
| `tailwindcss-rtl` | `^0.9.0` | CSS | Right-to-left (Arabic) support |
| `postcss` | `^8.5.6` | CSS | CSS preprocessor |
| `autoprefixer` | `^10.4.21` | CSS | Auto CSS vendor prefixes |
| **Linting** ||||
| `eslint` | `^9.36.0` | Lint | JavaScript/TypeScript linter |
| `@eslint/js` | `^9.36.0` | Lint | ESLint core JS rules |
| `typescript-eslint` | `^8.45.0` | Lint | TypeScript ESLint plugin |
| `eslint-plugin-react-hooks` | `^5.2.0` | Lint | React hooks rules |
| `eslint-plugin-react-refresh` | `^0.4.22` | Lint | React Fast Refresh rules |
| **TypeScript** ||||
| `typescript` | `~5.9.3` | Language | TypeScript compiler |
| `@types/node` | `^24.9.1` | Types | Node.js type definitions |
| `@types/react` | `^19.1.16` | Types | React type definitions |
| `@types/react-dom` | `^19.1.9` | Types | React DOM type definitions |
| **Other** ||||
| `globals` | `^16.4.0` | Config | Global variables for ESLint |

### Scripts

```json
{
  "dev": "vite",                    // Start dev server (HMR, port 5173)
  "build": "tsc -b && vite build",  // Type check + build for production
  "lint": "eslint .",               // Lint all files
  "preview": "vite preview"         // Preview production build locally
}
```

### TypeScript Config

Uses composite project with references:
- `tsconfig.app.json` - Application code (ES2020, strict mode)
- `tsconfig.node.json` - Vite config files (ESNext)
- Module: ESM (`"type": "module"` in package.json)

---

## ETL Scripts (`root/`)

### Production Dependencies (2)

| Package | Version | Category | Purpose |
|---------|---------|----------|---------|
| `pg` | `^8.11.3` | Database | PostgreSQL client for data import |
| `xlsx` | `^0.18.5` | Excel | Parse & write Excel files (.xlsx, .xls) |

### Development Dependencies (4)

| Package | Version | Category | Purpose |
|---------|---------|----------|---------|
| `typescript` | `^5.0.0` | Language | TypeScript compiler |
| `ts-node` | `^10.9.0` | Runtime | Execute TypeScript directly |
| `@types/node` | `^20.0.0` | Types | Node.js type definitions |
| `@types/pg` | `^8.10.0` | Types | PostgreSQL type definitions |

### Scripts

```json
{
  "etl:excel": "ts-node etl/excel-loader.ts",        // Import shipments from Excel
  "etl:suppliers": "ts-node etl/suppliers-loader.ts", // Import suppliers
  "etl:transfers": "ts-node etl/transfers-loader.ts", // Import financial transfers
  "etl:qa": "ts-node etl/qa-checks.ts"               // Run data quality checks
}
```

---

## Dependency Analysis

### By Category

| Category | Count | Packages |
|----------|-------|----------|
| **Framework** | 3 | express, react, react-dom |
| **Build Tools** | 2 | vite, tsc (TypeScript) |
| **Database** | 1 | pg (used in 3 workspaces) |
| **HTTP** | 2 | axios (client), express (server) |
| **i18n** | 3 | i18next, react-i18next, i18next-browser-languagedetector |
| **Styling** | 7 | tailwindcss, @tailwindcss/postcss, tailwindcss-rtl, postcss, autoprefixer, clsx, tailwind-merge |
| **UI Components** | 2 | @headlessui/react, @heroicons/react |
| **Routing** | 1 | react-router-dom |
| **State Management** | 1 | @tanstack/react-query |
| **Date/Time** | 1 | date-fns |
| **Excel** | 1 | xlsx |
| **Config** | 2 | dotenv, cors |
| **Dev Tools** | 10 | eslint (+ plugins), typescript, ts-node, @types/* |

### Missing (Critical)

| Category | Status | Impact |
|----------|--------|--------|
| **ORM** | ❌ None | Raw SQL everywhere, no type safety on queries |
| **Auth Library** | ❌ None | Mock localStorage auth (security risk) |
| **Validation** | ❌ None | No Zod, Yup, or Joi (manual validation only) |
| **Testing** | ❌ None | No Jest, Vitest, React Testing Library |
| **PDF** | ❌ None | Cannot generate or view PDFs |
| **File Upload** | ❌ None | No AWS SDK, multer, or multipart handling |
| **OCR/AI** | ❌ None | No Tesseract, Google Vision, OpenAI |
| **Email/SMS** | ❌ None | No nodemailer, SendGrid, Twilio |
| **Job Queue** | ❌ None | No BullMQ, Bull, or agenda |
| **Monitoring** | ❌ None | No Sentry, Winston, or error tracking |
| **Rate Limiting** | ❌ None | API vulnerable to abuse |
| **Caching** | ❌ None | No Redis or in-memory cache |

---

## Version Compatibility Matrix

| Dependency | Current | Latest Stable | Breaking Changes? |
|-----------|---------|---------------|-------------------|
| `react` | 19.1.1 | 19.1.x | ✅ On latest |
| `vite` | 7.1.7 | 7.1.x | ✅ On latest |
| `express` | 4.18.2 | 4.21.x | ⚠️ Minor update available |
| `axios` | 1.12.2 | 1.7.x | ⚠️ Several minor versions behind |
| `pg` | 8.11.3 | 8.13.x | ⚠️ Minor update available |
| `tailwindcss` | 4.1.16 | 4.1.x | ✅ On latest v4 |
| `typescript` | 5.0.0 (BE), 5.9.3 (FE) | 5.7.x | ⚠️ FE on latest, BE outdated |
| `i18next` | 25.6.0 | 25.x | ✅ On latest |
| `date-fns` | 4.1.0 | 4.1.x | ✅ On latest |

---

## Package Manager Details

### npm (All Workspaces)

- **Lockfile**: `package-lock.json` (lockfileVersion 2 or 3)
- **Workspaces**: None (separate package.json in each directory)
- **Hoisting**: None (each workspace has isolated node_modules)

### Installation Commands

```bash
# Root (ETL)
npm install

# Backend API
cd app && npm install

# Frontend
cd vibe && npm install
```

---

## Recommended Upgrades

### High Priority

1. **Add Testing Framework**
   ```bash
   # Backend
   npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
   
   # Frontend
   npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
   ```

2. **Add Request Validation**
   ```bash
   # Backend
   npm install zod express-validator
   ```

3. **Add Auth Library**
   ```bash
   # Backend
   npm install jsonwebtoken bcrypt
   npm install --save-dev @types/jsonwebtoken @types/bcrypt
   ```

4. **Add Rate Limiting**
   ```bash
   # Backend
   npm install express-rate-limit
   ```

### Medium Priority

5. **Add File Upload**
   ```bash
   # Backend
   npm install multer @aws-sdk/client-s3
   npm install --save-dev @types/multer
   ```

6. **Add Monitoring**
   ```bash
   # Backend
   npm install @sentry/node winston
   ```

7. **Upgrade Outdated Packages**
   ```bash
   npm update axios express typescript pg
   ```

---

## Dependency Tree (Simplified)

```
loyal-supplychain/
├── app/ (Backend API)
│   ├── express (+ cors, dotenv)
│   ├── pg (PostgreSQL)
│   └── typescript (+ ts-node, @types/*)
│
├── vibe/ (Frontend SPA)
│   ├── react (+ react-dom, react-router-dom)
│   ├── vite (+ @vitejs/plugin-react)
│   ├── @tanstack/react-query
│   ├── axios
│   ├── i18next (+ react-i18next, detector)
│   ├── @headlessui/react (+ @heroicons/react)
│   ├── tailwindcss (+ rtl, postcss, autoprefixer)
│   ├── date-fns, clsx, tailwind-merge
│   └── typescript (+ eslint, @types/*)
│
└── etl/ (ETL Scripts)
    ├── pg (PostgreSQL)
    ├── xlsx (Excel)
    └── typescript (+ ts-node, @types/*)
```

---

**End of Dependency Sweep**

