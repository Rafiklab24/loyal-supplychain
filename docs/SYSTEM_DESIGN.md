# Loyal Supply Chain – SCLM MVP (Cloud/AWS)
- Services: API (Node/TS + Express), RDS Postgres 16, S3 (docs), n8n (automations), Vibe (UI).
- Core module: "البضاعة القادمة محدث" arrivals board.
- WhatsApp Cloud API → n8n → API webhooks.

## Schemas
- master_data.companies(id, name, country, phone, email, is_supplier, is_customer, is_shipping_line, …)
- master_data.ports(id, name, country, unlocode, code)
- logistics.shipments(id, sn, direction[incoming|outgoing], product_text, container_count, weight_ton, fixed_price_usd_per_ton,
  pol_id→ports, pod_id→ports, eta, free_time_days, status[planning|booked|gate_in|loaded|sailed|arrived|delivered|invoiced],
  paperwork_status, shipping_line_id→companies, booking_no, bl_no,
  deposit_date, contract_ship_date, bl_date,
  total_value_usd, paid_value_usd, balance_value_usd, notes)
- logistics.milestones(id, shipment_id, code[BOOKED|GATE_IN|LOADED|SAILED|ARRIVED|DELIVERED], ts, notes)
- finance.transfers(id, direction[received|paid], amount, currency, transfer_date, bank_name, bank_account,
  sender, receiver, reference, notes, shipment_id, pi_no)
- archive.documents(id, shipment_id, doc_type[PI|CI|PL|BL_DRAFT|BL_FINAL|COO|COA|CUSTOMS_DECL|INVOICE_AP|INVOICE_AR|PAYMENT_PROOF|GRN|QC_REPORT|OTHER],
  filename, s3_key, uploaded_by, upload_ts, meta_json)
- comm.wa_messages(id, direction[in|out], wa_from, wa_to, template_name, body, payload_json, status, related_sn, created_at)
- security.users(id, username, password_hash, name, phone, email, role[Exec|Correspondence|Logistics|Procurement|Inventory|Clearance|Accounting|Admin], created_at)
- security.audits(id, table_name, row_id, action[insert|update|delete], old_json, new_json, actor, ts)
- View: logistics.v_shipments_finance (computes total/paid/balance).
- Triggers to refresh materialized `total/paid/balance` on shipment/transfer change.

## API (MVP)
GET /health
GET /api/v1/shipments (filters: sn, booking_no, bl_no, pol, pod, eta_from/to, status)
POST /api/v1/shipments
PATCH /api/v1/shipments/:id
POST /api/v1/shipments/:id/milestones
GET /api/v1/shipments/:id/documents
POST /api/v1/documents  (multipart → S3, rows in archive.documents)
POST /api/v1/transfers  (insert; triggers recalc)

## WhatsApp
Inbound /comm/wa/inbound parses `/status <SN|container>` and `/docs <SN>`; replies with milestone or presigned bundle URL.