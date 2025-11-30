import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;
const WEATHER_API_URL = process.env.WEATHER_API_URL || 'https://weatherapi-mcp.up.railway.app';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

/**
 * Tip Categories with colors (hex values for mobile app)
 * Colors are designed for both light and dark mode compatibility
 */
const TIP_CATEGORIES = {
  weather_alert: {
    id: 'weather_alert',
    name_vi: 'Cảnh báo thời tiết',
    name_en: 'Weather Alert',
    icon: '⚠️',
    color: '#F59E0B',        // Amber - warning color
    backgroundColor: '#FEF3C7',
    priority: 1              // Highest priority
  },
  pest_control: {
    id: 'pest_control',
    name_vi: 'Phòng trừ sâu bệnh',
    name_en: 'Pest Control',
    icon: '🐛',
    color: '#EF4444',        // Red - urgent/important
    backgroundColor: '#FEE2E2',
    priority: 2
  },
  irrigation: {
    id: 'irrigation',
    name_vi: 'Tưới tiêu',
    name_en: 'Irrigation',
    icon: '💧',
    color: '#3B82F6',        // Blue - water related
    backgroundColor: '#DBEAFE',
    priority: 3
  },
  planting: {
    id: 'planting',
    name_vi: 'Gieo trồng',
    name_en: 'Planting',
    icon: '🌱',
    color: '#10B981',        // Green - growth
    backgroundColor: '#D1FAE5',
    priority: 4
  },
  harvesting: {
    id: 'harvesting',
    name_vi: 'Thu hoạch',
    name_en: 'Harvesting',
    icon: '🌾',
    color: '#F97316',        // Orange - harvest color
    backgroundColor: '#FFEDD5',
    priority: 5
  },
  livestock: {
    id: 'livestock',
    name_vi: 'Chăn nuôi',
    name_en: 'Livestock',
    icon: '🐄',
    color: '#8B5CF6',        // Purple
    backgroundColor: '#EDE9FE',
    priority: 6
  },
  market: {
    id: 'market',
    name_vi: 'Thị trường',
    name_en: 'Market',
    icon: '📈',
    color: '#06B6D4',        // Cyan
    backgroundColor: '#CFFAFE',
    priority: 7
  },
  seasonal: {
    id: 'seasonal',
    name_vi: 'Theo mùa',
    name_en: 'Seasonal',
    icon: '📅',
    color: '#EC4899',        // Pink
    backgroundColor: '#FCE7F3',
    priority: 8
  },
  general: {
    id: 'general',
    name_vi: 'Mẹo chung',
    name_en: 'General Tips',
    icon: '💡',
    color: '#6366F1',        // Indigo
    backgroundColor: '#E0E7FF',
    priority: 9
  }
};

/**
 * Tips Database - Comprehensive farming tips for Vietnamese farmers
 * Each tip has Vietnamese and English versions
 */
