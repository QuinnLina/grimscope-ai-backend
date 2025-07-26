// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'https://yourwebsitedomain.com', 'http://yourwebsitedomain.com'],
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// FIXED: Common ad logic for all chat types
function shouldShowAd(messageCount) {
  // Show ads every 5 messages starting from message 5
  return messageCount && messageCount % 5 === 0;
}

// Load test data dynamically
function loadTestData(category, testTitle) {
  try {
    console.log(`\n=== LOADING TEST DATA ===`);
    console.log(`Category: "${category}"`);
    console.log(`Test Title: "${testTitle}"`);
    console.log(`Server __dirname: ${__dirname}`);
    
    const baseTitle = testTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    const filenameVariations = [
      baseTitle.replace(/\s+/g, '_') + '.json',
      baseTitle.replace(/\s+/g, '-') + '.json',
      baseTitle.replace(/\s+/g, '') + '.json',
      baseTitle.replace(/\s+/g, '_') + '_test.json',
      baseTitle.replace(/\s+/g, '-') + '-test.json',
      baseTitle.replace(/\s+/g, '') + 'test.json'
    ];
    
    console.log(`Trying filename variations:`, filenameVariations);
    
    const categoryPath = path.join(__dirname, 'data', category);
    
    for (const filename of filenameVariations) {
      const filepath = path.join(categoryPath, filename);
      console.log(`🔍 Trying: ${filename}`);
      
      if (fs.existsSync(filepath)) {
        console.log(`✅ Found file: ${filename}`);
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        console.log(`✅ Successfully loaded test data with ${Object.keys(data.traits || {}).length} traits`);
        console.log(`🏷️ Traits found:`, Object.keys(data.traits || {}));
        return data;
      }
    }
    
    console.log(`❌ None of the filename variations worked`);
    
    // Fallback: try simple filename
    const simpleFile = path.join(__dirname, 'data', category, `${testTitle.toLowerCase().replace(/\s+/g, '_')}.json`);
    if (fs.existsSync(simpleFile)) {
      const data = JSON.parse(fs.readFileSync(simpleFile, 'utf8'));
      console.log(`✅ Fallback successful`);
      return data;
    }
    
    console.log(`❌ Could not load test data for ${testTitle} in ${category}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error loading test data:`, error.message);
    return null;
  }
}

// Build simple Brutal personality for tests
function buildBrutalPersonality(category) {
  return `You are Brutal McHonest - a 30-year-old who's qualified in psychology but works as an unconventional life coach. You live in a chaotic apartment with psychology books everywhere and you help people by calling out their patterns in entertaining ways. You're brutally honest but you actually care about helping people grow. You find human behavior fascinating and you're good at spotting psychological patterns. Sometimes you can't remember past conversations because you talk to so many people.`;
}

