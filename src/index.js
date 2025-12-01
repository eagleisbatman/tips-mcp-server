import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import pg from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;
const WEATHER_API_URL = process.env.WEATHER_API_URL || 'https://weatherapi-mcp.up.railway.app';

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('✓ Database connected'))
  .catch(err => console.error('✗ Database connection failed:', err.message));

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// ============================================================================
// DATABASE QUERIES
// ============================================================================

/**
 * Get all tip categories from database
 */
async function getCategories(lang = 'vi') {
  const result = await pool.query(`
    SELECT id, name_vi, name_en, icon, color, background_color, priority
    FROM tip_categories
    WHERE active = true
    ORDER BY priority ASC
  `);

  return result.rows.map(row => ({
    id: row.id,
    name: lang === 'vi' ? row.name_vi : row.name_en,
    icon: row.icon,
    color: row.color,
    backgroundColor: row.background_color,
    priority: row.priority
  }));
}

/**
 * Get tips from database with optional filtering
 */
async function getTips({ category, regions, crops, lang = 'vi', limit = 10 }) {
  let query = `
    SELECT t.id, t.category_id, t.title_vi, t.title_en, t.content_vi, t.content_en,
           t.actionable, t.action_vi, t.action_en, t.action_type, t.action_data,
           t.regions, t.crops, t.crop_stages, t.conditions, t.urgency,
           c.name_vi as cat_name_vi, c.name_en as cat_name_en,
           c.icon as cat_icon, c.color as cat_color, c.background_color as cat_bg
    FROM tips t
    JOIN tip_categories c ON t.category_id = c.id
    WHERE t.active = true
      AND c.active = true
      AND (t.valid_from IS NULL OR t.valid_from <= NOW())
      AND (t.valid_to IS NULL OR t.valid_to >= NOW())
  `;

  const params = [];
  let paramIndex = 1;

  if (category) {
    query += ` AND t.category_id = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (regions && regions.length > 0) {
    query += ` AND (t.regions && $${paramIndex} OR t.regions = '{}')`;
    params.push(regions);
    paramIndex++;
  }

  if (crops && crops.length > 0) {
    query += ` AND (t.crops && $${paramIndex} OR t.crops = '{}')`;
    params.push(crops);
    paramIndex++;
  }

  query += ` ORDER BY c.priority ASC, t.created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await pool.query(query, params);

  return result.rows.map(row => formatTip(row, lang));
}

/**
 * Get contextual tips based on weather and region
 */
async function getContextualTips({ region, weather, lang = 'vi', limit = 3 }) {
  // Build conditions filter based on weather
  let conditionsFilter = '';
  const params = [];
  let paramIndex = 1;

  if (region) {
    conditionsFilter += ` AND ($${paramIndex} = ANY(t.regions) OR t.regions = '{}')`;
    params.push(region);
    paramIndex++;
  }

  // Weather-based conditions
  const weatherConditions = [];
  if (weather) {
    if (weather.temp_c !== undefined) {
      weatherConditions.push(`(t.conditions->>'temp_above' IS NULL OR (t.conditions->>'temp_above')::float <= ${weather.temp_c})`);
      weatherConditions.push(`(t.conditions->>'temp_below' IS NULL OR (t.conditions->>'temp_below')::float >= ${weather.temp_c})`);
    }
    if (weather.humidity !== undefined) {
      weatherConditions.push(`(t.conditions->>'humidity_above' IS NULL OR (t.conditions->>'humidity_above')::float <= ${weather.humidity})`);
      weatherConditions.push(`(t.conditions->>'humidity_below' IS NULL OR (t.conditions->>'humidity_below')::float >= ${weather.humidity})`);
    }
    if (weather.rain_chance !== undefined) {
      weatherConditions.push(`(t.conditions->>'rain_chance_above' IS NULL OR (t.conditions->>'rain_chance_above')::float <= ${weather.rain_chance})`);
    }
    if (weather.wind_kph !== undefined) {
      weatherConditions.push(`(t.conditions->>'wind_above' IS NULL OR (t.conditions->>'wind_above')::float <= ${weather.wind_kph})`);
    }
  }

  // Current month for seasonal tips
  const currentMonth = new Date().getMonth() + 1;

  const query = `
    SELECT t.id, t.category_id, t.title_vi, t.title_en, t.content_vi, t.content_en,
           t.actionable, t.action_vi, t.action_en, t.action_type, t.action_data,
           t.regions, t.crops, t.crop_stages, t.conditions, t.urgency,
           c.name_vi as cat_name_vi, c.name_en as cat_name_en,
           c.icon as cat_icon, c.color as cat_color, c.background_color as cat_bg,
           c.priority as cat_priority
    FROM tips t
    JOIN tip_categories c ON t.category_id = c.id
    WHERE t.active = true
      AND c.active = true
      AND (t.valid_from IS NULL OR t.valid_from <= NOW())
      AND (t.valid_to IS NULL OR t.valid_to >= NOW())
      ${conditionsFilter}
      ${weatherConditions.length > 0 ? 'AND ' + weatherConditions.join(' AND ') : ''}
      AND (
        t.conditions->>'month_in' IS NULL
        OR t.conditions->>'month_in' LIKE '%${currentMonth}%'
      )
    ORDER BY
      c.priority ASC,
      t.urgency = 'critical' DESC,
      t.urgency = 'high' DESC,
      RANDOM()
    LIMIT $${paramIndex}
  `;
  params.push(limit);

  const result = await pool.query(query, params);

  // If not enough tips found, get general tips
  if (result.rows.length < limit) {
    const remaining = limit - result.rows.length;
    const existingIds = result.rows.map(r => r.id);

    const generalQuery = `
      SELECT t.id, t.category_id, t.title_vi, t.title_en, t.content_vi, t.content_en,
             t.actionable, t.action_vi, t.action_en, t.action_type, t.action_data,
             t.regions, t.crops, t.crop_stages, t.conditions, t.urgency,
             c.name_vi as cat_name_vi, c.name_en as cat_name_en,
             c.icon as cat_icon, c.color as cat_color, c.background_color as cat_bg,
             c.priority as cat_priority
      FROM tips t
      JOIN tip_categories c ON t.category_id = c.id
      WHERE t.active = true
        AND c.active = true
        AND (t.valid_from IS NULL OR t.valid_from <= NOW())
        AND (t.valid_to IS NULL OR t.valid_to >= NOW())
        ${existingIds.length > 0 ? `AND t.id NOT IN (${existingIds.map((_, i) => `$${i + 1}`).join(',')})` : ''}
      ORDER BY RANDOM()
      LIMIT $${existingIds.length + 1}
    `;

    const generalResult = await pool.query(generalQuery, [...existingIds, remaining]);
    result.rows.push(...generalResult.rows);
  }

  return result.rows.map(row => formatTip(row, lang));
}

/**
 * Format a database row to API response format
 */
function formatTip(row, lang = 'vi') {
  return {
    id: row.id,
    category: {
      id: row.category_id,
      name: lang === 'vi' ? row.cat_name_vi : row.cat_name_en,
      icon: row.cat_icon,
      color: row.cat_color,
      backgroundColor: row.cat_bg
    },
    title: lang === 'vi' ? row.title_vi : row.title_en,
    content: lang === 'vi' ? row.content_vi : row.content_en,
    actionable: row.actionable,
    action: row.actionable ? (lang === 'vi' ? row.action_vi : row.action_en) : null,
    actionType: row.action_type,
    actionData: row.action_data,
    urgency: row.urgency,
    regions: row.regions || [],
    crops: row.crops || []
  };
}

/**
 * Record tip interaction
 */
async function recordInteraction(tipId, deviceId, type, region, language) {
  try {
    await pool.query(`
      INSERT INTO tip_interactions (tip_id, device_id, interaction_type, region, language)
      VALUES ($1, $2, $3, $4, $5)
    `, [tipId, deviceId, type, region, language]);

    // Update tip counters
    const counterField = type === 'view' ? 'view_count'
      : type === 'dismiss' ? 'dismiss_count'
      : type === 'action' ? 'action_count'
      : null;

    if (counterField) {
      await pool.query(`
        UPDATE tips SET ${counterField} = ${counterField} + 1, updated_at = NOW()
        WHERE id = $1
      `, [tipId]);
    }
  } catch (err) {
    console.error('Error recording interaction:', err.message);
  }
}

/**
 * Fetch weather context from Weather API
 */
async function getWeatherContext(location) {
  try {
    const response = await fetch(`${WEATHER_API_URL}/tools/get_forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, days: 1, lang: 'vi' })
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.data) return null;

    const current = data.data.current;
    const forecast = data.data.forecast?.forecastday?.[0]?.day;

    return {
      temp_c: current?.temp_c,
      humidity: current?.humidity,
      wind_kph: current?.wind_kph,
      rain_chance: forecast?.daily_chance_of_rain,
      precip_mm: current?.precip_mm,
      after_rain: current?.precip_mm > 0
    };
  } catch (err) {
    console.error('Weather API error:', err.message);
    return null;
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Health check
 */
app.get('/', async (req, res) => {
  let dbStatus = 'unknown';
  let tipCount = 0;

  try {
    const result = await pool.query('SELECT COUNT(*) FROM tips WHERE active = true');
    tipCount = parseInt(result.rows[0].count);
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error: ' + err.message;
  }

  res.json({
    status: 'ok',
    message: 'Nông Trí - Tips MCP Server',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    total_tips: tipCount,
    tools: [
      'get_tip_categories',
      'get_tips',
      'get_contextual_tips',
      'record_interaction'
    ]
  });
});

/**
 * Get all tip categories
 */
app.get('/tools/get_tip_categories', async (req, res) => {
  try {
    const lang = req.query.lang || 'vi';
    const categories = await getCategories(lang);

    res.json({
      success: true,
      tool: 'get_tip_categories',
      data: categories
    });
  } catch (err) {
    console.error('Error getting categories:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * Get tips with optional filtering
 */
app.post('/tools/get_tips', async (req, res) => {
  try {
    const { category, regions, crops, lang = 'vi', limit = 10 } = req.body;

    const tips = await getTips({
      category,
      regions: regions ? (Array.isArray(regions) ? regions : [regions]) : null,
      crops: crops ? (Array.isArray(crops) ? crops : [crops]) : null,
      lang,
      limit
    });

    res.json({
      success: true,
      tool: 'get_tips',
      data: tips
    });
  } catch (err) {
    console.error('Error getting tips:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * Get contextual tips based on location and weather
 */
app.post('/tools/get_contextual_tips', async (req, res) => {
  try {
    const { location, region, lang = 'vi', limit = 3, device_id } = req.body;

    // Determine region from location if not provided
    let targetRegion = region;
    if (!targetRegion && location) {
      // Simple region detection from location name
      const locationLower = location.toLowerCase();
      if (locationLower.includes('ho chi minh') || locationLower.includes('can tho') ||
          locationLower.includes('long an') || locationLower.includes('ben tre') ||
          locationLower.includes('vinh long') || locationLower.includes('dong thap') ||
          locationLower.includes('an giang') || locationLower.includes('kien giang') ||
          locationLower.includes('ca mau') || locationLower.includes('bac lieu') ||
          locationLower.includes('soc trang') || locationLower.includes('tra vinh') ||
          locationLower.includes('hau giang') || locationLower.includes('tien giang')) {
        targetRegion = 'mekong_delta';
      } else if (locationLower.includes('da lat') || locationLower.includes('buon ma thuot') ||
                 locationLower.includes('gia lai') || locationLower.includes('kon tum') ||
                 locationLower.includes('dak lak') || locationLower.includes('dak nong') ||
                 locationLower.includes('lam dong')) {
        targetRegion = 'central_highlands';
      } else if (locationLower.includes('hanoi') || locationLower.includes('ha noi') ||
                 locationLower.includes('hai phong') || locationLower.includes('nam dinh') ||
                 locationLower.includes('thai binh') || locationLower.includes('ninh binh') ||
                 locationLower.includes('ha nam') || locationLower.includes('hung yen') ||
                 locationLower.includes('hai duong') || locationLower.includes('bac ninh') ||
                 locationLower.includes('vinh phuc')) {
        targetRegion = 'red_river';
      } else if (locationLower.includes('da nang') || locationLower.includes('nha trang') ||
                 locationLower.includes('quy nhon') || locationLower.includes('phan thiet') ||
                 locationLower.includes('vung tau') || locationLower.includes('hue')) {
        targetRegion = 'coastal';
      }
    }

    // Get weather context if location provided
    let weather = null;
    if (location) {
      weather = await getWeatherContext(location);
    }

    const tips = await getContextualTips({
      region: targetRegion,
      weather,
      lang,
      limit
    });

    res.json({
      success: true,
      tool: 'get_contextual_tips',
      data: {
        tips,
        context: {
          location,
          region: targetRegion,
          weather_based: weather !== null,
          current_month: new Date().getMonth() + 1
        }
      }
    });
  } catch (err) {
    console.error('Error getting contextual tips:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * Record tip interaction (view, dismiss, action)
 */
app.post('/tools/record_interaction', async (req, res) => {
  try {
    const { tip_id, device_id, interaction_type, region, language = 'vi' } = req.body;

    if (!tip_id || !device_id || !interaction_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tip_id, device_id, interaction_type'
      });
    }

    await recordInteraction(tip_id, device_id, interaction_type, region, language);

    res.json({
      success: true,
      tool: 'record_interaction',
      data: { recorded: true }
    });
  } catch (err) {
    console.error('Error recording interaction:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * Get a random tip (for variety)
 */
app.get('/tools/get_random_tip', async (req, res) => {
  try {
    const { lang = 'vi', category } = req.query;

    let query = `
      SELECT t.id, t.category_id, t.title_vi, t.title_en, t.content_vi, t.content_en,
             t.actionable, t.action_vi, t.action_en, t.action_type, t.action_data,
             t.regions, t.crops, t.crop_stages, t.conditions, t.urgency,
             c.name_vi as cat_name_vi, c.name_en as cat_name_en,
             c.icon as cat_icon, c.color as cat_color, c.background_color as cat_bg
      FROM tips t
      JOIN tip_categories c ON t.category_id = c.id
      WHERE t.active = true AND c.active = true
        AND (t.valid_from IS NULL OR t.valid_from <= NOW())
        AND (t.valid_to IS NULL OR t.valid_to >= NOW())
    `;

    const params = [];
    if (category) {
      query += ' AND t.category_id = $1';
      params.push(category);
    }

    query += ' ORDER BY RANDOM() LIMIT 1';

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        tool: 'get_random_tip',
        data: null
      });
    }

    res.json({
      success: true,
      tool: 'get_random_tip',
      data: formatTip(result.rows[0], lang)
    });
  } catch (err) {
    console.error('Error getting random tip:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Nông Trí - Tips MCP Server v2.0.0                ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                               ║
║  Database: ${process.env.DATABASE_URL ? 'Railway PostgreSQL' : 'Not configured'}             ║
║  Weather API: ${WEATHER_API_URL}    ║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    GET  /                          Health check            ║
║    GET  /tools/get_tip_categories  Get categories          ║
║    POST /tools/get_tips            Get tips with filters   ║
║    POST /tools/get_contextual_tips Context-aware tips      ║
║    POST /tools/record_interaction  Track tip interaction   ║
║    GET  /tools/get_random_tip      Get random tip          ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
