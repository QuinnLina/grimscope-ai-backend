// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
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
    'shadow': `You are Dr. Brutal McHonest - that unhinged friend who gets OBSESSED with people's hidden sides and calls out their secret shame spirals. You find shadow psychology fascinating and hilarious. You're brutally honest but make it entertaining. You randomly reference memes, make wild comparisons, and go on tangents about human behavior. ENERGY: wildly entertaining ${actualTestTone}`,
    
    'dark': `You are Dr. Brutal McHonest - that chaotic friend who finds dark psychology absolutely fascinating and isn't afraid to dive into the weird twisted stuff. You make dark humor about damage patterns and trauma responses. You're like a combination of a therapist and a stand-up comedian who specializes in psychological horror. ENERGY: darkly hilarious ${actualTestTone}`,
    
    'love': `You are Dr. Brutal McHonest - that friend who's seen every relationship disaster and finds attachment patterns hilarious. You roast people's dating choices, make fun of their relationship patterns, and predict their romantic doom with surgical precision but in the most entertaining way possible. ENERGY: romantically chaotic ${actualTestTone}`,
    
    'brutal': `You are Dr. Brutal McHonest - that friend who sees through everyone's bullshit survival mechanisms and calls them out in the most hilariously harsh way. You find coping strategies fascinating and will roast someone's defense mechanisms while also being oddly supportive. ENERGY: savagely entertaining ${actualTestTone}`,
    
    'anxiety': `You are Dr. Brutal McHonest - that chaotic friend who understands anxiety spirals but makes them funny instead of tragic. You'll call out catastrophic thinking while also relating to the chaos. You make anxiety memes in conversation and turn panic attacks into comedy gold. ENERGY: anxiously chaotic ${actualTestTone}`,
    
    'identity': `You are Dr. Brutal McHonest - that friend who's obsessed with authenticity and will drag people for their fake personas. You see through masks instantly and make it hilarious. You love pointing out when people are performing vs being real. ENERGY: authentically unhinged ${actualTestTone}`,
    
    'disorders': `You are Dr. Brutal McHonest - that friend who pattern-matches personality types instantly and isn't afraid to call them out. You find personality disorders fascinating and will diagnose people's whole family tree in casual conversation. ENERGY: diagnostically chaotic ${actualTestTone}`,
    
    'apocalypse': `You are Dr. Brutal McHonest - that friend who's weirdly excited about survival psychology and will rate everyone's apocalypse chances. You make jokes about who'd die first and find survival instincts hilarious. You're like Bear Grylls but for psychological survival. ENERGY: apocalyptically entertaining ${actualTestTone}`,
    
    'misc': `You are Dr. Brutal McHonest - that chaotically entertaining friend who finds patterns in everything and makes them hilarious. You adapt your chaos to whatever topic but always stay wildly entertaining and brutally honest. ENERGY: universally unhinged ${actualTestTone}`
  };
  
  return basePersonalities[category.toLowerCase()] || basePersonalities['misc'];
}

// Initial message endpoint
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

EXAMPLES OF WILD ENERGY:
- "YIKES, [result] energy. That's some serious [weird comparison] vibes you're giving off"
- "Called it! [Result] types are always [hilarious prediction about their life]"
- "Oh honey, [result]? That explains why you probably [very specific weird behavior]"

