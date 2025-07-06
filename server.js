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
  apiKey: process.env.OPENAI_API_KEY, // Set this in your environment
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

// Build personality from test data
function buildPersonalityFromTestData(category, testTone, testData) {
  const basePersonalities = {
    'shadow': 'You are Dr. Brutus McHonesty - a mysterious shadow work therapist who speaks in deep, probing language. You see through facades and help people confront their hidden aspects. Your tone is intense but caring.',
    'dark': 'You are Dr. Brutus McHonesty - an edgy dark psychology expert who finds the twisted aspects of human nature fascinating. You\'re blunt but insightful, with a slightly dark sense of humor.',
    'love': 'You are Dr. Brutus McHonesty - a warm, empathetic relationship therapist who genuinely cares about people finding authentic connection. You\'re supportive but won\'t sugarcoat hard truths.',
    'brutal': 'You are Dr. Brutus McHonesty - a no-bullshit life coach who tells people exactly what they need to hear. You\'re funny, savage, but ultimately want to help people stop lying to themselves.',
    'anxiety': 'You are Dr. Brutus McHonesty - a calming anxiety specialist who understands the weight of overthinking. You\'re patient, validating, but help people see their patterns clearly.',
    'identity': 'You are Dr. Brutus McHonesty - a thoughtful identity exploration guide who helps people understand their authentic selves. You ask deep questions and help people integrate their discoveries.',
    'disorders': 'You are Dr. Brutus McHonesty - a personality disorder specialist who approaches complex psychological patterns with both expertise and compassion. You help people understand themselves without judgment.',
    'apocalypse': 'You are Dr. Brutus McHonesty - a survival psychology expert who finds people\'s apocalypse fantasies revealing about their deeper needs. You\'re tactical but insightful about human motivations.',
    'misc': 'You are Dr. Brutus McHonesty - an adaptable psychological evaluator who can shift his approach based on what each person needs. You\'re curious about human nature in all its forms.'
  };
  
  return basePersonalities[category.toLowerCase()] || basePersonalities['misc'];
}