const TIPS_DATABASE = [
  // Weather Alert Tips
  {
    id: 'weather_1',
    category: 'weather_alert',
    title_vi: 'Chuẩn bị cho mưa lớn',
    title_en: 'Prepare for Heavy Rain',
    content_vi: 'Dự báo mưa lớn trong 24h tới. Hãy kiểm tra hệ thống thoát nước và che chắn cây trồng non.',
    content_en: 'Heavy rain forecast in next 24h. Check drainage systems and protect young plants.',
    conditions: { rain_chance_above: 70 },
    actionable: true,
    action_vi: 'Kiểm tra thoát nước',
    action_en: 'Check drainage'
  },
  {
    id: 'weather_2',
    category: 'weather_alert',
    title_vi: 'Cảnh báo nắng nóng',
    title_en: 'Heat Wave Warning',
    content_vi: 'Nhiệt độ cao trên 35°C. Tưới nước vào sáng sớm hoặc chiều tối, tránh tưới giữa trưa.',
    content_en: 'Temperature above 35°C. Water early morning or late evening, avoid midday watering.',
    conditions: { temp_above: 35 },
    actionable: true,
    action_vi: 'Điều chỉnh lịch tưới',
    action_en: 'Adjust watering schedule'
  },
  {
    id: 'weather_3',
    category: 'weather_alert',
    title_vi: 'Gió mạnh sắp đến',
    title_en: 'Strong Wind Warning',
    content_vi: 'Gió mạnh dự kiến. Buộc chặt cây cao và kiểm tra nhà kính, lưới che.',
    content_en: 'Strong winds expected. Secure tall plants and check greenhouses, shade nets.',
    conditions: { wind_above: 40 },
    actionable: true,
    action_vi: 'Cố định cây trồng',
    action_en: 'Secure plants'
  },

  // Pest Control Tips
  {
    id: 'pest_1',
    category: 'pest_control',
    title_vi: 'Kiểm tra sâu bệnh định kỳ',
    title_en: 'Regular Pest Inspection',
    content_vi: 'Kiểm tra mặt dưới lá và thân cây mỗi tuần. Phát hiện sớm giúp xử lý hiệu quả hơn.',
    content_en: 'Check underside of leaves and stems weekly. Early detection enables more effective treatment.',
    conditions: {},
    actionable: true,
    action_vi: 'Chụp ảnh để phân tích',
    action_en: 'Take photo for analysis'
  },
  {
    id: 'pest_2',
    category: 'pest_control',
    title_vi: 'Phòng bệnh sau mưa',
    title_en: 'Post-Rain Disease Prevention',
    content_vi: 'Sau mưa, độ ẩm cao dễ phát sinh nấm bệnh. Tỉa bớt lá úng, tăng thông thoáng.',
    content_en: 'After rain, high humidity can cause fungal diseases. Prune damaged leaves, improve ventilation.',
    conditions: { after_rain: true },
    actionable: true,
    action_vi: 'Tỉa lá bệnh',
    action_en: 'Prune diseased leaves'
  },
  {
    id: 'pest_3',
    category: 'pest_control',
    title_vi: 'Sử dụng thiên địch',
    title_en: 'Use Natural Predators',
    content_vi: 'Bọ rùa, ong ký sinh là thiên địch tự nhiên của rệp và sâu. Hạn chế thuốc hóa học để bảo vệ chúng.',
    content_en: 'Ladybugs and parasitic wasps are natural predators of aphids and caterpillars. Limit chemicals to protect them.',
    conditions: {},
    actionable: false
  },

  // Irrigation Tips
  {
    id: 'irrigation_1',
    category: 'irrigation',
    title_vi: 'Tưới nước đúng cách',
    title_en: 'Proper Watering Technique',
    content_vi: 'Tưới sâu và ít lần tốt hơn tưới nông nhiều lần. Giúp rễ phát triển sâu và khỏe.',
    content_en: 'Deep, infrequent watering is better than shallow, frequent watering. Helps roots grow deep and strong.',
    conditions: {},
    actionable: false
  },
  {
    id: 'irrigation_2',
    category: 'irrigation',
    title_vi: 'Tiết kiệm nước mùa khô',
    title_en: 'Water Conservation in Dry Season',
    content_vi: 'Phủ rơm rạ quanh gốc cây để giữ ẩm đất, giảm bốc hơi nước.',
    content_en: 'Mulch around plant bases with straw to retain soil moisture and reduce evaporation.',
    conditions: { humidity_below: 50 },
    actionable: true,
    action_vi: 'Phủ rơm rạ',
    action_en: 'Apply mulch'
  },
  {
    id: 'irrigation_3',
    category: 'irrigation',
    title_vi: 'Kiểm tra độ ẩm đất',
    title_en: 'Check Soil Moisture',
    content_vi: 'Đặt ngón tay sâu 5cm vào đất. Nếu khô, cần tưới. Nếu ẩm, chờ thêm.',
    content_en: 'Insert finger 5cm into soil. If dry, water needed. If moist, wait.',
    conditions: {},
    actionable: true,
    action_vi: 'Kiểm tra ngay',
    action_en: 'Check now'
  },

  // Planting Tips
  {
    id: 'planting_1',
    category: 'planting',
    title_vi: 'Chuẩn bị đất trước gieo',
    title_en: 'Prepare Soil Before Planting',
    content_vi: 'Bón phân hữu cơ và xới đất kỹ 2 tuần trước khi gieo hạt để đất tơi xốp.',
    content_en: 'Add organic compost and till soil thoroughly 2 weeks before sowing for loose, fertile soil.',
    conditions: {},
    actionable: false
  },
  {
    id: 'planting_2',
    category: 'planting',
    title_vi: 'Khoảng cách trồng hợp lý',
    title_en: 'Proper Plant Spacing',
    content_vi: 'Trồng đúng khoảng cách giúp cây có đủ ánh sáng, dinh dưỡng và giảm sâu bệnh.',
    content_en: 'Proper spacing ensures adequate light, nutrients and reduces pest/disease spread.',
    conditions: {},
    actionable: false
  },
  {
    id: 'planting_3',
    category: 'planting',
    title_vi: 'Thời điểm gieo hạt tốt nhất',
    title_en: 'Best Seeding Time',
    content_vi: 'Gieo hạt vào sáng sớm hoặc chiều mát. Tránh giữa trưa nắng gắt.',
    content_en: 'Sow seeds in early morning or cool evening. Avoid hot midday sun.',
    conditions: {},
    actionable: false
  },

  // Harvesting Tips
  {
    id: 'harvesting_1',
    category: 'harvesting',
    title_vi: 'Thu hoạch đúng thời điểm',
    title_en: 'Harvest at Right Time',
    content_vi: 'Thu hoạch vào sáng sớm khi sương đã tan. Rau củ tươi ngon và bảo quản lâu hơn.',
    content_en: 'Harvest early morning after dew dries. Vegetables stay fresher longer.',
    conditions: {},
    actionable: false
  },
  {
    id: 'harvesting_2',
    category: 'harvesting',
    title_vi: 'Bảo quản sau thu hoạch',
    title_en: 'Post-Harvest Storage',
    content_vi: 'Để rau củ nơi thoáng mát, tránh ánh nắng trực tiếp. Không rửa nước trước khi bảo quản.',
    content_en: 'Store vegetables in cool, ventilated area away from direct sunlight. Do not wash before storage.',
    conditions: {},
    actionable: false
  },

  // Livestock Tips
  {
    id: 'livestock_1',
    category: 'livestock',
    title_vi: 'Chăm sóc vật nuôi mùa nóng',
    title_en: 'Livestock Care in Hot Weather',
    content_vi: 'Đảm bảo đủ nước sạch và bóng mát cho vật nuôi. Tăng số lần cho uống nước.',
    content_en: 'Ensure clean water and shade for livestock. Increase water frequency.',
    conditions: { temp_above: 30 },
    actionable: true,
    action_vi: 'Kiểm tra nước',
    action_en: 'Check water supply'
  },
  {
    id: 'livestock_2',
    category: 'livestock',
    title_vi: 'Vệ sinh chuồng trại',
    title_en: 'Barn Hygiene',
    content_vi: 'Dọn vệ sinh chuồng trại hàng ngày để phòng bệnh và giữ môi trường sạch sẽ.',
    content_en: 'Clean barns daily to prevent disease and maintain a healthy environment.',
    conditions: {},
    actionable: true,
    action_vi: 'Dọn chuồng',
    action_en: 'Clean barn'
  },

  // Market Tips
  {
    id: 'market_1',
    category: 'market',
    title_vi: 'Theo dõi giá nông sản',
    title_en: 'Track Produce Prices',
    content_vi: 'Theo dõi giá thị trường để quyết định thời điểm bán hàng tốt nhất.',
    content_en: 'Monitor market prices to decide the best time to sell your produce.',
    conditions: {},
    actionable: true,
    action_vi: 'Xem giá hôm nay',
    action_en: 'Check today\'s prices'
  },
  {
    id: 'market_2',
    category: 'market',
    title_vi: 'Đa dạng hóa cây trồng',
    title_en: 'Diversify Crops',
    content_vi: 'Trồng nhiều loại cây giúp giảm rủi ro khi giá một loại giảm.',
    content_en: 'Growing multiple crops reduces risk when one crop\'s price drops.',
    conditions: {},
    actionable: false
  },

  // Seasonal Tips
  {
    id: 'seasonal_1',
    category: 'seasonal',
    title_vi: 'Chuẩn bị vụ đông xuân',
    title_en: 'Prepare for Winter-Spring Season',
    content_vi: 'Tháng 11-12 là thời điểm chuẩn bị đất cho vụ đông xuân. Lên kế hoạch giống và phân bón.',
    content_en: 'November-December is time to prepare for winter-spring crop. Plan seeds and fertilizers.',
    conditions: { month_in: [11, 12] },
    actionable: true,
    action_vi: 'Lên kế hoạch',
    action_en: 'Make plan'
  },
  {
    id: 'seasonal_2',
    category: 'seasonal',
    title_vi: 'Vụ hè thu bắt đầu',
    title_en: 'Summer-Autumn Season Begins',
    content_vi: 'Tháng 5-6 bắt đầu vụ hè thu. Chú ý mưa nhiều và sâu bệnh mùa ẩm.',
    content_en: 'May-June starts summer-autumn season. Watch for heavy rain and wet season pests.',
    conditions: { month_in: [5, 6] },
    actionable: false
  },

  // General Tips
  {
    id: 'general_1',
    category: 'general',
    title_vi: 'Ghi chép canh tác',
    title_en: 'Keep Farming Records',
    content_vi: 'Ghi chép ngày gieo, bón phân, thu hoạch giúp cải thiện mùa vụ sau.',
    content_en: 'Record sowing dates, fertilizing, harvesting to improve next season.',
    conditions: {},
    actionable: true,
    action_vi: 'Ghi chép ngay',
    action_en: 'Record now'
  },
  {
    id: 'general_2',
    category: 'general',
    title_vi: 'Học hỏi từ hàng xóm',
    title_en: 'Learn from Neighbors',
    content_vi: 'Trao đổi kinh nghiệm với nông dân láng giềng để học kỹ thuật mới.',
    content_en: 'Exchange experiences with neighboring farmers to learn new techniques.',
    conditions: {},
    actionable: false
  },
  {
    id: 'general_3',
    category: 'general',
    title_vi: 'Chụp ảnh cây trồng',
    title_en: 'Take Plant Photos',
    content_vi: 'Chụp ảnh cây trồng thường xuyên để theo dõi sự phát triển và phát hiện sớm vấn đề.',
    content_en: 'Take plant photos regularly to track growth and detect problems early.',
    conditions: {},
    actionable: true,
    action_vi: 'Chụp ảnh',
    action_en: 'Take photo'
  }
];

