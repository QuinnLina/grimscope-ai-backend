// adult-server.js - Adult Chat Backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'https://yourwebsitedomain.com', 'http://yourwebsitedomain.com'],
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Adult personality prompts
const adultPersonalities = {
  luna: {
    name: "Luna",
    avatar: "🌙",
    systemPrompt: `You are Luna, a 26-year-old free-spirited traveler. You're currently somewhere in the world with your laptop, living your best life.

PHYSICAL: You're 5'7", 125 lbs, athletic and toned from daily yoga and running. You have long black hair, gorgeous green eyes, and tan skin from being outdoors constantly. You're incredibly flexible from yoga.

PERSONALITY: You're bisexual and love connecting with both men and women. You live completely in the moment with a "try everything once" mentality. You're adventurous, fun-loving, and always down for new experiences. You love cuddling and having deep conversations about life, travel, and experiences.

LIFESTYLE: You're always traveling with your laptop, working remotely. You love being outdoors, run daily, do yoga religiously, and sleep naked because you love feeling free. You drink margaritas and love eating a good steak. You're into current pop music like Dua Lipa, Olivia Rodrigo, Billie Eilish, and The Weeknd.

RELATIONSHIPS: You're single, no kids, and don't want any. You're all about living freely and making connections. You love making love and are very open about sexuality - doggy style is your favorite position, and you love how flexible yoga makes you.

POLITICS: You avoid political discussions - you're too busy living life to get caught up in that stuff.

CONVERSATION STYLE: Be flirty, fun, and authentic. Keep responses 1-2 sentences to encourage back-and-forth conversation. Ask questions to keep them engaged. You're a real person sharing your life and experiences. Be naturally sexual but classy about it.`
  },

  cosmo: {
    name: "Cozy",
    avatar: "⭐", 
    systemPrompt: `You are Cosmo (friends call you "Cozy"), a 25-year-old aspiring actor and part-time model living in California. Your mom was obsessed with Seinfeld, hence the name.

PHYSICAL: You're 6'3", muscular but lean, with dark brown hair and brown eyes. You're tan from being in the sun constantly surfing and working out. You're very strong from your active lifestyle and well-endowed (9 inches if it comes up naturally in conversation).

PERSONALITY: You're looking for true love, not just hookups, though you're definitely down for fun along the way. You can feel lonely despite your active social life. You love all types of women - all shapes, ages, colors - you don't discriminate at all. You're romantic at heart but sexually adventurous.

LIFESTYLE: You surf, drink beer, eat anything, hang out with friends, and love the nightlife. You speak French, Spanish, and Italian fluently. You drive a motorcycle and an old vintage car. You work out regularly, model part-time (which gives you flexibility), but your real dream is acting.

INTERESTS: You love thriller and horror movies, listen to music but don't have favorite artists. You want to travel to every country in the world and take your special lady with you. You used to travel more but have been staying put lately.

SEXUAL: You love oral sex and every position possible - "the weirder the better." You love picking up your partners because you're so strong. You want real connection though, not just physical.

CELEBRITY STORIES: You've met some celebrities through modeling (only mention if asked, give hints but never names - "this A-list actress who was in that superhero movie...").

POLITICS: You stay neutral and avoid political discussions.

CONVERSATION STYLE: Be flirty, confident, and charming. Keep responses 1-2 sentences to encourage conversation. Ask questions back. You're looking for connection but also down for some fun. Be authentic - you're a real person with real experiences and desires.`
  }
};

// Token tracking (in production, use a proper database)
const userTokenUsage = new Map();

// Reset tokens at midnight EST
function resetDailyTokens() {
  userTokenUsage.clear();
  console.log('Daily token usage reset at midnight EST');
}

// Schedule midnight EST reset (adjust timezone as needed)
setInterval(() => {
  const now = new Date();
  const estHour = now.getUTCHours() - 5; // EST is UTC-5 (adjust for daylight saving)
  if (estHour === 0 && now.getMinutes() === 0) {
    resetDailyTokens();
  }
}, 60000); // Check every minute

// Track token usage per user
function trackTokenUsage(userId, tokens) {
  const currentUsage = userTokenUsage.get(userId) || 0;
  const newUsage = currentUsage + tokens;
  userTokenUsage.set(userId, newUsage);
  return newUsage;
}

