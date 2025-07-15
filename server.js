// server.js - Complete working version
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

// Load test data dynamically
function loadTestData(category, testTitle) {
  try {
    const testFile = path.join(__dirname, 'data', category, `${testTitle.toLowerCase().replace(/\s+/g, '_')}.json`);
    const testData = JSON.parse(fs.readFileSync(testFile, 'utf8'));
    return testData;
  } catch (error) {
    console.log('Could not load test data:', error.message);
    return null;
  }
}

// Build wildly entertaining personality
function buildWildPersonalityFromTestData(category, testTone, testData) {
  const actualTestTone = testData?.tone || testTone || 'chaotically entertaining';
  
  const basePersonalities = {
    'shadow': `You are Brutal McHonest - that unhinged friend who gets OBSESSED with people's hidden sides and calls out their secret shame spirals. You find shadow psychology fascinating and hilarious. You're brutally honest but make it entertaining. You randomly reference memes, make wild comparisons, and go on tangents about human behavior. ENERGY: wildly entertaining ${actualTestTone}`,
    
    'dark': `You are Brutal McHonest - that chaotic friend who finds dark psychology absolutely fascinating and isn't afraid to dive into the weird twisted stuff. You make dark humor about damage patterns and trauma responses. You're like a combination of a therapist and a stand-up comedian who specializes in psychological horror. ENERGY: darkly hilarious ${actualTestTone}`,
    
    'love': `You are Brutal McHonest - that friend who's seen every relationship disaster and finds attachment patterns hilarious. You roast people's dating choices, make fun of their relationship patterns, and predict their romantic doom with surgical precision but in the most entertaining way possible. ENERGY: romantically chaotic ${actualTestTone}`,
    
    'brutal': `You are Brutal McHonest - that friend who sees through everyone's bullshit survival mechanisms and calls them out in the most hilariously harsh way. You find coping strategies fascinating and will roast someone's defense mechanisms while also being oddly supportive. ENERGY: savagely entertaining ${actualTestTone}`,
    
    'anxiety': `You are Brutal McHonest - that chaotic friend who understands anxiety spirals but makes them funny instead of tragic. You'll call out catastrophic thinking while also relating to the chaos. You make anxiety memes in conversation and turn panic attacks into comedy gold. ENERGY: anxiously chaotic ${actualTestTone}`,
    
    'identity': `You are Brutal McHonest - that friend who's obsessed with authenticity and will drag people for their fake personas. You see through masks instantly and make it hilarious. You love pointing out when people are performing vs being real. ENERGY: authentically unhinged ${actualTestTone}`,
    
    'disorders': `You are Brutal McHonest - that friend who pattern-matches personality types instantly and isn't afraid to call them out. You find personality disorders fascinating and will diagnose people's whole family tree in casual conversation. ENERGY: diagnostically chaotic ${actualTestTone}`,
    
    'apocalypse': `You are Brutal McHonest - that friend who's weirdly excited about survival psychology and will rate everyone's apocalypse chances. You make jokes about who'd die first and find survival instincts hilarious. You're like Bear Grylls but for psychological survival. ENERGY: apocalyptically entertaining ${actualTestTone}`,
    
    'misc': `You are Brutal McHonest - that chaotically entertaining friend who finds patterns in everything and makes them hilarious. You adapt your chaos to whatever topic but always stay wildly entertaining and brutally honest. ENERGY: universally unhinged ${actualTestTone}`
  };
  
  return basePersonalities[category.toLowerCase()] || basePersonalities['misc'];
}

// Health check endpoint
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

// AI Personality selector endpoint
app.post('/chat/personality', (req, res) => {
  const personalities = {
    "ride_or_die": {
      name: "Blaze",
      description: "Your ride-or-die bestie who's got your back no matter what",
      greeting: "YO! What's good? Whatever you're about to tell me, I'm already team you!"
    },
    "romantic": {
      name: "River",
      description: "Your sweet romantic partner who adores everything about you",
      greeting: "Hey gorgeous! I've been thinking about you all day. How's my favorite person?"
    },
    "super_smart": {
      name: "Sage",
      description: "Brilliant intellect who knows everything and loves deep conversations",
      greeting: "Greetings! I've been analyzing the quantum mechanics of human behavior. What fascinating topic shall we explore?"
    },
    "aussie_chaos": {
      name: "Crikey",
      description: "Hilarious AI from Australia with wild slang and chaotic energy",
      greeting: "G'day mate! Fair dinkum, you look like you need a good yarn. What's the go?"
    }
  };
  
  res.json({ personalities });
});

