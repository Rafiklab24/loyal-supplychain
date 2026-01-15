# 🚀 START LOYAL SUPPLY CHAIN SYSTEM

## Quick Start Guide

### ✅ Prerequisites
- PostgreSQL running on port 5432
- Database `loyal_supplychain` exists
- Node.js and npm installed

---

## 📋 Step-by-Step Instructions

### 1️⃣ **Open Terminal Window #1 - API Server**

Copy and paste these commands:

```bash
cd /Users/rafik/loyal-supplychain/app
npm run dev
```

**Expected Output:**
```
Database connected successfully
Server running on port 3000
```

---

### 2️⃣ **Open Terminal Window #2 - UI Server**

Copy and paste these commands:

```bash
cd /Users/rafik/loyal-supplychain/vibe
npm run dev
```

**Expected Output:**
```
VITE v7.1.12 ready in XXX ms
➜ Local:   http://localhost:5173/
```

---

### 3️⃣ **Open Your Browser**

Navigate to: **http://localhost:5173**

---

### 4️⃣ **Login**

You'll see a login page with TWO buttons:

1. **Blue Button** (تسجيل الدخول) - Regular login
   - Fill in any username and password
   - Click this button

2. **Green Button** (🚀 تسجيل دخول سريع) - Quick login
   - **CLICK THIS ONE** - Logs you in instantly!

---

## 🎉 You Should See

After clicking the green button:

- **Dashboard** with statistics
- **376 Shipments** imported
- **74 Suppliers**
- **Top Ports** lists
- Navigation sidebar on the right (Arabic RTL)

---

## 🔍 Troubleshooting

### Problem: API won't start - "DATABASE_URL required"

**Solution:**
```bash
cd /Users/rafik/loyal-supplychain/app
echo "DATABASE_URL=postgresql://rafik@localhost:5432/loyal_supplychain" > .env
npm run dev
```

### Problem: Port 3000 already in use

**Solution:**
```bash
lsof -ti:3000 | xargs kill -9
cd /Users/rafik/loyal-supplychain/app
npm run dev
```

### Problem: Port 5173 already in use

**Solution:**
```bash
lsof -ti:5173 | xargs kill -9
cd /Users/rafik/loyal-supplychain/vibe
npm run dev
```

### Problem: Can't connect to database

**Solution:**
```bash
# Check if PostgreSQL is running
brew services list

# Start PostgreSQL if needed
brew services start postgresql@16

# Verify database exists
psql -l | grep loyal_supplychain
```

---

## 🎯 Quick Commands

### Stop Everything
Press `Ctrl+C` in each terminal window

### Restart Everything
1. Close both terminal windows
2. Follow steps 1️⃣ and 2️⃣ again

---

## 📊 System URLs

| Service | URL | Status Check |
|---------|-----|--------------|
| **UI** | http://localhost:5173 | Open in browser |
| **API** | http://localhost:3000/api | `curl http://localhost:3000/api/health` |
| **API Health** | http://localhost:3000/api/health | Check connection |
| **API Stats** | http://localhost:3000/api/health/stats | Check data |

---

## ✅ Verification

Run these commands to verify everything is working:

```bash
# Test API
curl http://localhost:3000/api/health

# Test API Stats
curl http://localhost:3000/api/health/stats | jq

# Check if UI is running
curl -I http://localhost:5173
```

---

## 🎨 Features Available

Once logged in, you can:

1. **Dashboard** (`/`)
   - View overall statistics
   - See top origin and destination ports

2. **Shipments** (`/shipments`)
   - Browse all 376 shipments
   - Search by contract number
   - Filter by status
   - Click any row to see details

3. **Shipment Details** (`/shipments/:id`)
   - Complete shipment information
   - Financial summary
   - Product details
   - Locations and dates

4. **Companies** (`/companies`)
   - View all companies
   - Filter by Suppliers
   - Filter by Shipping Lines
   - Search by name

5. **Language Toggle**
   - Click button in header to switch Arabic ↔ English
   - Layout changes to RTL/LTR automatically

---

## 🆘 Need Help?

If something doesn't work:

1. Check both terminal windows for error messages
2. Make sure PostgreSQL is running
3. Verify the database exists
4. Check that ports 3000 and 5173 are not in use
5. Try restarting both servers

---

**Happy Managing! 🎉**

**Loyal International Supply Chain System © 2025**