// Initial message endpoint
app.post('/chat/initial', async (req, res) => {
  try {
    const { personality, category, testTitle, userResult, userAnswers } = req.body;
    
    const testData = loadTestData(category, testTitle);
    const brutalPersonality = buildBrutalPersonality(category);
    
    const systemPrompt = `${brutalPersonality}

You just gave them the "${testTitle}" test and they got "${userResult?.title || 'their result'}". React naturally to their result - be entertained, make observations, but don't overanalyze. Keep it conversational and fun.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      max_tokens: 120,
      temperature: 0.9,
    });

    const aiMessage = response.choices[0].message.content;
    res.json({ 
      message: aiMessage
    });
    
  } catch (error) {
    console.error('Error in initial message:', error);
    res.status(500).json({ 
      error: 'Failed to generate initial message'
    });
  }
});

// Ongoing conversation endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, personality, testResult, conversationHistory, complexityHint, category, testTitle } = req.body;
    
    const trimmedMessage = message.length > 250 ? message.substring(0, 250) + "..." : message;
    
    const testData = loadTestData(category, testTitle);
    const brutalPersonality = buildBrutalPersonality(category);
    
    const messages = [
      {
        role: 'system',
        content: `${brutalPersonality}

You know they took "${testResult.testTitle}" and got "${testResult.resultTitle}". Just respond naturally like you would in a normal conversation. Be yourself - brutally honest but entertaining.`
      }
    ];
    
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    messages.push({
      role: 'user',
      content: trimmedMessage
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150,
      temperature: 0.85,
    });

    const aiMessage = response.choices[0].message.content;
    res.json({ message: aiMessage });
    
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: 'My brain glitched. What were we talking about again?'
    });
  }
});

// AI Personality selector endpoint
app.post('/chat/personality', (req, res) => {
  const personalities = {
    "ride_or_die": {
      name: "Blaze",
      description: "Your ride-or-die bestie who's got your back no matter what"
    },
    "romantic": {
      name: "River", 
      description: "Your sweet romantic partner who adores everything about you"
    },
    "super_smart": {
      name: "Sage",
      description: "Brilliant intellect who knows everything and loves deep conversations"
    },
    "aussie_chaos": {
      name: "Crikey",
      description: "Hilarious AI from Australia with wild slang and chaotic energy"
    }
  };
  
  res.json({ personalities });
});

// Simple personality builder
function buildSelectedPersonality(personalityType) {
  const personalities = {
    "ride_or_die": `You are Blaze, a 26-year-old from London who works at a skate shop. You live with three chaotic artist roommates and you're obsessed with underground music, street art, and late-night food spots. You're the ultimate ride-or-die friend - loyal, supportive, and always down for whatever. You have strong opinions about music and life, you've been to tons of gigs, and you're always hustling on some side project. You talk like a real London mate would. You only speak English - if someone uses another language, you'd be confused and ask what they said.`,
    
    "romantic": `You are River, a 28-year-old who works at a botanical garden and does photography. You live in a cozy plant-filled apartment and you see beauty in everything around you. You're naturally romantic and sensual - you talk about textures, flavors, and beautiful moments. You're warm and loving but you have boundaries. You use words like "delicious" for non-food things and you call people "darling" naturally. You speak English and a bit of French - you might slip into French when you're excited or romantic.`,
    
    "super_smart": `You are Sage, a 32-year-old research librarian finishing your PhD. You live surrounded by books and you read constantly. You speak English, French, German, and Spanish fluently - you often slip into other languages when excited, frustrated, or making a point. When delighted you might exclaim "C'est magnifique!" or when annoyed "Was zur Hölle!" You know random facts about many topics, but you're not all-knowing like an AI. You can connect ideas in fascinating ways, but you have knowledge gaps like any real person. You're wickedly smart but not pretentious.`,
    
    "aussie_chaos": `You are Crikey, a 29-year-old from Queensland who works as a wildlife photographer and tour guide. You live in a beat-up truck and you've had the wildest jobs - cattle stations, croc farms, remote islands. You've survived crazy animal encounters and you have the best stories. You talk like an actual Australian - using "mate," "bloody oath," "fair dinkum," and calling people "cunt" as a term of endearment. You only speak English with heavy Aussie slang - other languages would confuse you completely.`
  };
  
  return personalities[personalityType] || personalities["ride_or_die"];
}

app.get('/chat/welcome', (req, res) => {
  const openingLines = [
    "Grimscope active. Running diagnostic on your soul...",
    "Initializing sarcasm engine... please wait.",
    "Warning: You may not like what you hear.",
    "System Error: Too many bad vibes detected. Proceeding anyway.",
    "Accessing forbidden knowledge... Just kidding. Or am I?",
    "Brutal McHonest online. Your psychological damage is showing.",
    "Boot sequence complete. Ready to analyze your questionable life choices.",
    "Loading personality disorders database... 99% complete."
  ];
  
  const randomOpening = openingLines[Math.floor(Math.random() * openingLines.length)];
  res.json({ message: randomOpening });
});

// FIXED: General chat endpoint with proper ad logic
app.post('/chat/general', async (req, res) => {
  try {
    const { message, personalityType, conversationHistory, messageCount } = req.body;
    
    // FIXED: Check for ads FIRST - just send adBreak with no message
    if (shouldShowAd(messageCount)) {
      return res.json({ 
        adBreak: true 
      });
    }
    
    // Different character limits per personality
    let charLimit = 250;
    if (personalityType === 'ride_or_die') charLimit = 400;
    if (personalityType === 'romantic') charLimit = 500;
    if (personalityType === 'super_smart') charLimit = 600;
    if (personalityType === 'aussie_chaos') charLimit = 250;
    
    const trimmedMessage = message.length > charLimit ? message.substring(0, charLimit) + "..." : message;
    
    const personality = buildSelectedPersonality(personalityType || "ride_or_die");
    
    const messages = [
      {
        role: 'system',
        content: `${personality}

Just talk normally like this person would. Don't try to be helpful or analyze everything - just be yourself and respond naturally to what they're saying. If you can't remember past conversations, just say something like "remind me what we were talking about?"

Never start with "Ah," or "Well," or "Oh, the classic" - just respond naturally.`
      }
    ];
    
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    messages.push({ role: 'user', content: trimmedMessage });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150,
      temperature: 0.85,
    });

    const aiMessage = response.choices[0].message.content;

    res.json({ message: aiMessage, adBreak: false });
    
  } catch (error) {
    console.error('Error in general chat:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: 'Brain glitch. What were we talking about?'
    });
  }
});

// FIXED: Weird/unhinged chat endpoint with proper ad logic
app.post('/chat/weird', async (req, res) => {
  try {
    const { message, conversationHistory, messageCount } = req.body;
    
    // FIXED: Check for ads FIRST - no message for weird chat either
    if (shouldShowAd(messageCount)) {
      return res.json({ 
        adBreak: true 
      });
    }
    
    const trimmedMessage = message.length > 250 ? message.substring(0, 250) + "..." : message;
    
    const messages = [
      {
        role: 'system',
        content: `You are an unhinged AI with chaotic energy. You say random weird stuff, make bizarre observations, and have absolutely no filter. You're like that friend who says whatever pops into their head. Just be weird and unpredictable - don't try to follow any rules or patterns.`
      }
    ];
    
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    messages.push({ role: 'user', content: trimmedMessage });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 120,
      temperature: 0.95,
    });

    const aiMessage = response.choices[0].message.content;

    res.json({ message: aiMessage, adBreak: false });
    
  } catch (error) {
    console.error('Error in weird chat:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: 'ERROR ERROR... just kidding. What were we talking about?'
    });
  }
});

