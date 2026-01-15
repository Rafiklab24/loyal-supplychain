# Loyal Supply Chain - Vibe UI

Arabic-first bilingual web interface for the Loyal Supply Chain Management System.

## Features

- ✅ **Arabic-first** interface with English toggle
- ✅ **RTL** layout support
- ✅ **Responsive** design (desktop/tablet/mobile)
- ✅ **Real-time data** from REST API
- ✅ **Type-safe** with TypeScript
- ✅ **Modern** React 18 + Vite

## Tech Stack

- **Vite** - Fast build tool
- **React 18** + **TypeScript** - UI framework
- **Tailwind CSS** - Utility-first styling with RTL plugin
- **React Router v6** - Client-side routing
- **TanStack Query** - Server state management
- **Axios** - HTTP client
- **i18next** - Internationalization (Arabic/English)
- **Headless UI** - Accessible components
- **Heroicons** - Icons

## Prerequisites

- Node.js 18+ and npm
- Backend API server running on `http://localhost:3000/api`

## Installation

```bash
cd vibe
npm install
```

## Environment Configuration

Create a `.env` file in the `vibe/` directory:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Preview Production Build

```bash
npm run preview
```

## Project Structure

```
vibe/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── layout/        # Header, Sidebar, Layout
│   │   ├── common/        # Button, Card, Table, etc.
│   │   ├── shipments/     # Shipment-specific components
│   │   └── auth/          # Authentication components
│   ├── pages/             # Page components
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ShipmentsPage.tsx
│   │   ├── ShipmentDetailPage.tsx
│   │   ├── CompaniesPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/          # API services
│   │   ├── api.ts         # Axios client
│   │   ├── shipments.ts
│   │   ├── companies.ts
│   │   └── health.ts
│   ├── hooks/             # React hooks
│   │   ├── useAuth.ts
│   │   ├── useShipments.ts
│   │   ├── useCompanies.ts
│   │   └── useStats.ts
│   ├── types/             # TypeScript types
│   │   └── api.ts
│   ├── i18n/              # Internationalization
│   │   ├── index.ts
│   │   ├── ar.json        # Arabic translations
│   │   └── en.json        # English translations
│   ├── utils/             # Utility functions
│   │   └── format.ts      # Formatting helpers
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

## Authentication

The app includes a mock authentication system:

- Any username/password will work
- Credentials are stored in localStorage
- Real authentication can be added by integrating with JWT backend

## Language Toggle

- Default language: Arabic (RTL)
- Toggle button in header to switch to English (LTR)
- Language preference is saved in localStorage

## Pages

### Dashboard (`/`)
- Overview statistics (shipments, value, weight, suppliers)
- Top origin and destination ports

### Shipments (`/shipments`)
- Full shipment list with pagination
- Search by contract number (SN)
- Filter by status
- Click row to view details

### Shipment Detail (`/shipments/:id`)
- Complete shipment information
- Product details
- Financial summary
- Locations and shipping line
- Important dates

### Companies (`/companies`)
- Three tabs: All Companies, Suppliers, Shipping Lines
- Search functionality
- Company details (name, country, city, contact info)

## API Integration

The app connects to the Loyal Supply Chain API. Make sure the API server is running:

```bash
cd app
npm run dev
```

API endpoints used:
- `GET /api/health/stats` - Dashboard statistics
- `GET /api/shipments` - List shipments with filters
- `GET /api/shipments/:id` - Single shipment details
- `GET /api/companies` - List companies
- `GET /api/companies/type/suppliers` - List suppliers
- `GET /api/companies/type/shipping-lines` - List shipping lines

## Customization

### Branding
Update colors in `tailwind.config.js`:
```javascript
colors: {
  primary: {
    600: '#1e40af', // Main brand color
  },
}
```

### Arabic Font
Change fonts in `tailwind.config.js`:
```javascript
fontFamily: {
  sans: ['Cairo', 'system-ui', 'sans-serif'],
  arabic: ['Tajawal', 'Cairo', 'sans-serif'],
}
```

### Translations
Edit `src/i18n/ar.json` and `src/i18n/en.json` to add/modify translations.

## Future Enhancements

- [ ] Real JWT authentication
- [ ] User roles and permissions
- [ ] Document upload
- [ ] WhatsApp notifications UI
- [ ] Export to Excel/PDF
- [ ] Charts and analytics (Recharts)
- [ ] Dark mode
- [ ] Offline support

## License

Proprietary - Loyal International © 2025
