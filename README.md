# Tips MCP Server

A database-backed MCP (Model Context Protocol) server for delivering AI-generated farming tips. Designed for agricultural applications with support for multiple regions and bilingual content.

## Features

- **12 Tip Categories**: Weather alerts, pest & disease, irrigation, planting, crop care, harvesting, post-harvest, livestock, aquaculture, market trends, seasonal, and knowledge
- **Regional Support**: Configurable regions (default: Vietnam agricultural zones)
- **Bilingual Content**: Vietnamese and English support
- **Weather-Triggered Tips**: Contextual tips based on weather conditions
- **Interaction Tracking**: Analytics for views, dismissals, and actions
- **RESTful API**: Easy integration with mobile and web clients

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Language**: JavaScript (ES Modules)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/categories` | List all tip categories |
| `GET` | `/tips` | Get tips with filtering |
| `GET` | `/tips/contextual` | Get contextual tips based on location/weather |
| `POST` | `/tips/:id/interaction` | Record tip interaction |

### Query Parameters for `/tips`

| Parameter | Type | Description |
|-----------|------|-------------|
| `language` | `vi` \| `en` | Response language (default: `vi`) |
| `region` | string | Filter by region code |
| `category` | string | Filter by category ID |
| `limit` | number | Max tips to return (default: 10) |

### Query Parameters for `/tips/contextual`

| Parameter | Type | Description |
|-----------|------|-------------|
| `language` | `vi` \| `en` | Response language (default: `vi`) |
| `location` | string | Location name for region detection |
| `weather_condition` | string | Current weather condition |
| `temperature` | number | Current temperature in Celsius |
| `humidity` | number | Current humidity percentage |

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Local Development

```bash
# Clone the repository
git clone https://github.com/eagleisbatman/tips-mcp-server.git
cd tips-mcp-server

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations (see Database Schema section)

# Run in development mode
npm run dev
```

### Production Deployment

Deploy to any Node.js hosting platform (Railway, Heroku, Render, etc.):

1. Connect your repository
2. Set environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `NODE_ENV`: `production`
3. Deploy

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Environment (`development` \| `production`) |

## Database Schema

### Required Tables

```sql
-- Tip categories
CREATE TABLE tip_categories (
  id VARCHAR(50) PRIMARY KEY,
  name_vi VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  icon VARCHAR(10) NOT NULL,
  color VARCHAR(7) NOT NULL,
  background_color VARCHAR(7) NOT NULL,
  priority INT NOT NULL DEFAULT 10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tips
CREATE TABLE tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR(50) REFERENCES tip_categories(id),
  title_vi VARCHAR(100) NOT NULL,
  title_en VARCHAR(100) NOT NULL,
  content_vi TEXT NOT NULL,
  content_en TEXT NOT NULL,
  actionable BOOLEAN DEFAULT false,
  action_vi VARCHAR(50),
  action_en VARCHAR(50),
  action_type VARCHAR(50),
  action_data JSONB DEFAULT '{}',
  regions TEXT[] DEFAULT '{}',
  crops TEXT[] DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  urgency VARCHAR(20) DEFAULT 'medium',
  valid_from TIMESTAMP,
  valid_to TIMESTAMP,
  source VARCHAR(50) DEFAULT 'manual',
  active BOOLEAN DEFAULT true,
  view_count INT DEFAULT 0,
  dismiss_count INT DEFAULT 0,
  action_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tip interactions
CREATE TABLE tip_interactions (
  id SERIAL PRIMARY KEY,
  tip_id UUID REFERENCES tips(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  interaction_type VARCHAR(20) NOT NULL,
  region VARCHAR(50),
  language VARCHAR(10) DEFAULT 'vi',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Tip Categories

| ID | Vietnamese | English | Icon |
|----|------------|---------|------|
| `weather_alert` | Cảnh báo thời tiết | Weather Alert | 🌤️ |
| `pest_disease` | Sâu bệnh | Pest & Disease | 🐛 |
| `irrigation` | Tưới tiêu | Irrigation | 💧 |
| `planting` | Gieo trồng | Planting | 🌱 |
| `crop_care` | Chăm sóc cây trồng | Crop Care | 🌾 |
| `harvesting` | Thu hoạch | Harvesting | 🌿 |
| `post_harvest` | Sau thu hoạch | Post-Harvest | 📦 |
| `livestock` | Chăn nuôi | Livestock | 🐄 |
| `aquaculture` | Thủy sản | Aquaculture | 🐟 |
| `market` | Thị trường | Market | 📈 |
| `seasonal` | Mùa vụ | Seasonal | 📅 |
| `knowledge` | Kiến thức | Knowledge | 💡 |

## Default Regions (Vietnam)

| Code | Vietnamese | English |
|------|------------|---------|
| `mekong_delta` | Đồng bằng sông Cửu Long | Mekong Delta |
| `central_highlands` | Tây Nguyên | Central Highlands |
| `red_river` | Đồng bằng sông Hồng | Red River Delta |
| `coastal` | Vùng ven biển | Coastal Region |

## Customization

### Adding New Regions

Insert into `tip_categories` and update the region detection logic in `src/index.js`.

### Adding New Categories

Insert into `tip_categories` table with appropriate icon and colors.

### Changing Languages

The server supports any language pair. Update the `_vi` and `_en` field naming convention as needed.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