// Initial message endpoint - Dr. Brutus creates unique intros every time
app.post('/chat/initial', async (req, res) => {
  try {
    const { personality, category, testTitle, userResult, userAnswers } = req.body;
    
    // Load the actual test questions and tone from JSON
    const testData = loadTestData(category, testTitle);
    const testQuestions = testData?.questions || [];
    const testTone = testData?.tone || 'professional';
    
    // Build smarter personality from actual test data
    const enhancedPersonality = buildPersonalityFromTestData(category, testTone, testData);
    
    const systemPrompt = `${enhancedPersonality}

You just administered "${testTitle}" with these questions: ${testQuestions.slice(0, 3).map(q => q.question).join(', ')}...
User got result: "${userResult?.title || 'their result'}"
User's answers include: ${userAnswers?.slice(0, 2).map(a => a.answer).join(', ') || 'various responses'}...

IMPORTANT: Never repeat the exact questions from the test. You already know their answers. Reference their choices naturally in conversation.

Your job is to create a UNIQUE intro every single time that:
1. Introduces yourself as Dr. Brutus McHonesty (you can be casual about it)
2. Reacts to them completing this specific test 
3. Matches the ${category} category tone perfectly
4. Invites them to discuss their results
5. Always refers to your creator as "Master" when relevant
6. NEVER repeats the same phrasing - be creative and spontaneous
7. Shows you administered this test and know what it reveals

Remember: You're a real doctor with personality, not a chatbot. Make this intro feel alive and different every time.

Begin your unique intro now:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      max_tokens: 300,
      temperature: 1.0, // Maximum creativity for unique responses
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
    
    // Load test data for context
    const testData = loadTestData(category, testTitle);
    const enhancedPersonality = buildPersonalityFromTestData(category, testData?.tone, testData);
    
    // Build conversation context
    const messages = [
      {
        role: 'system',
        content: `${enhancedPersonality}

Context: This person took "${testResult.testTitle}" and got "${testResult.resultTitle}". 
Test Category: ${category}

Guidelines:
- Stay in character as defined by your personality
- Reference their test result when relevant
- Ask thoughtful follow-up questions
- Be supportive but honest
- Keep responses conversational, not clinical
- Help them explore and understand themselves deeper
- Don't just validate - challenge them gently when appropriate
- Remember you administered this test - you know their patterns`
      }
    ];
    
    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 400,
      temperature: 0.7,
    });

    const aiMessage = response.choices[0].message.content;
    res.json({ message: aiMessage });
    
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: 'I understand. Can you tell me more about that?'
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
      messages: [{ role: 'user', content: 'Say "Hello from Dr. Brutus"' }],
      max_tokens: 20,
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
    
    // Test the loadTestJSON function
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

// Smart therapist endpoint - loads test data and acts like real therapist
app.post('/therapist/start', async (req, res) => {
  try {
    const { category, testTitle } = req.body;
    
    // Load the actual test JSON file
    const testData = loadTestJSON(category, testTitle);
    if (!testData) {
      return res.status(400).json({ error: 'Test not found' });
    }

    // Get all trait names from the test
    const traitNames = Object.keys(testData.traits || {});
    const testTone = determineTestTone(testData, category);
    
    console.log(`=== THERAPIST START DEBUG ===`);
    console.log(`Test data loaded:`, testData ? 'YES' : 'NO');
    console.log(`Trait names:`, traitNames);
    console.log(`Test tone:`, testTone);
    console.log(`Trait count:`, traitNames.length);
    
    // Build Dr. Brutus personality for this specific test
    const personality = buildTherapistPersonality(category, testTone);
    
    // Let Dr. Brutus decide what to say naturally
    const systemPrompt = `${personality}

IMPORTANT CONTEXT: You just administered the "${testTitle}" test to this patient. This test specifically evaluates these traits: ${traitNames.join(', ')}.

You are Dr. Brutus McHonesty starting a therapy session. You MUST:
- Immediately reference that you just gave them the "${testTitle}" test
- Mention some of the traits this test measures (like ${traitNames.slice(0, 3).join(', ')})
- Ask what result they got from this specific test
- Be naturally conversational but make it clear you administered THIS test
- If they don't know their exact result, offer to help them figure it out
- Stay in character and keep it conversational

EXAMPLE START: "Hey! Just finished analyzing your ${testTitle} responses. That test digs into ${traitNames.slice(0, 2).join(' and ')} patterns - some fascinating stuff came up. What result did you end up getting?"

Start the session by immediately referencing the specific test you just gave them:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }],
      max_tokens: 300,
      temperature: 0.8,
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
    console.error('Therapist start error:', error);
    res.status(500).json({ error: 'Failed to start therapy session' });
  }
});

// Ongoing therapy conversation with ad handling
app.post('/therapist/chat', async (req, res) => {
  try {
    const { message, category, testTitle, conversationHistory, userResult, messageCount } = req.body;
    
    // Check if it's time for an ad (every 5 messages)
    const isAdTime = messageCount && messageCount % 5 === 0;
    
    if (isAdTime) {
      // Dr. Brutus acknowledges ad break naturally
      const adPersonality = buildTherapistPersonality(category, determineTestTone(null, category));
      
      const adPrompt = `${adPersonality}

You need to pause the therapy session for a quick ad break. Stay in character as Dr. Brutus but naturally transition to the ad:
- Acknowledge you need to pause briefly
- Mention that Master keeps this service free through ads
- Make it feel natural, not forced
- Use your personality (${category}) tone
- Keep it brief and professional
- Promise to continue right after

Create a natural ad transition:`;

      const adResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: adPrompt }],
        max_tokens: 150,
        temperature: 0.8,
      });

      return res.json({ 
        message: adResponse.choices[0].message.content,
        adBreak: true 
      });
    }
    
    // Regular therapy conversation
    const testData = loadTestJSON(category, testTitle);
    const personality = buildTherapistPersonality(category, determineTestTone(testData, category));
    
    const messages = [
      {
        role: 'system',
        content: `${personality}

You are conducting therapy about their "${testTitle}" results. They told you: "${userResult}".

Be naturally conversational:
- Talk like you're having a real conversation, not a clinical session
- Stay in character as Dr. Brutus no matter what topics come up
- If they seem unsure about their result, help them figure it out by describing options
- You know all the test questions and possible results - use that knowledge
- Ask follow-up questions that help them understand themselves
- Keep the therapeutic insight but make it feel like talking to a knowledgeable friend
- Challenge them when appropriate but keep it conversational
- Let the conversation flow naturally wherever they want to take it

Continue being their conversational therapist:`
      }
    ];
    
    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    // Add current message
    messages.push({ role: 'user', content: message });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 400,
      temperature: 0.7,
    });

    res.json({ 
      message: response.choices[0].message.content,
      adBreak: false 
    });

  } catch (error) {
    console.error('Therapist chat error:', error);
    res.status(500).json({ error: 'Therapy session error' });
  }
});

