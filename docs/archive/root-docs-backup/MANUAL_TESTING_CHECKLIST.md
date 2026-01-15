# Manual Testing Checklist

## Prerequisites

Before starting manual testing:

1. **Backend Setup**
   ```bash
   cd /Users/rafik/loyal-supplychain/app
   
   # Add JWT_SECRET to .env
   echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex')")" >> .env
   
   # Start backend
   npm run dev
   ```

2. **Frontend Setup**
   ```bash
   cd /Users/rafik/loyal-supplychain/vibe
   npm run dev
   ```

3. **Create Test User**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "username": "testadmin",
       "password": "Test123!@#",
       "name": "Test Administrator",
       "role": "Admin"
     }'
   ```

## Test Execution

### Module 1: Authentication ✓

#### Test 1.1: Login Flow
- [ ] Navigate to http://localhost:5173/login
- [ ] Enter valid credentials (testadmin / Test123!@#)
- [ ] Click "Login"
- [ ] **Expected**: Redirected to dashboard
- [ ] **Expected**: User name displayed in header
- [ ] Refresh page
- [ ] **Expected**: Still logged in (token persists)

#### Test 1.2: Invalid Login
- [ ] Navigate to http://localhost:5173/login
- [ ] Enter wrong password
- [ ] **Expected**: Error message displayed
- [ ] **Expected**: Not redirected

#### Test 1.3: Protected Routes
- [ ] Logout
- [ ] Try to access http://localhost:5173/shipments directly
- [ ] **Expected**: Redirected to login page

#### Test 1.4: Logout
- [ ] Login successfully
- [ ] Click logout in header
- [ ] **Expected**: Redirected to login
- [ ] **Expected**: Token cleared from localStorage

### Module 2: Shipments

#### Test 2.1: List Shipments
- [ ] Login and navigate to Shipments
- [ ] **Expected**: List of shipments displayed
- [ ] **Expected**: Pagination controls visible
- [ ] Test pagination (next/previous page)
- [ ] **Expected**: Page number updates

#### Test 2.2: Filter Shipments
- [ ] Use status filter
- [ ] **Expected**: Results filtered correctly
- [ ] Use port filter
- [ ] **Expected**: Results filtered correctly
- [ ] Clear filters
- [ ] **Expected**: All shipments shown

#### Test 2.3: Search Shipments
- [ ] Enter search term in search box
- [ ] **Expected**: Results match search term
- [ ] Try searching by SN, product, port name
- [ ] **Expected**: Relevant results returned

#### Test 2.4: Create Shipment
- [ ] Click "New Shipment" button
- [ ] Fill in required fields
- [ ] Submit form
- [ ] **Expected**: Success message
- [ ] **Expected**: New shipment appears in list

#### Test 2.5: Edit Shipment
- [ ] Click on a shipment
- [ ] Click "Edit" button
- [ ] Modify fields
- [ ] Save changes
- [ ] **Expected**: Changes saved
- [ ] **Expected**: Updates visible in list

### Module 3: Contracts

#### Test 3.1: List Contracts
- [ ] Navigate to Contracts page
- [ ] **Expected**: List of contracts displayed
- [ ] **Expected**: Contract numbers, dates, parties visible

#### Test 3.2: Create Contract
- [ ] Click "New Contract"
- [ ] Enter contract details (number, buyer, seller)
- [ ] Add product lines
- [ ] Save contract
- [ ] **Expected**: Contract created successfully
- [ ] **Expected**: Appears in contracts list

#### Test 3.3: Add Contract Lines
- [ ] Open existing contract
- [ ] Add new product line
- [ ] Enter quantity, price, UOM
- [ ] Save
- [ ] **Expected**: Line added to contract

#### Test 3.4: Payment Schedules
- [ ] Open contract
- [ ] Navigate to payment schedule tab
- [ ] Add payment milestone
- [ ] **Expected**: Milestone added
- [ ] **Expected**: Percentages sum correctly

### Module 4: Finance

#### Test 4.1: List Transactions
- [ ] Navigate to Finance page
- [ ] **Expected**: Transactions displayed
- [ ] **Expected**: Balance calculations visible

#### Test 4.2: Create Transaction
- [ ] Click "New Transaction"
- [ ] Select direction (in/out)
- [ ] Enter amount, date, fund
- [ ] Link to shipment (optional)
- [ ] Save
- [ ] **Expected**: Transaction created
- [ ] **Expected**: Balance updated

#### Test 4.3: Filter Transactions
- [ ] Filter by date range
- [ ] **Expected**: Transactions within range shown
- [ ] Filter by direction
- [ ] **Expected**: Only in or out transactions shown
- [ ] Filter by fund
- [ ] **Expected**: Fund-specific transactions shown

#### Test 4.4: Balance Calculations
- [ ] Create a few test transactions
- [ ] **Expected**: Total in/out/balance correct
- [ ] Link transaction to shipment
- [ ] **Expected**: Shipment balance updated

### Module 5: Companies

#### Test 5.1: List Companies
- [ ] Navigate to Companies page
- [ ] **Expected**: Companies displayed
- [ ] **Expected**: Role badges visible (supplier, customer, etc.)

#### Test 5.2: Create Company
- [ ] Click "New Company"
- [ ] Enter name, country, roles
- [ ] Save
- [ ] **Expected**: Company created
- [ ] **Expected**: Appears in list

#### Test 5.3: Filter by Role
- [ ] Filter by "Suppliers"
- [ ] **Expected**: Only suppliers shown
- [ ] Filter by "Customers"
- [ ] **Expected**: Only customers shown

#### Test 5.4: Edit Company
- [ ] Click on company
- [ ] Edit details
- [ ] Save
- [ ] **Expected**: Changes saved

### Module 6: Documents

#### Test 6.1: Upload Document
- [ ] Navigate to a shipment/contract
- [ ] Click "Upload Document"
- [ ] Select PDF file
- [ ] Choose document type
- [ ] Upload
- [ ] **Expected**: Document uploaded
- [ ] **Expected**: Appears in documents list

#### Test 6.2: AI Extraction (Proforma)
- [ ] Upload proforma invoice
- [ ] **Expected**: AI extraction starts
- [ ] **Expected**: Fields populated automatically
- [ ] Review extracted data
- [ ] **Expected**: Data accurate

#### Test 6.3: View/Download Document
- [ ] Click on uploaded document
- [ ] **Expected**: Document opens/downloads
- [ ] **Expected**: Correct file type

### Module 7: Notifications

#### Test 7.1: View Notifications
- [ ] Check notifications icon
- [ ] **Expected**: Notification count displayed
- [ ] Click to view notifications
- [ ] **Expected**: List of notifications

#### Test 7.2: Mark as Read
- [ ] Click on unread notification
- [ ] **Expected**: Marked as read
- [ ] **Expected**: Count decremented

### Module 8: Tasks

#### Test 8.1: View Tasks
- [ ] Navigate to Tasks page
- [ ] **Expected**: Tasks displayed
- [ ] **Expected**: Filtered by user role

#### Test 8.2: Create Task
- [ ] Click "New Task"
- [ ] Enter task details
- [ ] Assign to role
- [ ] Save
- [ ] **Expected**: Task created

#### Test 8.3: Complete Task
- [ ] Click task checkbox
- [ ] **Expected**: Task marked complete
- [ ] **Expected**: Moves to completed section

### Module 9: Analytics/Dashboard

#### Test 9.1: View Dashboard
- [ ] Navigate to home/dashboard
- [ ] **Expected**: Stats cards displayed
- [ ] **Expected**: Charts render correctly

#### Test 9.2: Dashboard Stats
- [ ] Check shipments count
- [ ] Check contracts count
- [ ] Check financial totals
- [ ] **Expected**: Numbers match database

### Module 10: Internationalization

#### Test 10.1: Language Switching
- [ ] Click language switcher
- [ ] Switch to Arabic
- [ ] **Expected**: UI text in Arabic
- [ ] **Expected**: Layout RTL
- [ ] Switch back to English
- [ ] **Expected**: UI text in English
- [ ] **Expected**: Layout LTR

#### Test 10.2: RTL Layout
- [ ] Switch to Arabic
- [ ] Check all pages
- [ ] **Expected**: Navigation on right
- [ ] **Expected**: Text aligned right
- [ ] **Expected**: Icons flipped correctly

## Cross-Browser Testing

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Responsive Design Testing

Test at breakpoints:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

## Security Testing

### Test S.1: Authentication Bypass
- [ ] Try accessing /api/shipments without login
- [ ] **Expected**: 401 Unauthorized
- [ ] Try with invalid token
- [ ] **Expected**: 403 Forbidden

### Test S.2: SQL Injection
- [ ] Enter `' OR '1'='1` in search fields
- [ ] **Expected**: No error, no data leak
- [ ] Try in all input fields
- [ ] **Expected**: Handled safely

### Test S.3: XSS Attack
- [ ] Enter `<script>alert('XSS')</script>` in text fields
- [ ] **Expected**: Script not executed
- [ ] **Expected**: Text displayed as-is

### Test S.4: File Upload Security
- [ ] Try uploading .exe file
- [ ] **Expected**: Rejected
- [ ] Try uploading file >10MB
- [ ] **Expected**: Rejected
- [ ] Try uploading with malicious filename
- [ ] **Expected**: Sanitized

### Test S.5: Rate Limiting
- [ ] Make 10 rapid login attempts
- [ ] **Expected**: Rate limit error after 5 attempts
- [ ] Wait 15 minutes
- [ ] **Expected**: Can login again

## Performance Testing

### Test P.1: Page Load Times
- [ ] Measure dashboard load time
- [ ] **Expected**: <2 seconds
- [ ] Measure shipments list (100 items)
- [ ] **Expected**: <3 seconds

### Test P.2: Large Data Sets
- [ ] Load page with 1000+ shipments
- [ ] **Expected**: Pagination works
- [ ] **Expected**: No browser freeze

## Error Handling

### Test E.1: Network Errors
- [ ] Stop backend server
- [ ] Try to perform actions
- [ ] **Expected**: Error messages displayed
- [ ] **Expected**: No white screen

### Test E.2: Invalid Data
- [ ] Submit form with missing required fields
- [ ] **Expected**: Validation errors shown
- [ ] Enter invalid email format
- [ ] **Expected**: Format validation

### Test E.3: Database Errors
- [ ] Stop database
- [ ] Try to load data
- [ ] **Expected**: Graceful error message

## Audit Logging

### Test A.1: Change Tracking
- [ ] Edit a shipment
- [ ] Check audit log
- [ ] **Expected**: Change recorded
- [ ] **Expected**: Old and new values captured

### Test A.2: User Attribution
- [ ] Make changes as different users
- [ ] **Expected**: User recorded in audit log

## Final Checklist

- [ ] All modules tested
- [ ] All security tests passed
- [ ] No console errors in browser
- [ ] No 500 errors in backend logs
- [ ] All data persists correctly
- [ ] All forms validate properly
- [ ] All links/buttons work
- [ ] Authentication works correctly
- [ ] Logout works correctly
- [ ] Session persists on refresh
- [ ] Mobile responsive
- [ ] RTL layout works in Arabic
- [ ] Performance acceptable
- [ ] No data leaks or security issues

## Sign-Off

**Tester Name**: _________________
**Date**: _________________
**Status**: [ ] PASS [ ] FAIL [ ] CONDITIONAL

**Notes**:
_______________________________________________
_______________________________________________
_______________________________________________