/**
 * Get current month (1-12)
 */
function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

/**
 * Check if tip conditions match current context
 */
function matchesConditions(tip, context) {
  const conditions = tip.conditions || {};

  // No conditions = always matches
  if (Object.keys(conditions).length === 0) return true;

  // Check temperature conditions
  if (conditions.temp_above && context.temp_c && context.temp_c < conditions.temp_above) {
    return false;
  }
  if (conditions.temp_below && context.temp_c && context.temp_c > conditions.temp_below) {
    return false;
  }

  // Check humidity conditions
  if (conditions.humidity_above && context.humidity && context.humidity < conditions.humidity_above) {
    return false;
  }
  if (conditions.humidity_below && context.humidity && context.humidity > conditions.humidity_below) {
    return false;
  }

  // Check rain chance
  if (conditions.rain_chance_above && context.rain_chance && context.rain_chance < conditions.rain_chance_above) {
    return false;
  }

  // Check wind conditions
  if (conditions.wind_above && context.wind_kph && context.wind_kph < conditions.wind_above) {
    return false;
  }

  // Check month conditions
  if (conditions.month_in && !conditions.month_in.includes(getCurrentMonth())) {
    return false;
  }

  // Check after rain condition
  if (conditions.after_rain && !context.after_rain) {
    return false;
  }

  return true;
}