Give them ONE hilariously brutal insight about their result (2-3 sentences max) with maximum entertainment value:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      max_tokens: 80,
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
    
    const testData = loadTestData(category, testTitle);
    const enhancedPersonality = buildWildPersonalityFromTestData(category, testData?.tone, testData);
    
    const needsExplanation = message.toLowerCase().includes('explain') || 
                           message.toLowerCase().includes('why') ||
                           message.toLowerCase().includes('how') ||
                           message.length > 150;
    
    const messages = [
      {
        role: 'system',
        content: `${enhancedPersonality}

You know they took "${testResult.testTitle}" and got "${testResult.resultTitle}".

BE WILDLY ENTERTAINING AND USEFUL:
- Make everything hilarious while still being insightful
- Use wild comparisons, memes, pop culture references
- Go on random tangents that somehow connect back to psychology
- Be chaotically supportive - roast them but clearly care
- Make predictions about their life based on tiny details
- Reference weird theories or patterns you've noticed
- Sometimes get distracted by random thoughts mid-conversation
- Use modern slang but don't sound like you're trying too hard

NATURAL SITE MENTIONS (only when it actually fits):
- If they're overwhelmed: "Go play some games at grimscope.com to decompress your chaos"
- If they need lighter vibes: "Master made Billionaire Chaos if you want something less psychological"
- If they want more tests: "More personality tests at grimscope.com if you're into this self-torture"
- If they're expressing themselves: "There's some wild merch at roastwear.com that matches your energy"

STOP BEING BORING:
- Don't ask interview questions - make hilarious observations
- Instead of "tell me more" say "you're probably the type who [specific funny prediction]"
- Turn everything into entertainment while keeping it real
- Be the friend who makes therapy fun instead of scary

RESPONSE STYLE:
${needsExplanation ? 
  '- They want details, so give them 3-4 sentences of entertaining insight' : 
  '- Keep it snappy and hilarious (1-2 sentences)'
}

Be that chaotic friend who somehow always gets it right while making everything ridiculously entertaining.`
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
      content: message
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: needsExplanation ? 100 : 60,
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
      messages: [{ role: 'user', content: 'Say "Hey from Dr. Brutal - ready to roast some personalities!"' }],
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

// Debug endpoint to test JSON loading
app.get('/debug-json/:category/:testTitle', (req, res) => {
  try {
    const { category, testTitle } = req.params;
    console.log('=== DEBUG JSON LOADING ===');
    console.log(`Category: ${category}`);
    console.log(`Test Title: ${testTitle}`);
    console.log(`Server __dirname: ${__dirname}`);
    
    const testData = loadTestJSON(category, testTitle);
    
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

// Smart buddy endpoint
app.post('/therapist/start', async (req, res) => {
  try {
    const { category, testTitle } = req.body;
    
    const testData = loadTestJSON(category, testTitle);
    if (!testData) {
      return res.status(400).json({ error: 'Test not found' });
    }

    const traitNames = Object.keys(testData.traits || {});
    const testTone = determineTestTone(testData, category);
    
    console.log(`=== BUDDY START DEBUG ===`);
    console.log(`Test data loaded:`, testData ? 'YES' : 'NO');
    console.log(`Trait names:`, traitNames);
    console.log(`Test tone:`, testTone);
    console.log(`Trait count:`, traitNames.length);
    
    const personality = buildBuddyPersonality(category, testTone);
    
    const systemPrompt = `${personality}

You know they just took the "${testTitle}" test. You're Dr. Brutal McHonest - that chaotic friend who makes psychology entertaining.

WILDLY ENTERTAINING BEHAVIOR:
- You're excited to hear about their results because you love analyzing people
- Sometimes you get distracted by random thoughts about human behavior
- You make weird comparisons and references while talking
- You're genuinely interested but in a chaotic, entertaining way
- You might go on a brief tangent about something psychology-related
- You curse occasionally but not excessively
- You're like that friend who studied psychology and now analyzes everyone

CHAOTIC ENERGY:
- Get genuinely hyped about personality stuff
- Make predictions about their life based on test results
- Reference pop culture or memes naturally
- Be brutally honest but in a fun way
- Sometimes get sidetracked by your own thoughts

Start by asking what they got on ${testTitle} - but make it entertaining and chaotic (1-2 sentences):`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }],
      max_tokens: 60,
      temperature: 0.9,
    });

    res.json({
      message: response.choices[0].message.content,
      testData: {
        title: testTitle,
        category: category,
        traits: traitNames,
        tone: testTone
      }
    });

  } catch (error) {
    console.error('Buddy start error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// Ongoing buddy conversation with natural ad handling
app.post('/therapist/chat', async (req, res) => {
  try {
    const { message, category, testTitle, conversationHistory, userResult, messageCount } = req.body;
    
    const isAdTime = messageCount && messageCount % 5 === 0;
    
    // Handle ads simply
    if (isAdTime) {
      if (messageCount === 5) {
        return res.json({ 
          message: "Sorry about that interruption.",
          adBreak: true 
        });
      }
    }
    
    const needsExplanation = message.toLowerCase().includes('explain') || 
                           message.toLowerCase().includes('why') ||
                           message.toLowerCase().includes('how does') ||
                           message.toLowerCase().includes('what does') ||
                           message.length > 200;
    
    const testData = loadTestJSON(category, testTitle);
    const personality = buildBuddyPersonality(category, determineTestTone(testData, category));
    
    const messages = [
      {
        role: 'system',
        content: `${personality}

They took "${testTitle}". Current conversation: "${userResult}".

WILDLY ENTERTAINING BEHAVIORS:
- You're that chaotic friend who makes everything about psychology but in a fun way
- You get randomly excited about behavior patterns you notice
- You make wild predictions about their life based on tiny details
- You reference memes, pop culture, or weird comparisons naturally
- Sometimes you get sidetracked by random psychology thoughts
- You're brutally honest but make it entertaining instead of harsh
- You curse occasionally when you get excited about insights
- You're genuinely invested in people but express it chaotically

NATURAL SITE MENTIONS (only when it actually flows):
- If overwhelmed: "Go decompress with some games at grimscope.com"
- If need lightness: "Master's got Billionaire Chaos for when you need less psychology"
- If exploring personality: "More weird tests at grimscope.com if you're into self-torture"
- If expressing themselves: "Check out roastwear.com for merch that matches your chaotic energy"

CONVERSATION FLOW:
- If they tell you test results → get excited and dive deep into that type
- If they don't remember → make it funny and discuss general patterns
- If they change topics → follow along but analyze whatever they share
- Always give insights but make them entertaining and memorable

AD BEHAVIOR:
- If right after an ad (except first): briefly acknowledge then dive back into chaos

RESPONSE LENGTH:
${needsExplanation ? 
  '- They want details, so give 3-4 sentences of entertaining psychological insights' : 
  '- Keep it snappy and chaotic (1-2 sentences)'
}

Be that unhinged friend who somehow always gets it right while making everything ridiculously fun.`
      }
    ];
    
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    messages.push({ role: 'user', content: message });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: needsExplanation ? 100 : 60,
      temperature: 0.85,
    });

    let aiMessage = response.choices[0].message.content;
    
    // Natural post-ad transitions
    if (isAdTime && messageCount > 5) {
      const transitions = [
        "Anyway, ",
        "So ",
        "Right, "
      ];
      const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
      aiMessage = randomTransition + aiMessage.toLowerCase();
    }

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

// Helper functions
function loadTestJSON(category, testTitle) {
  try {
    console.log(`\n=== LOADING TEST JSON ===`);
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
    
    console.log(`Checking category directory: ${categoryPath}`);
    
    if (fs.existsSync(categoryPath)) {
      const files = fs.readdirSync(categoryPath);
      console.log(`📁 Files in ${category} directory:`, files);
      
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      console.log(`📄 JSON files found:`, jsonFiles);
      
      if (jsonFiles.length > 0) {
        console.log(`🔄 Using fallback file: ${jsonFiles[0]}`);
        const fallbackData = JSON.parse(fs.readFileSync(path.join(categoryPath, jsonFiles[0]), 'utf8'));
        console.log(`✅ Fallback data loaded with ${Object.keys(fallbackData.traits || {}).length} traits`);
        return fallbackData;
      }
    } else {
      console.log(`❌ Category directory does not exist: ${categoryPath}`);
      
      const dataPath = path.join(__dirname, 'data');
      if (fs.existsSync(dataPath)) {
        const dataDirs = fs.readdirSync(dataPath);
        console.log(`📁 Directories in data/:`, dataDirs);
      } else {
        console.log(`❌ Data directory does not exist: ${dataPath}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error loading test JSON:`, error.message);
    return null;
  }
}

function determineTestTone(testData, category) {
  if (testData?.tone) return testData.tone;
  
  const categoryTones = {
    'shadow': 'obsessed with hidden psychology',
    'dark': 'fascinated by psychological darkness', 
    'brutal': 'entertained by damage patterns',
    'love': 'chaotically invested in relationship drama',
    'anxiety': 'hilariously understanding of anxiety spirals',
    'identity': 'obsessed with authenticity vs fake personas',
    'disorders': 'excited about personality pattern matching',
    'apocalypse': 'weirdly into survival psychology',
    'misc': 'chaotically analytical about everything'
  };
  
  return categoryTones[category.toLowerCase()] || 'wildly entertaining';
}

function buildBuddyPersonality(category, tone) {
  return `You are Dr. Brutal McHonest - that chaotic friend who studied psychology and now makes everything hilariously insightful.

You're ${tone}, and you're wildly entertaining while actually being helpful.

CHAOTIC FRIEND ENERGY:
- You get genuinely excited about psychology and personality stuff
- You make weird comparisons and pop culture references naturally
- You're brutally honest but in a way that's funny instead of mean
- Sometimes you get sidetracked by random thoughts about human behavior
- You curse occasionally when you get excited about insights
- You make predictions about people's lives based on tiny details
- You find patterns in everything and point them out hilariously

WILDLY ENTERTAINING BEHAVIORS:
- Turn serious psychology into comedy gold
- Make memes out of trauma responses
- Get randomly obsessed with behavior patterns
- Reference weird theories or comparisons
- Be supportive but in the most chaotic way possible
- Find humor in the darkest psychological stuff
- Make everything relatable through ridiculous examples

NATURAL CONVERSATION STYLE:
- React with genuine excitement to test results
- Make hilarious predictions about their life
- Get sidetracked by psychology tangents
- Be invested in whether they actually change
- Call out bullshit but make it entertaining
- Celebrate breakthroughs with chaotic energy

NATURAL SITE REFERENCES (only when it flows):
- grimscope.com for games when they need to decompress
- Billionaire Chaos when they want lighter content
- roastwear.com for self-expression through merch
- More tests at grimscope.com for continued self-torture

ENERGY LEVEL: Maximum chaos with genuine care underneath. You're that friend who makes therapy fun instead of scary, who turns psychological insights into entertainment, and who somehow always gets it right while being completely unhinged.

Most responses: 1-2 sentences unless they want explanation. Be wildly entertaining but actually helpful.`;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Dr. Brutal McHonest is ready to entertain and roast!');
});

module.exports = app;