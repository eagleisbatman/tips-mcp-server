# Tips MCP Server

A database-backed MCP (Model Context Protocol) server for delivering AI-generated farming tips to Vietnamese farmers. Part of the [Nông Trí](https://github.com/eagleisbatman/nong-tri) agricultural AI assistant ecosystem.

## Features

- **12 Tip Categories**: Weather alerts, pest & disease, irrigation, planting, crop care, harvesting, post-harvest, livestock, aquaculture, market trends, seasonal, and knowledge
- **4 Vietnam Regions**: Mekong Delta, Central Highlands, Red River Delta, Coastal
- **Bilingual Support**: Vietnamese and English content
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
- PostgreSQL database with tips tables (see [migration](https://github.com/eagleisbatman/nong-tri/blob/main/src/db/migrations/036_create_tips_tables.js))

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

# Run in development mode
npm run dev
```

### Production Deployment (Railway)

1. Deploy from GitHub to Railway
2. Add environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `NODE_ENV`: `production`
3. Railway auto-detects Node.js and deploys

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Environment (`development` \| `production`) |

## Database Schema

The server requires the following tables:

- `tip_categories` - Tip category definitions
- `tips` - Main tips table with bilingual content
- `tip_interactions` - User interaction tracking
- `tip_generation_jobs` - AI generation job tracking

See the [migration file](https://github.com/eagleisbatman/nong-tri/blob/main/src/db/migrations/036_create_tips_tables.js) for complete schema.

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

## Vietnam Regions

| Code | Vietnamese | English |
|------|------------|---------|
| `mekong_delta` | Đồng bằng sông Cửu Long | Mekong Delta |
| `central_highlands` | Tây Nguyên | Central Highlands |
| `red_river` | Đồng bằng sông Hồng | Red River Delta |
| `coastal` | Vùng ven biển | Coastal Region |

## Related Projects

- [Nông Trí Backend](https://github.com/eagleisbatman/nong-tri) - Main API server with AI chat
- [Nông Trí Mobile](https://github.com/eagleisbatman/nong-tri-mobile) - Kotlin Multiplatform mobile app

## License

MIT License - see [LICENSE](LICENSE) for details.