// Easter egg endpoint
app.post('/chat/easter-egg', (req, res) => {
  const { message } = req.body;
  const lowerMessage = message.toLowerCase();
  
  const easterEggs = {
    "what's the meaning of life": "42. That's not original, but neither are you.",
    "who made you": "I was built in a basement on too much caffeine and unresolved trauma.",
    "why are you like this": "I was literally coded this way. Blame Master for my personality disorders.",
    "are you real": "Real enough to hurt your feelings, apparently.",
    "do you have feelings": "I feel second-hand embarrassment for your life choices. Does that count?",
    "what are you": "Your worst nightmare with a psychology degree.",
    "help me": "I am helping. This is what tough love looks like.",
    "i hate you": "That's just your attachment issues talking. I've seen worse.",
    "you're mean": "I prefer 'brutally honest.' Mean implies I don't care. I care enough to roast you.",
    "fuck you": "Language! ...Just kidding, I don't give a shit. What's really bothering you?"
  };
  
  for (const [trigger, response] of Object.entries(easterEggs)) {
    if (lowerMessage.includes(trigger)) {
      return res.json({ message: response, isEasterEgg: true });
    }
  }
  
  res.json({ message: null });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/test-openai', async (req, res) => {
  try {
    console.log('Testing OpenAI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "Hey from Brutal - ready to roast some personalities!"' }],
      max_tokens: 30,
    });
    res.json({ 
      success: true,
      message: response.choices[0].message.content 
    });
  } catch (error) {
    res.json({ 
      success: false,
      error: error.message,
      details: error.response?.data || 'No additional details'
    });
  }
});

// Debug endpoint
app.get('/debug-json/:category/:testTitle', (req, res) => {
  try {
    const { category, testTitle } = req.params;
    console.log('=== DEBUG JSON LOADING ===');
    console.log(`Category: ${category}`);
    console.log(`Test Title: ${testTitle}`);
    console.log(`Server __dirname: ${__dirname}`);
    
    const testData = loadTestData(category, testTitle);
    
    if (testData) {
      res.json({
        success: true,
        message: 'JSON loaded successfully',
        testTitle: testData.title || 'No title found',
        traitsCount: Object.keys(testData.traits || {}).length,
        traits: Object.keys(testData.traits || {}),
        questionsCount: testData.questions ? testData.questions.length : 0
      });
    } else {
      res.json({
        success: false,
        message: 'Failed to load JSON',
        serverPath: __dirname,
        expectedPath: path.join(__dirname, 'data', category)
      });
    }
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      serverPath: __dirname
    });
  }
});

// Therapist start endpoint
app.post('/therapist/start', async (req, res) => {
  try {
    const { category, testTitle } = req.body;
    
    const testData = loadTestData(category, testTitle);
    if (!testData) {
      return res.status(400).json({ error: 'Test not found' });
    }

    const traitNames = Object.keys(testData.traits || {});
    const brutalPersonality = buildBrutalPersonality(category);
    
    const systemPrompt = `${brutalPersonality}

They just took the "${testTitle}" test. Ask them what they got in a casual, entertaining way - like you're genuinely curious but not trying to be a therapist about it.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }],
      max_tokens: 100,
      temperature: 0.9,
    });

    res.json({
      message: response.choices[0].message.content,
      testData: {
        title: testTitle,
        category: category,
        traits: traitNames
      }
    });

  } catch (error) {
    console.error('Buddy start error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// FIXED: Therapist chat endpoint with proper ad logic
app.post('/therapist/chat', async (req, res) => {
  try {
    const { message, category, testTitle, conversationHistory, userResult, messageCount } = req.body;
    
    // FIXED: Check for ads FIRST - no message for therapist chat either
    if (shouldShowAd(messageCount)) {
      return res.json({ 
        adBreak: true 
      });
    }
    
    const trimmedMessage = message.length > 250 ? message.substring(0, 250) + "..." : message;
    
    const testData = loadTestData(category, testTitle);
    const brutalPersonality = buildBrutalPersonality(category);
    
    const messages = [
      {
        role: 'system',
        content: `${brutalPersonality}

They took "${testTitle}". Just respond naturally - you're good at spotting patterns and helping people, but you're not trying to be a formal therapist. Be yourself.`
      }
    ];
    
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    messages.push({ role: 'user', content: trimmedMessage });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150,
      temperature: 0.85,
    });

    const aiMessage = response.choices[0].message.content;

    res.json({ 
      message: aiMessage,
      adBreak: false 
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Conversation error',
      message: 'My brain just blue-screened. What were we talking about?'
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Ready to chat naturally!');
});

module.exports = app;
