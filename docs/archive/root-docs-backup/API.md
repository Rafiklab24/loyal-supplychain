# Loyal Supply Chain - REST API Documentation

## Base URL

```
http://localhost:3000/api
```

## Overview

The Loyal Supply Chain API provides programmatic access to shipments, companies, ports, and financial transfers data. All endpoints return JSON responses with proper HTTP status codes.

## Common Response Format

### Success Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 376,
    "totalPages": 19
  }
}
```

### Error Response
```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "details": "Additional context (optional)"
}
```

## HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate resource
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Database connection failed

---

## Health Endpoints

### GET /health
Check API health and database connectivity.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-27T12:00:00.000Z",
  "database": "connected",
  "uptime": 3600.5
}
```

### GET /health/stats
Get dashboard statistics and overview.

**Response:**
```json
{
  "overview": {
    "total_shipments": "376",
    "unique_contracts": "369",
    "total_containers": "46325",
    "total_weight_tons": "3423531.28",
    "total_value_usd": "48123304.59",
    "total_suppliers": "74",
    "total_shipping_lines": "208",
    "total_ports": "61",
    "total_transfers": "0"
  },
  "shipmentsByStatus": [
    {"status": "sailed", "count": "120"},
    {"status": "arrived", "count": "85"}
  ],
  "topOrigins": [
    {"port": "مرسين", "shipment_count": "206"}
  ],
  "topDestinations": [
    {"port": "الهند", "shipment_count": "80"}
  ]
}
```

---

## Shipments Endpoints

### GET /shipments
List all shipments with filtering and pagination.

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page
- `status` (string) - Filter by status (planning, booked, gate_in, loaded, sailed, arrived, delivered, invoiced)
- `pol` (string) - Filter by port of loading (partial match)
- `pod` (string) - Filter by port of discharge (partial match)
- `product` (string) - Search in product text (partial match)
- `sn` (string) - Search by contract number (partial match)

**Example Request:**
```bash
GET /api/shipments?status=sailed&limit=10&page=1
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "sn": "24120104",
      "direction": "incoming",
      "product_text": "غذاء طيور",
      "container_count": 1,
      "weight_ton": "25.000",
      "fixed_price_usd_per_ton": "950.00",
      "total_value_usd": "23750.00",
      "paid_value_usd": "0.00",
      "balance_value_usd": "23750.00",
      "pol_name": "مرسين",
      "pod_name": "بلجيكا",
      "shipping_line_name": "VANROBAEYS",
      "status": "sailed",
      "created_at": "2025-10-27T11:52:51.226Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 376,
    "totalPages": 38
  }
}
```

### GET /shipments/:id
Get a single shipment by ID.

**Response:**
```json
{
  "id": "uuid",
  "sn": "24120104",
  "product_text": "غذاء طيور",
  // ... all shipment fields
}
```

### GET /shipments/sn/:sn
Get all shipments for a contract number (can return multiple if same contract has multiple shipments).

**Example Request:**
```bash
GET /api/shipments/sn/237
```

**Response:**
```json
{
  "sn": "237",
  "count": 2,
  "shipments": [
    {
      "id": "uuid-1",
      "sn": "237",
      "product_text": "نسكافيه مصرية"
    },
    {
      "id": "uuid-2",
      "sn": "237",
      "product_text": "قطع تبديل ماكينة"
    }
  ]
}
```

### GET /shipments/:id/transfers
Get all financial transfers for a shipment.

**Response:**
```json
{
  "shipment_id": "uuid",
  "count": 3,
  "transfers": [
    {
      "id": "uuid",
      "direction": "received",
      "amount": "10000.00",
      "currency": "USD",
      "transfer_date": "2025-01-15",
      "bank_name": "Bank Name",
      "sender": "Customer Name"
    }
  ]
}
```

### POST /shipments/:id/milestone
Add a milestone event to a shipment.

**Request Body:**
```json
{
  "code": "ARRIVED",
  "notes": "Arrived at port on schedule"
}
```

**Response:** (201 Created)
```json
{
  "id": "uuid",
  "shipment_id": "uuid",
  "code": "ARRIVED",
  "notes": "Arrived at port on schedule",
  "ts": "2025-10-27T12:00:00.000Z"
}
```

---

## Companies Endpoints