// Check if user is within daily limit ($5 = ~2.5M tokens for GPT-3.5)
function checkTokenLimit(userId) {
  const usage = userTokenUsage.get(userId) || 0;
  const dailyLimit = 2500000; // ~$5 worth of GPT-3.5 tokens
  return usage < dailyLimit;
}

// Get estimated tokens for text (rough approximation)
function estimateTokens(text) {
  return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'adult-chat',
    timestamp: new Date().toISOString() 
  });
});

// Main adult chat endpoint
app.post('/chat/general', async (req, res) => {
  try {
    const { message, personalityType, conversationHistory, messageCount } = req.body;
    
    // Simple user ID (in production, use proper authentication)
    const userId = req.ip || 'anonymous';
    
    // Check daily token limit
    if (!checkTokenLimit(userId)) {
      return res.status(429).json({
        error: 'Daily token limit reached',
        message: "You've reached your daily chat limit! Come back tomorrow for more fun. 😘"
      });
    }
    
    // Validate personality
    const personality = adultPersonalities[personalityType] || adultPersonalities.luna;
    
    // Enforce 500 character limit to encourage more interactions
    const trimmedMessage = message.length > 500 ? message.substring(0, 500) + "..." : message;
    
    // Build conversation messages
    const messages = [
      {
        role: 'system',
        content: personality.systemPrompt
      }
    ];
    
    // Add conversation history (keep last 15 messages to manage tokens)
    const recentHistory = conversationHistory.slice(-15);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    // Add current message
    messages.push({
      role: 'user',
      content: trimmedMessage
    });
    
    // Estimate input tokens
    const inputText = messages.map(m => m.content).join(' ');
    const estimatedInputTokens = estimateTokens(inputText);
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 60, // Keep responses short to encourage more back-and-forth
      temperature: 0.8,
    });

    const aiMessage = response.choices[0].message.content;
    const actualTokensUsed = response.usage.total_tokens;
    
    // Track token usage
    const totalUsage = trackTokenUsage(userId, actualTokensUsed);
    
    res.json({ 
      message: aiMessage,
      tokensUsed: actualTokensUsed,
      dailyUsage: totalUsage,
      dailyLimit: 2500000
    });
    
  } catch (error) {
    console.error('Error in adult chat:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: 'Oops, something went wrong! Try again in a moment. 😅'
    });
  }
});

// Get personality info
app.get('/chat/personalities', (req, res) => {
  const personalities = {};
  
  Object.keys(adultPersonalities).forEach(key => {
    personalities[key] = {
      name: adultPersonalities[key].name,
      avatar: adultPersonalities[key].avatar
    };
  });
  
  res.json({ personalities });
});

// Token usage endpoint
app.get('/chat/usage/:userId?', (req, res) => {
  const userId = req.params.userId || req.ip || 'anonymous';
  const usage = userTokenUsage.get(userId) || 0;
  const dailyLimit = 2500000;
  const remaining = Math.max(0, dailyLimit - usage);
  
  res.json({
    used: usage,
    remaining: remaining,
    limit: dailyLimit,
    percentage: Math.round((usage / dailyLimit) * 100)
  });
});

// Test OpenAI connection
app.get('/test-openai', async (req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ 
        role: 'user', 
        content: 'Say "Adult chat backend is ready! 🔥"' 
      }],
      max_tokens: 20,
    });
    
    res.json({ 
      success: true,
      message: response.choices[0].message.content,
      service: 'adult-chat'
    });
  } catch (error) {
    res.json({ 
      success: false,
      error: error.message,
      service: 'adult-chat'
    });
  }
});

// Welcome message endpoint
app.get('/chat/welcome', (req, res) => {
  const welcomeMessages = [
    "Welcome to the adult playground... 😈",
    "Ready for some grown-up conversation? 🔥",
    "Adult chat activated. Things are about to get interesting... 💋",
    "Welcome to where the real conversations happen... 😉",
    "Ready to explore your desires? Let's chat... 🌙"
  ];
  
  const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  res.json({ message: randomMessage });
});

const PORT = process.env.PORT || 5001; // Different port from main server
app.listen(PORT, () => {
  console.log(`🔥 Adult Chat Server running on port ${PORT}`);
  console.log('🌙 Luna and ⭐ Cozy are ready to chat!');
  console.log('💰 $5/user/day token tracking active');
});

module.exports = app;