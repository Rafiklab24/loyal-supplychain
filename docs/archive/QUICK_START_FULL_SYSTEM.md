# 🚀 Quick Start - Complete Loyal Supply Chain System

**Get the entire system running in 5 minutes**

---

## ✅ Prerequisites

- PostgreSQL 14+ running
- Node.js 18+
- npm

---

## 🎯 Step 1: Database Setup

```bash
# Create database
createdb loyal_supplychain

# Set environment variable
export DATABASE_URL="postgresql://rafik@localhost:5432/loyal_supplychain"

# Or create .env file in root
echo "DATABASE_URL=postgresql://rafik@localhost:5432/loyal_supplychain" > .env
```

---

## 🎯 Step 2: Run Migrations

```bash
cd app
npm install
npm run db:up
```

Expected output:
```
✓ Migration 001_master.sql applied
✓ Migration 002_logistics.sql applied
... (all migrations)
✅ All migrations completed
```

---

## 🎯 Step 3: Import Data

```bash
cd ..

# Import suppliers
npm run etl:suppliers

# Import shipments (arrivals board)
npm run etl:excel

# (Optional) Import transfers if you have the file
# npm run etl:transfers -- --file "path/to/حوالات.xlsx"
```

Expected output:
```
✅ Imported 74 suppliers
✅ Imported 376 shipments
```

---

## 🎯 Step 4: Start API Server

```bash
cd app
npm run dev
```

Server will start on: **http://localhost:3000**

Test it:
```bash
curl http://localhost:3000/api/health
```

---

## 🎯 Step 5: Start UI

Open a **new terminal window**:

```bash
cd vibe
npm install
npm run dev
```

UI will start on: **http://localhost:5173**

---

## 🎉 Step 6: Login & Explore

1. Open browser: **http://localhost:5173**
2. Login page will appear
3. Enter any username/password (mock auth)
4. Explore:
   - **Dashboard** - Stats overview
   - **Shipments** - Full list with filters
   - **Companies** - Suppliers and shipping lines
   - **Language Toggle** - Switch between Arabic/English

---

## 📊 System Status Check

### Check Database
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM logistics.shipments;"
```

### Check API
```bash
curl http://localhost:3000/api/health/stats | jq
```

### Check UI
Open: http://localhost:5173

---

## 🛑 Stop Everything

### Stop API Server
Press `Ctrl+C` in the API terminal

### Stop UI Server
Press `Ctrl+C` in the UI terminal

---

## 🔄 Full Restart

```bash
# Terminal 1: API
cd /Users/rafik/loyal-supplychain/app
npm run dev

# Terminal 2: UI
cd /Users/rafik/loyal-supplychain/vibe
npm run dev
```

---

## 📁 Project Structure

```
loyal-supplychain/
├── app/                        # Backend API
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/    # SQL migrations
│   │   │   ├── migrate.ts     # Migration runner
│   │   │   └── client.ts      # DB client
│   │   ├── routes/            # API endpoints
│   │   └── index.ts           # Express server
│   └── package.json
├── vibe/                       # Frontend UI
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API services
│   │   ├── hooks/             # React hooks
│   │   ├── i18n/              # Translations
│   │   └── App.tsx            # Main app
│   └── package.json
├── etl/                        # Data import scripts
│   ├── excel-loader.ts        # Import shipments
│   ├── suppliers-loader.ts    # Import suppliers
│   └── transfers-loader.ts    # Import transfers
├── data/                       # Excel files
│   ├── البضاعة القادمة محدث.xlsx
│   ├── LOYAL- SUPPLIER INDEX modified.xlsx
│   └── WorldFood 2025 Suppliers.xlsx
└── docs/                       # Documentation
```

---

## 🎯 Common Commands

### Database
```bash
# Run migrations
cd app && npm run db:up

# Connect to DB
psql $DATABASE_URL

# Check tables
psql $DATABASE_URL -c "\dt logistics.*"
```

### ETL
```bash
# Import suppliers
npm run etl:suppliers

# Import shipments
npm run etl:excel

# QA checks
npm run etl:qa
```

### API
```bash
cd app
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Run production build
```

### UI
```bash
cd vibe
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

---

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
brew services list

# Restart PostgreSQL
brew services restart postgresql@16

# Verify DATABASE_URL
echo $DATABASE_URL
```

### API Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### UI Port Already in Use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Migration Errors
```bash
# Check which migrations ran
psql $DATABASE_URL -c "SELECT * FROM security.migrations ORDER BY applied_at;"

# Drop and recreate database (WARNING: deletes all data)
dropdb loyal_supplychain
createdb loyal_supplychain
cd app && npm run db:up
```

---

## 📚 Documentation

| File | Description |
|------|-------------|
| `README.md` | Project overview |
| `QUICKSTART.md` | Database & ETL guide |
| `API.md` | API documentation |
| `VIBE_INTEGRATION.md` | Frontend integration guide |
| `IMPLEMENTATION_COMPLETE.md` | Backend summary |
| `VIBE_UI_COMPLETE.md` | Frontend summary |
| `QUICK_START_FULL_SYSTEM.md` | This guide |

---

## ✅ What You Have

- ✅ **PostgreSQL Database** with all schemas & tables
- ✅ **376 Shipments** imported from Excel
- ✅ **74 Suppliers** imported
- ✅ **REST API** with 11 endpoints
- ✅ **React UI** with Arabic/English support
- ✅ **RTL Layout** for Arabic
- ✅ **Responsive Design** for mobile/tablet/desktop
- ✅ **Real-Time Stats** dashboard
- ✅ **Shipment Management** with filters
- ✅ **Company Directory**

---

## 🎯 Next Steps

1. ✅ **Test the System** - Explore all pages
2. ⏳ **Add Real Data** - Import more shipments/transfers
3. ⏳ **Customize Branding** - Update colors, logo
4. ⏳ **Add Authentication** - Integrate JWT
5. ⏳ **Deploy to Production** - AWS or Vercel

---

## 🆘 Need Help?

Check these files:
- **Database Issues**: `DATABASE_SETUP.md`
- **API Issues**: `API.md`
- **UI Issues**: `vibe/README.md`
- **ETL Issues**: `etl/README.md`

---

**🎉 Congratulations! Your system is running!**

**Loyal International © 2025**

