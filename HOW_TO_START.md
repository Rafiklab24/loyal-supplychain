# 🚀 How to Start the Loyal Supply Chain Web App

## ✅ Prerequisites Check

All dependencies are already installed! ✅
- Root ETL dependencies: ✅ Installed
- Backend API dependencies: ✅ Installed  
- Frontend UI dependencies: ✅ Installed

## 🎯 Quick Start (Easiest Method)

### Option 1: Start Everything Automatically

```bash
cd /Users/rafik/loyal-supplychain
./START.sh
```

This will:
- ✅ Open 2 new terminal windows
- ✅ Start backend API on port 3000
- ✅ Start frontend UI on port 5173
- ✅ Open browser to http://localhost:5173

---

## 🔧 Manual Start (If You Prefer)

### Option 2: Start Backend and Frontend Separately

**Terminal 1 - Backend API:**
```bash
cd /Users/rafik/loyal-supplychain
./scripts/START_BACKEND.sh
```

**Terminal 2 - Frontend UI:**
```bash
cd /Users/rafik/loyal-supplychain
./scripts/START_FRONTEND.sh
```

Then open your browser to: **http://localhost:5173**

---

## 🎨 Using the Web App

1. **Login Page**
   - Enter any username (e.g., "admin")
   - Enter any password (e.g., "password")
   - Click "Login" (it's mock authentication for now)

2. **Dashboard** 
   - View statistics: total shipments, value, weight, suppliers
   - See top origin and destination ports
   - Arabic/English toggle in top-right

3. **Shipments Page**
   - Browse all 376 imported shipments
   - Filter by status, search by SN or product
   - Click any row to see details
   - Pagination at bottom

4. **Shipment Detail Page**
   - Product details and financial summary
   - Origin/destination ports
   - Shipping line information
   - Notes and dates

5. **Companies Page**
   - Browse all companies
   - Switch between tabs: All / Suppliers / Shipping Lines
   - See 74 suppliers imported from Excel

6. **Language Toggle**
   - Click "English" / "العربية" button in header
   - Entire UI switches between Arabic (RTL) and English (LTR)

---

## 🛑 How to Stop

Press `Ctrl+C` in each terminal window to stop the servers.

---

## 🐛 Troubleshooting

### Port Already in Use

If you get "port already in use" error:

```bash
# Kill process on port 3000 (backend)
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9
```

### Database Connection Error

Make sure PostgreSQL is running:

```bash
# Check PostgreSQL status
brew services list

# Start PostgreSQL if needed
brew services start postgresql@16
```

### Can't Find npm/node

Make sure Node.js is installed:

```bash
node --version
npm --version
```

If not installed, install via Homebrew:

```bash
brew install node
```

---

## 📊 System URLs

| Service | URL | Status |
|---------|-----|--------|
| Frontend UI | http://localhost:5173 | ✅ |
| Backend API | http://localhost:3000 | ✅ |
| API Health Check | http://localhost:3000/api/health | ✅ |
| API Stats | http://localhost:3000/api/health/stats | ✅ |

---

## 🎉 Features to Try

1. **Search**: Search for shipments by SN or product name
2. **Filter**: Filter by status (sailed, arrived, delivered, etc.)
3. **Language**: Toggle between Arabic and English
4. **Responsive**: Resize browser to see mobile layout
5. **Navigation**: Use sidebar to navigate between pages
6. **Details**: Click any shipment to see full details

---

**Enjoy exploring your Loyal Supply Chain system!** 🚀