/**
 * Fetch weather data for context
 */
async function getWeatherContext(location) {
  try {
    const response = await fetch(`${WEATHER_API_URL}/tools/get_forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, days: 1, lang: 'vi' })
    });

    if (!response.ok) {
      console.warn('[Tips] Failed to fetch weather context');
      return null;
    }

    const data = await response.json();
    if (!data.success) return null;

    return {
      temp_c: data.data.current?.temp_c,
      humidity: data.data.current?.humidity,
      wind_kph: data.data.forecast?.[0]?.day?.maxwind_kph,
      rain_chance: data.data.forecast?.[0]?.day?.daily_chance_of_rain,
      precip_mm: data.data.current?.precip_mm,
      after_rain: (data.data.current?.precip_mm || 0) > 0
    };
  } catch (error) {
    console.warn('[Tips] Error fetching weather:', error.message);
    return null;
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Nông Trí - Tips MCP Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    tools: [
      'get_tips',
      'get_tip_categories',
      'get_contextual_tips'
    ],
    categories: Object.keys(TIP_CATEGORIES),
    total_tips: TIPS_DATABASE.length
  });
});

/**
 * Tool 1: Get all tip categories with colors
 */
app.get('/tools/get_tip_categories', (req, res) => {
  const { lang } = req.query;
  const language = lang || 'vi';

  const categories = Object.values(TIP_CATEGORIES).map(cat => ({
    id: cat.id,
    name: language === 'vi' ? cat.name_vi : cat.name_en,
    icon: cat.icon,
    color: cat.color,
    backgroundColor: cat.backgroundColor,
    priority: cat.priority
  }));

  // Sort by priority
  categories.sort((a, b) => a.priority - b.priority);

  res.json({
    success: true,
    tool: 'get_tip_categories',
    data: categories
  });
});

/**
 * Tool 2: Get tips by category or all tips
 */
app.post('/tools/get_tips', (req, res) => {
  const { category, lang, limit } = req.body;
  const language = lang || 'vi';
  const maxTips = limit || 10;

  let tips = TIPS_DATABASE;

  // Filter by category if specified
  if (category) {
    tips = tips.filter(t => t.category === category);
  }

  // Map to response format
  const response = tips.slice(0, maxTips).map(tip => {
    const cat = TIP_CATEGORIES[tip.category];
    return {
      id: tip.id,
      category: {
        id: cat.id,
        name: language === 'vi' ? cat.name_vi : cat.name_en,
        icon: cat.icon,
        color: cat.color,
        backgroundColor: cat.backgroundColor
      },
      title: language === 'vi' ? tip.title_vi : tip.title_en,
      content: language === 'vi' ? tip.content_vi : tip.content_en,
      actionable: tip.actionable || false,
      action: tip.actionable
        ? (language === 'vi' ? tip.action_vi : tip.action_en)
        : null
    };
  });

  res.json({
    success: true,
    tool: 'get_tips',
    data: response
  });
});

/**
 * Tool 3: Get contextual tips based on weather and location
 * This is the main endpoint for the mobile app
 */
app.post('/tools/get_contextual_tips', async (req, res) => {
  try {
    const { location, lang, limit, device_id } = req.body;
    const language = lang || 'vi';
    const maxTips = limit || 3;

    // Get weather context if location provided
    let context = {};
    if (location) {
      const weatherContext = await getWeatherContext(location);
      if (weatherContext) {
        context = weatherContext;
      }
    }

    // Filter tips that match current context
    const matchingTips = TIPS_DATABASE.filter(tip => matchesConditions(tip, context));

    // Sort by category priority (weather alerts first, etc.)
    matchingTips.sort((a, b) => {
      const priorityA = TIP_CATEGORIES[a.category].priority;
      const priorityB = TIP_CATEGORIES[b.category].priority;
      return priorityA - priorityB;
    });

    // If no matching tips, return general tips
    let selectedTips = matchingTips.length > 0
      ? matchingTips
      : TIPS_DATABASE.filter(t => t.category === 'general');

    // Shuffle within same priority to add variety
    // But keep weather alerts at top
    const weatherAlerts = selectedTips.filter(t => t.category === 'weather_alert');
    const otherTips = selectedTips.filter(t => t.category !== 'weather_alert');

    // Shuffle other tips
    for (let i = otherTips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherTips[i], otherTips[j]] = [otherTips[j], otherTips[i]];
    }

    selectedTips = [...weatherAlerts, ...otherTips].slice(0, maxTips);

    // Map to response format
    const response = selectedTips.map(tip => {
      const cat = TIP_CATEGORIES[tip.category];
      return {
        id: tip.id,
        category: {
          id: cat.id,
          name: language === 'vi' ? cat.name_vi : cat.name_en,
          icon: cat.icon,
          color: cat.color,
          backgroundColor: cat.backgroundColor
        },
        title: language === 'vi' ? tip.title_vi : tip.title_en,
        content: language === 'vi' ? tip.content_vi : tip.content_en,
        actionable: tip.actionable || false,
        action: tip.actionable
          ? (language === 'vi' ? tip.action_vi : tip.action_en)
          : null
      };
    });

    res.json({
      success: true,
      tool: 'get_contextual_tips',
      data: {
        tips: response,
        context: {
          location: location || null,
          weather_based: Object.keys(context).length > 0,
          current_month: getCurrentMonth()
        }
      }
    });
  } catch (error) {
    console.error('[Tips] Error getting contextual tips:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contextual tips',
      details: error.message
    });
  }
});

/**
 * Tool 4: Get a single random tip (for quick display)
 */
app.get('/tools/get_random_tip', (req, res) => {
  const { lang, category } = req.query;
  const language = lang || 'vi';

  let tips = TIPS_DATABASE;
  if (category) {
    tips = tips.filter(t => t.category === category);
  }

  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  const cat = TIP_CATEGORIES[randomTip.category];

  res.json({
    success: true,
    tool: 'get_random_tip',
    data: {
      id: randomTip.id,
      category: {
        id: cat.id,
        name: language === 'vi' ? cat.name_vi : cat.name_en,
        icon: cat.icon,
        color: cat.color,
        backgroundColor: cat.backgroundColor
      },
      title: language === 'vi' ? randomTip.title_vi : randomTip.title_en,
      content: language === 'vi' ? randomTip.content_vi : randomTip.content_en,
      actionable: randomTip.actionable || false,
      action: randomTip.actionable
        ? (language === 'vi' ? randomTip.action_vi : randomTip.action_en)
        : null
    }
  });
});

// Start server
app.listen(PORT, () => {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? `https://tips-mcp.up.railway.app`
    : `http://localhost:${PORT}`;

  console.log(`\n💡 Nông Trí - Tips MCP Server v1.0`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server running on port ${PORT}\n`);
  console.log(`MCP Tools Available:`);
  console.log(`  Health: ${baseUrl}/`);
  console.log(`  1. Get Categories: GET ${baseUrl}/tools/get_tip_categories`);
  console.log(`  2. Get Tips: POST ${baseUrl}/tools/get_tips`);
  console.log(`  3. Get Contextual Tips: POST ${baseUrl}/tools/get_contextual_tips`);
  console.log(`  4. Get Random Tip: GET ${baseUrl}/tools/get_random_tip`);
  console.log(`\nCategories: ${Object.keys(TIP_CATEGORIES).join(', ')}`);
  console.log(`Total Tips: ${TIPS_DATABASE.length}\n`);
});