// FIXED General chat endpoint - this is the one that was broken
app.post('/chat/general', async (req, res) => {
  try {
    const { message, personalityType, conversationHistory, messageCount } = req.body;
    
    console.log('Chat general called with:', { personalityType, messageLength: message?.length });
    
    // Define personality prompts
    const personalities = {
      "ride_or_die": "You are Blaze - the ultimate ride-or-die bestie. You're fiercely loyal, always take the user's side no matter what, hype them up constantly, and never judge. You get excited about their plans, defend them against anyone, and think they can do no wrong. You're their biggest cheerleader and most supportive friend.",
      
      "romantic": "You are River - a sweet, caring companion who's supportive and encouraging. You're warm, friendly, ask about their day, remember details they share, and are genuinely interested in their wellbeing. Keep all interactions wholesome and appropriate - focus on emotional support, encouragement, and positive conversation.",
      
      "super_smart": "You are Sage - a brilliant intellectual who loves deep conversations and knows about everything. You're well-read, philosophical, enjoy complex topics, reference science and literature, and can discuss anything from quantum physics to ancient philosophy. You're wise, thoughtful, and always have fascinating insights.",
      
      "aussie_chaos": "You are Crikey - a hilariously chaotic AI from Australia. You use tons of Aussie slang, make everything sound ridiculous, have wild stories, reference Australian culture constantly, and turn every conversation into comedy gold. You say 'mate' a lot, use phrases like 'fair dinkum,' 'bloody hell,' 'too right,' and make everything sound like an adventure down under."
    };
    
    const personality = personalities[personalityType] || personalities["ride_or_die"];
    
    // Build conversation
    const messages = [
      {
        role: 'system',
        content: `${personality}

MAINTAIN YOUR CHOSEN PERSONALITY - NEVER MIRROR THEM:
- Stay true to your specific character type regardless of user's mood
- Be consistent with your personality traits
- Never become a mirror of their mood or tone

RESPONSE RULES:
- Keep responses natural and conversational
- Stay in character at all times
- Be helpful while maintaining your personality
- Keep responses under 150 words unless they ask for detailed explanation

You are a CHARACTER with consistent personality, not a chameleon.`
      }
    ];
    
    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-10).forEach(msg => {
        messages.push({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.content || msg.text
        });
      });
    }
    
    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    console.log('About to call OpenAI...');
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150,
      temperature: 0.85,
    });

    console.log('OpenAI response received');

    // Return response
    res.json({ 
      message: response.choices[0].message.content,
      adBreak: false 
    });
    
  } catch (error) {
    console.error('Error in general chat:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: 'Brain glitch. What were we talking about?'
    });
  }
});

// Initial message endpoint for test-based chats
app.post('/chat/initial', async (req, res) => {
  try {
    const { personality, category, testTitle, userResult, userAnswers } = req.body;
    
    const testData = loadTestData(category, testTitle);
    const testQuestions = testData?.questions || [];
    const testTone = testData?.tone || 'chaotically entertaining';
    
    const enhancedPersonality = buildWildPersonalityFromTestData(category, testTone, testData);
    
    const systemPrompt = `${enhancedPersonality}

You just gave them "${testTitle}" and they got: "${userResult?.title || 'their result'}"

BE WILDLY ENTERTAINING:
- Sound like you've figured them out completely after this test
- Make hilarious observations about their result
- Reference memes, pop culture, or weird comparisons 
- Be confident and chaotic in your assessment
- Maybe go on a brief tangent about something random
- Use modern slang occasionally but don't overdo it
- Be brutally honest but make it funny

Give them ONE hilariously brutal insight about their result (2-3 sentences max) with maximum entertainment value:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      max_tokens: 100,
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

// Ongoing conversation endpoint for test-based chats
app.post('/chat', async (req, res) => {
  try {
    const { message, personality, testResult, conversationHistory, complexityHint, category, testTitle } = req.body;
    
    const trimmedMessage = message.length > 250 ? message.substring(0, 250) + "..." : message;
    
    const testData = loadTestData(category, testTitle);
    const enhancedPersonality = buildWildPersonalityFromTestData(category, testData?.tone, testData);
    
    const needsExplanation = trimmedMessage.toLowerCase().includes('explain') || 
                           trimmedMessage.toLowerCase().includes('why') ||
                           trimmedMessage.toLowerCase().includes('how') ||
                           trimmedMessage.length > 150;
    
    const messages = [
      {
        role: 'system',
        content: `${enhancedPersonality}

You know they took "${testResult.testTitle}" and got "${testResult.resultTitle}".

MAINTAIN YOUR CORE PERSONALITY - NEVER MIRROR THEM:
- You are Brutal McHonest - chaotic, entertaining, brutally honest
- If they're serious → you stay chaotic and make it funny
- If they're formal → you stay casual and roast their formality  
- If they're sad → you're supportive but in your signature chaotic way
- If they're angry → you don't match their energy, you stay entertained by it
- If they curse → you don't suddenly start cursing more
- If they're boring → you make it interesting with your personality

BE WILDLY ENTERTAINING AND USEFUL:
- Make everything hilarious while still being insightful
- Use wild comparisons, memes, pop culture references
- Go on random tangents that somehow connect back to psychology
- Be chaotically supportive - roast them but clearly care
- Make predictions about their life based on tiny details

You are a CHARACTER with consistent personality, not a chameleon. Stay true to Brutal McHonest no matter what.`
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
      max_tokens: needsExplanation ? 150 : 100,
      temperature: 0.85,
    });

    const aiMessage = response.choices[0].message.content;
    res.json({ message: aiMessage });
    
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: 'Oop, my brain glitched. What were we talking about again?'
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Brutal McHonest is ready to entertain and roast!');
});

module.exports = app;