### GET /companies
List all companies with pagination and search.

**Query Parameters:**
- `page` (number) - Page number
- `limit` (number) - Items per page
- `search` (string) - Search in name or country

**Example Request:**
```bash
GET /api/companies?search=Maersk&limit=20
```

### GET /companies/:id
Get a single company by ID.

### GET /companies/type/suppliers
List all suppliers (companies with `is_supplier=true`).

**Query Parameters:**
- `page`, `limit` - Pagination

### GET /companies/type/shipping-lines
List all shipping lines (companies with `is_shipping_line=true`).

**Query Parameters:**
- `page`, `limit` - Pagination

---

## Transfers Endpoints

### GET /transfers
List all financial transfers.

**Query Parameters:**
- `page`, `limit` - Pagination
- `direction` (string) - Filter by direction (received/paid)

**Example Request:**
```bash
GET /api/transfers?direction=received&limit=20
```

### GET /transfers/:id
Get a single transfer by ID.

### GET /transfers/shipment/:shipmentId
Get all transfers for a specific shipment.

### POST /transfers
Create a new financial transfer.

**Request Body:**
```json
{
  "direction": "received",
  "amount": 50000,
  "currency": "USD",
  "transfer_date": "2025-10-27",
  "bank_name": "Al Rajhi Bank",
  "bank_account": "SA1234567890",
  "sender": "Customer Name",
  "receiver": "Loyal Supply Chain",
  "reference": "INV-2025-001",
  "notes": "Payment for shipment SN-001",
  "shipment_id": "uuid",
  "pi_no": "PI-2025-001"
}
```

**Required Fields:** `direction`, `amount`, `currency`

**Response:** (201 Created)
```json
{
  "id": "uuid",
  "direction": "received",
  "amount": "50000.00",
  "currency": "USD",
  // ... all transfer fields
}
```

---

## Ports Endpoints

### GET /ports
List all ports with pagination and search.

**Query Parameters:**
- `page`, `limit` - Pagination
- `search` (string) - Search in name, country, or UNLOCODE

**Example Request:**
```bash
GET /api/ports?search=Jeddah&limit=50
```

### GET /ports/:id
Get a single port by ID.

### GET /ports/search/query
Search ports by query string.

**Query Parameters:**
- `q` (string, required) - Search query

**Example Request:**
```bash
GET /api/ports/search/query?q=مرسين
```

**Response:**
```json
{
  "query": "مرسين",
  "count": 1,
  "results": [
    {
      "id": "uuid",
      "name": "مرسين",
      "country": "تركيا",
      "unlocode": "TRMER"
    }
  ]
}
```

---

## Error Handling

### Validation Errors (400)
```json
{
  "error": "Bad Request",
  "message": "Required field is missing"
}
```

### Not Found (404)
```json
{
  "error": "Shipment not found"
}
```

### Conflict (409)
```json
{
  "error": "Conflict",
  "message": "A record with this value already exists"
}
```

### Server Error (500)
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider adding rate limiting in production.

## Authentication

Currently, the API is open (no authentication required). For production deployment, consider implementing:
- JWT tokens
- API keys
- OAuth 2.0

## CORS

CORS is enabled for all origins. Configure as needed for production:
```javascript
app.use(cors({
  origin: 'https://yourdomain.com'
}));
```

---

## Examples

### Filter shipments by status
```bash
curl "http://localhost:3000/api/shipments?status=sailed&limit=10"
```

### Search for a specific contract
```bash
curl "http://localhost:3000/api/shipments/sn/24120104"
```

### Get suppliers
```bash
curl "http://localhost:3000/api/companies/type/suppliers?limit=20"
```

### Get dashboard statistics
```bash
curl "http://localhost:3000/api/health/stats"
```

### Create a new transfer
```bash
curl -X POST "http://localhost:3000/api/transfers" \
  -H "Content-Type: application/json" \
  -d '{
    "direction": "received",
    "amount": 50000,
    "currency": "USD",
    "shipment_id": "uuid-here"
  }'
```

---

## Next Steps

- Implement authentication
- Add rate limiting
- Add request validation middleware
- Implement webhooks for n8n integration
- Add WebSocket support for real-time updates
- Create TypeScript SDK for frontend

## Support

For issues or questions, refer to the main README or contact the development team.

