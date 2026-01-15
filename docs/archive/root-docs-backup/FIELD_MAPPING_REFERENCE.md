# Field Mapping Reference - Frontend ↔ Database

**Purpose**: Quick reference for mapping frontend form fields to database columns.  
**Status**: Pending full audit  

---

## 🎯 Mapping Strategy

The database has been normalized. Key mapping changes:

| Old Location (shipments) | New Location |
|-------------------------|--------------|
| supplier_id | shipment_parties.supplier_id |
| customer_id | shipment_parties.customer_id |
| shipping_line_id | shipment_parties.shipping_line_id |
| final_beneficiary_* | shipment_parties.final_beneficiary_* |
| product_text, weight_ton | shipment_cargo.* |
| containers, lines (JSONB) | shipment_cargo.* |
| pol_id, pod_id | shipment_logistics.* |
| eta, etd, bl_no, vessel_name | shipment_logistics.* |
| total_value_usd, paid_value_usd | shipment_financials.* |
| payment_method, lc_number | shipment_financials.* |
| documents (JSONB) | shipment_documents.* |

---

## 📂 Frontend Components to Audit

### Shipment Wizard
| Component | Path | Expected DB Tables |
|-----------|------|-------------------|
| Step1BasicInfo.tsx | vibe/src/components/shipments/wizard/ | shipments, shipment_parties |
| Step2Transport.tsx | vibe/src/components/shipments/wizard/ | shipment_logistics, shipment_cargo |
| Step3Financials.tsx | vibe/src/components/shipments/wizard/ | shipment_financials |
| Step4Documents.tsx | vibe/src/components/shipments/wizard/ | shipment_documents |

### Contract Wizard
| Component | Path | Expected DB Tables |
|-----------|------|-------------------|
| Step1CommercialPartiesV2.tsx | vibe/src/components/contracts/wizard/ | contracts, companies |
| Step2ProductLines.tsx | vibe/src/components/contracts/wizard/ | contract_lines, products |
| Step3PaymentTerms.tsx | vibe/src/components/contracts/wizard/ | payment_schedules |

### Customs Components
| Component | Path | Expected DB Tables |
|-----------|------|-------------------|
| CustomsClearingCostModal.tsx | vibe/src/components/customs/ | customs_clearing_costs |
| FileFirstCostEntry.tsx | vibe/src/components/customs/ | customs_clearing_costs |
| PendingClearancesTable.tsx | vibe/src/components/customs/ | customs_clearing_costs, shipments |

---

## 🔗 API Routes to Check

| Route | Method | Frontend Usage | DB Operations |
|-------|--------|----------------|---------------|
| /api/shipments | POST | Create shipment | INSERT shipments + normalized tables |
| /api/shipments/:id | PUT | Update shipment | UPDATE shipments + sync trigger |
| /api/shipments/:id | GET | View shipment | SELECT from v_shipments_unified |
| /api/contracts | POST/PUT | Contract CRUD | contracts, contract_lines |
| /api/proformas | POST/PUT | Proforma CRUD | proforma_invoices, proforma_lines |
| /api/transactions | POST | Financial entry | finance.transactions |
| /api/customs-costs | POST | Customs costs | finance.customs_clearing_costs |

---

## 🗃️ Database Column Naming Conventions

| Frontend (camelCase) | API (camelCase) | Database (snake_case) |
|---------------------|-----------------|----------------------|
| supplierCompanyId | supplierCompanyId | supplier_id |
| customerCompanyId | customerCompanyId | customer_id |
| totalValueUsd | totalValueUsd | total_value_usd |
| paidValueUsd | paidValueUsd | paid_value_usd |
| shippingLineId | shippingLineId | shipping_line_id |
| polId | polId | pol_id |
| podId | podId | pod_id |
| blNo | blNo | bl_no |
| blDate | blDate | bl_date |
| lcNumber | lcNumber | lc_number |

---

## ✅ Field Mapping Checklist Template

```markdown
## Component: [Component Name]

### Field: [Field Label]
- [ ] Frontend field name: ___
- [ ] API request key: ___
- [ ] DB table: ___
- [ ] DB column: ___
- [ ] Data type: ___
- [ ] Required: Yes/No
- [ ] Status: Pending/Approved/Rejected
- [ ] Notes: ___
```

---

## 🛠️ Tools for Mapping Audit

### 1. Extract Frontend Fields
```bash
# Find all form fields in a component
grep -n "name=" vibe/src/components/shipments/wizard/Step1BasicInfo.tsx
grep -n "register(" vibe/src/components/shipments/wizard/Step1BasicInfo.tsx
```

### 2. Check API Route
```bash
# Find API endpoint handlers
grep -rn "shipments" app/src/routes/
```

### 3. Check DB Schema
```sql
-- Get all columns for a table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'logistics' AND table_name = 'shipments'
ORDER BY ordinal_position;

-- Get normalized table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'logistics' AND table_name = 'shipment_parties';
```

---

## 📋 Priority Order for Mapping Audit

1. **HIGH**: Shipment creation wizard (most complex)
2. **HIGH**: Contract creation wizard
3. **MEDIUM**: Customs clearing forms
4. **MEDIUM**: Financial transaction forms
5. **LOW**: Read-only displays/tables

---

## 🔄 Sync Mechanism

When `shipments` table is updated, the sync trigger automatically populates:
- `shipment_parties`
- `shipment_cargo`
- `shipment_logistics`
- `shipment_financials`
- `shipment_documents`

**Important**: Frontend can continue writing to `shipments` table for now. The sync trigger handles normalization automatically.

---

*Reference document for field mapping audit - December 2025*









