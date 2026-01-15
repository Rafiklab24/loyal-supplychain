# 📁 Environment Files Guide

## ✅ Current Setup (After Cleanup)

Your project now has **3 environment files**, each serving a specific purpose:

---

## 1. `/app/.env` - Backend API Configuration

**Purpose**: Used by the Node.js/Express backend server  
**Loaded by**: `app/src/index.ts` via `dotenv/config`

**Configuration**:
```bash
# Database Configuration
DATABASE_URL=postgresql://rafik@localhost:5432/loyal_supplychain

# Server Configuration
PORT=3000
NODE_ENV=development

# OpenAI Configuration (for AI-powered document extraction)
OPENAI_API_KEY=your-api-key-here  # ⚠️ REPLACE WITH YOUR ACTUAL KEY
OPENAI_MODEL=gpt-4-vision-preview
OPENAI_MAX_TOKENS=4096

# File Upload Configuration
UPLOAD_DIR=./uploads/temp
MAX_FILE_SIZE=10485760

# Training Data Collection (for future local model)
TRAINING_DATA_DIR=./training_data
ENABLE_DATA_COLLECTION=true
```

### ⚠️ **ACTION REQUIRED**
Replace `your-api-key-here` with your actual OpenAI API key:
1. Get key from: https://platform.openai.com/api-keys
2. Edit: `app/.env`
3. Replace `OPENAI_API_KEY=your-api-key-here` with `OPENAI_API_KEY=sk-...`
4. Restart backend: `cd app && npm run dev`

---

## 2. `/vibe/.env` - Frontend Configuration

**Purpose**: Used by Vite frontend build system  
**Loaded by**: Vite automatically loads this file

**Configuration**:
```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

**Note**: Any frontend environment variables must be prefixed with `VITE_` to be exposed to the client-side code.

---

## 3. `/.env.example` - Documentation Template

**Purpose**: Example/template for developers  
**Status**: Not loaded by any application (documentation only)

**Contents**:
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=loyal_supplychain
DB_USER=
DB_PASSWORD=

# API
PORT=3000
NODE_ENV=development

# AWS (optional)
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

**Note**: This file shows the old style of configuration. The actual app uses `DATABASE_URL` connection string instead.

---

## 🗑️ Removed Files

### `/.env` (Root level) - **DELETED** ✅

**Why removed**: 
- Duplicate of `app/.env`
- Not used by ETL scripts (they read DATABASE_URL from environment)
- Not used by backend (uses `app/.env` instead)
- Caused confusion with multiple .env files

---

## 📊 Environment Variable Flow

```
┌─────────────────────────────────────────────────┐
│  Development Workflow                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Terminal 1: Backend Server                    │
│  ┌──────────────────────────┐                  │
│  │ cd app                   │                  │
│  │ npm run dev              │                  │
│  └────────┬─────────────────┘                  │
│           │                                     │
│           ├─> Loads: app/.env                  │
│           ├─> Connects to: PostgreSQL          │
│           ├─> Starts on: PORT=3000             │
│           └─> AI calls: OPENAI_API_KEY         │
│                                                 │
│  Terminal 2: Frontend Server                   │
│  ┌──────────────────────────┐                  │
│  │ cd vibe                  │                  │
│  │ npm run dev              │                  │
│  └────────┬─────────────────┘                  │
│           │                                     │
│           ├─> Loads: vibe/.env                 │
│           ├─> API URL: VITE_API_BASE_URL       │
│           └─> Starts on: localhost:5173        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔐 Security Best Practices

### ✅ Already Implemented
- `.env` files are in `.gitignore` (won't be committed)
- `.env` files are in `.cursorignore` (protected from AI tools)
- `.env.example` is committed (safe template)

### 🚨 Never Do This
- ❌ Don't commit `.env` files with real credentials
- ❌ Don't share API keys in chat/email
- ❌ Don't hardcode credentials in source code

### ✅ Best Practices
- ✅ Use different keys for development/production
- ✅ Rotate API keys periodically
- ✅ Monitor OpenAI usage dashboard
- ✅ Set spending limits on OpenAI account

---

## 🧪 Testing Configuration

### Verify Backend .env
```bash
cd app
node -e "require('dotenv').config(); console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'); console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');"
```

### Verify Frontend .env
```bash
cd vibe
cat .env
```

### Test Backend Connection
```bash
cd app
npm run dev
# Should start without errors
```

---

## 🎯 Next Steps

1. **Add OpenAI API Key** to `app/.env`
2. **Restart Backend** server
3. **Test AI Extraction** at http://localhost:5173/contracts/new

---

## 📚 Related Documentation

- **Setup Guide**: `GPT4_VISION_SETUP_GUIDE.md`
- **Complete Status**: `SETUP_COMPLETE.md`
- **Implementation**: `GPT4_VISION_IMPLEMENTATION_COMPLETE.md`

---

**Summary**: Clean, organized, and ready for development! 🎉