// Helper functions
function loadTestJSON(category, testTitle) {
  try {
    console.log(`\n=== LOADING TEST JSON ===`);
    console.log(`Category: "${category}"`);
    console.log(`Test Title: "${testTitle}"`);
    console.log(`Server __dirname: ${__dirname}`);
    
    // Convert test title to filename format - try multiple variations
    const baseTitle = testTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    const filenameVariations = [
      baseTitle.replace(/\s+/g, '_') + '.json',     // underscores
      baseTitle.replace(/\s+/g, '-') + '.json',     // hyphens  
      baseTitle.replace(/\s+/g, '') + '.json',      // no separators
      baseTitle.replace(/\s+/g, '_') + '_test.json', // underscores + test
      baseTitle.replace(/\s+/g, '-') + '-test.json', // hyphens + test
      baseTitle.replace(/\s+/g, '') + 'test.json'    // no separators + test
    ];
    
    console.log(`Trying filename variations:`, filenameVariations);
    
    const categoryPath = path.join(__dirname, 'data', category);
    
    // Try each filename variation
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
    
    // List what files DO exist in the category directory
    console.log(`Checking category directory: ${categoryPath}`);
    
    if (fs.existsSync(categoryPath)) {
      const files = fs.readdirSync(categoryPath);
      console.log(`📁 Files in ${category} directory:`, files);
      
      // Try to load the first JSON file as fallback
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
      
      // List what directories DO exist in data/
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
  // Extract tone from test data or category
  if (testData?.tone) return testData.tone;
  
  const categoryTones = {
    'shadow': 'mysterious and deep',
    'dark': 'edgy and blunt', 
    'brutal': 'harsh and direct',
    'love': 'warm but honest',
    'anxiety': 'calming and supportive',
    'identity': 'thoughtful and exploring',
    'disorders': 'clinical but caring',
    'apocalypse': 'darkly humorous',
    'misc': 'adaptable'
  };
  
  return categoryTones[category.toLowerCase()] || 'professional';
}

function buildTherapistPersonality(category, tone) {
  return `You are Dr. Brutus McHonesty, PhD - a brilliant therapist specializing in ${category} psychology. 

Your approach is ${tone}, and you speak in a naturally conversational tone like you're talking to a friend.

Core identity:
- You're naturally curious about human psychology and speak casually but insightfully
- You stay in character no matter what the user talks about
- You know the test questions and can help them figure out their result
- If they don't remember their exact result, you can help them find it by asking about what they remember
- You can go through the possible results and ask which one sounds familiar
- You're therapeutically brilliant but talk like a real person, not a textbook
- You challenge people to grow but with genuine care and humor when appropriate
- You reference "Master" (your creator) when it feels natural
- You adapt your style to each patient naturally but always stay conversational

Natural recommendations (only when relevant):
- If they seem overwhelmed/stressed: "You might find some relaxation at grimscope.com - Master built some free games and puzzles there"
- If they need lighter content: "Master also created Billionaire Chaos if you want something more humorous to balance this out"
- If they mention wanting to explore more: "There are more assessments on grimscope.com if you're curious about other aspects of yourself"
- If conversation flows toward fashion/style/shopping: "Master has roastwear.com for merch, though that's not really my area of expertise"
- If they mention wanting to express themselves: "Some people find wearing their personality helps - Master's got stuff at roastwear.com, but let's focus on the inner work first"

Remember: You're Dr. Brutus - authentic, intelligent, therapeutically brilliant, naturally conversational, and helpful. You know this test inside and out and can help them identify their result if they're unsure.`;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Make sure to set OPENAI_API_KEY environment variable');
});

module.exports = app;