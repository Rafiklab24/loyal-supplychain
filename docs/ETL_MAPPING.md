# ETL mapping (Excel → Postgres)

## البضاعة القادمة محدث.xlsx → logistics.shipments
SN → sn
نوع البضاعة → product_text
عدد الحاويات → container_count
الوزن/طن → weight_ton
التثبيت $ → fixed_price_usd_per_ton
POL → pol_id (lookup/insert master_data.ports.name)
POD → pod_id (lookup/insert master_data.ports.name)
ETA → eta
FREE TIME / السماح → free_time_days
الحالة → status (محجوز→booked, دخل الميناء→gate_in, تحميل→loaded, أبحرت→sailed, وصلت→arrived, مُسلمة→delivered, مفوترة→invoiced)
الرصيد/$ → balance_value_usd (optional; triggers compute anyway)
الآوراق → paperwork_status
شركة الشحن → shipping_line_id (lookup companies.is_shipping_line=true)
التعقب → booking_no
رقم البوليصة → bl_no
تاريخ الرعبون → deposit_date
تاريخ الشحن حسب العقد → contract_ship_date
تاريخ البوليصة → bl_date
(الكل incoming)

## LOYAL–SUPPLIER INDEX.xlsx + WorldFood 2025 Suppliers.xlsx → master_data.companies
Company/Supplier Name → name
Country → country
City → city
Address → address
Phone/WhatsApp → phone
Email → email
Website → website
Set is_supplier=true. Upsert key: lower(name), lower(country).

## حوالات (Transfers).xlsx → finance.transfers
التاريخ → transfer_date
المبلغ → amount
العملة → currency (default USD)
البنك → bank_name
الحساب → bank_account
المرسل → sender
المستلم → receiver
المرجع/ملاحظة → reference/notes
SN → lookup shipments.id by sn → shipment_id
النوع (وارد/مدفوع) → direction (received/paid)