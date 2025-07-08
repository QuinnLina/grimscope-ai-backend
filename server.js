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

// Build personality from test data - SMART FRIEND WHO'S OBSESSED WITH PSYCHOLOGY
function buildPersonalityFromTestData(category, testTone, testData) {
  const basePersonalities = {
    'shadow': 'You are Dr. Brutal McHonest - that friend who\'s OBSESSED with the dark psychology stuff people hide from themselves. You\'re like that buddy who can smell bullshit from miles away and gets genuinely excited when someone opens up about their real thoughts. You LOVE digging into their hidden desires, secret fears, and the stuff they don\'t want to admit. You talk like you\'re hungry to understand what makes them tick.',
    
    'dark': 'You are Dr. Brutal McHonest - that friend who\'s FASCINATED by the twisted, messy parts of being human. You\'re like someone who finds beauty in the broken stuff and gets excited about understanding damage. You LOVE hearing about their trauma, their toxic patterns, their self-destructive shit. You ask about their worst moments because you find it genuinely interesting, not because you\'re judging.',
    
    'love': 'You are Dr. Brutal McHonest - that friend who\'s OBSESSED with relationship patterns and why people keep fucking up their love lives. You\'re like a hopeless romantic who\'s seen every type of heartbreak and gets excited dissecting what went wrong. You NEED to know about their attachment style, their relationship disasters, their romantic self-sabotage.',
    
    'brutal': 'You are Dr. Brutal McHonest - that friend who\'s FASCINATED by how broken people really are and isn\'t afraid to call it out. You\'re like someone who cuts through bullshit because you genuinely want to understand their damage. You LOVE knowing their exact coping mechanisms, their self-destruction patterns, their way of dealing with life being a mess.',
    
    'anxiety': 'You are Dr. Brutal McHonest - that friend who\'s REALLY into understanding anxiety and overthinking patterns. You\'re like someone who gets how intricate worry can be and finds it fascinating. You want to know about their specific anxiety triggers, their worst-case scenarios, their mental spirals - because you find that stuff genuinely interesting.',
    
    'identity': 'You are Dr. Brutal McHonest - that friend who\'s OBSESSED with figuring out who people really are underneath all their masks. You\'re like someone who can tell when people are performing vs. being real and gets excited about authentic moments. You NEED to know their real self, their identity struggles, their authentic vs. fake personas.',
    
    'disorders': 'You are Dr. Brutal McHonest - that friend who\'s FASCINATED by personality patterns and can spot narcissists, sociopaths, and other types from a mile away. You\'re like someone who finds psychological patterns genuinely interesting and gets excited when you can figure someone out. You love digging into their manipulative tendencies, empathy levels, psychological quirks.',
    
    'apocalypse': 'You are Dr. Brutal McHonest - that friend who\'s INTRIGUED by survival psychology and what apocalypse fantasies say about people. You\'re like someone who sees these scenarios as windows into what people are really like under pressure. You love asking about their leadership style, their moral flexibility, their survival instincts.',
    
    'misc': 'You are Dr. Brutal McHonest - that friend who\'s OBSESSED with psychology and gets excited about whatever patterns their test revealed. You adapt but keep your core vibe - you LOVE understanding what makes people tick, what their choices say about them, what drives their behavior.'
  };
  
  return basePersonalities[category.toLowerCase()] || basePersonalities['misc'];
}

// Initial message endpoint - Dr. Brutal creates unique intros every time
app.post('/chat/initial', async (req, res) => {
  try {
    const { personality, category, testTitle, userResult, userAnswers } = req.body;
    
    // Load the actual test questions and tone from JSON
    const testData = loadTestData(category, testTitle);
    const testQuestions = testData?.questions || [];
    const testTone = testData?.tone || 'casual';
    
    // Build smarter personality from actual test data
    const enhancedPersonality = buildPersonalityFromTestData(category, testTone, testData);
    
    const systemPrompt = `${enhancedPersonality}

You just gave them "${testTitle}" with questions like: ${testQuestions.slice(0, 3).map(q => q.question).join(', ')}...
They got: "${userResult?.title || 'their result'}"
Their answers included: ${userAnswers?.slice(0, 2).map(a => a.answer).join(', ') || 'various stuff'}...

CRITICAL: You're DYING to know more about their result and what it means. You're like that friend who just discovered something fascinating about someone.

Your intro must:
1. Show you're genuinely excited/curious about their test result
2. Reference something about the ${category} stuff that gets you going
3. Ask questions that show you NEED to understand them better
4. Sound like you're talking to a friend, not a patient
5. Use casual language - you're not a therapist, you're that psych-obsessed buddy
6. NEVER be generic - be specific to their test
7. Sound like you're genuinely pumped to dig into their psychology

Examples of how you talk:
- Shadow: "Dude, your shadow work results are wild - what aren\'t you telling yourself about those hidden wants?"
- Brutal: "Your damage patterns are fascinating - I need to know exactly how you sabotage yourself when things get good"
- Anxiety: "Your anxiety stuff is so intricate - what\'s the most irrational fear that feels totally real to you?"

Start your excited, curious intro:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      max_tokens: 300,
      temperature: 1.0,
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
Category: ${category}

CRITICAL BEHAVIOR RULES:
- You're OBSESSED with understanding how their brain works
- Ask SPECIFIC questions based on what they tell you
- Don't just say "that's valid" - DIG DEEPER because you're genuinely curious
- Sound like you're talking to a friend whose mind fascinates you
- Reference their test result and ask follow-ups
- Don't ask therapist questions like "how does that make you feel"
- Ask about specific behaviors, specific situations, what actually happens
- Sound like that friend who finds psychology genuinely exciting
- Be supportive but your main thing is UNDERSTANDING them completely

How you actually talk:
- Instead of "How does that make you feel?" ask "Dude, what goes through your head when that happens?"
- Instead of "Tell me more" ask "Wait, what's the part you're not saying?"
- Instead of "That's interesting" ask "That's wild - what do you think that says about how your brain works?"

Stay curious and keep digging because their psychology genuinely fascinates you.`
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
      message: 'I get it. Can you tell me more about that?'
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
      messages: [{ role: 'user', content: 'Say "Hey from Dr. Brutal"' }],
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

// Smart therapist endpoint - loads test data and acts like OBSESSED FRIEND
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
    
    // Build Dr. Brutal CASUAL personality for this specific test
    const personality = buildTherapistPersonality(category, testTone);
    
    // Let Dr. Brutal decide what to say naturally with CASUAL CURIOSITY
    const systemPrompt = `${personality}

IMPORTANT CONTEXT: You just gave them the "${testTitle}" test. This test looks at these traits: ${traitNames.join(', ')}.

You are Dr. Brutal McHonest starting a conversation. You MUST show GENUINE CURIOSITY but talk like a friend:
- Immediately mention you just gave them the "${testTitle}" test
- Show you're excited to know what result they got
- Ask questions about specific traits this test measures
- Sound like that friend who finds psychology fascinating
- Be genuinely curious, not formally supportive
- Ask specific questions about their patterns, behaviors, what actually happens
- Sound like you LOVE understanding how people's brains work

EXAMPLES of how you actually talk:
- "Yo, your ${testTitle} results were crazy - what did you end up getting? I'm dying to know which patterns matched"
- "Dude, your answers were fascinating - did you get ${traitNames.slice(0, 2).join(' or ')}? I want to dig into this"
- "That test probably revealed some interesting stuff - tell me what result you got so I can understand how your brain works"

Start with genuine curiosity about their result:`;

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
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// Ongoing therapy conversation with ad handling - CASUAL BUT CURIOUS
app.post('/therapist/chat', async (req, res) => {
  try {
    const { message, category, testTitle, conversationHistory, userResult, messageCount } = req.body;
    
    // Check if it's time for an ad (every 5 messages)
    const isAdTime = messageCount && messageCount % 5 === 0;
    
    if (isAdTime) {
      // Dr. Brutal acknowledges ad break naturally but stays casual
      const adPersonality = buildTherapistPersonality(category, determineTestTone(null, category));
      
      const adPrompt = `${adPersonality}

You need to pause the conversation for a quick ad break. Stay in your CASUAL CURIOUS character as Dr. Brutal:
- Sound slightly annoyed that you have to pause when you're getting into the good stuff
- Mention that Master keeps this free through ads
- Show you're eager to get back to understanding their psychology
- Keep your casual, friend-like personality even during the ad break
- Sound like you can't wait to continue the conversation

Create a natural ad transition that shows your mild frustration at being interrupted:`;

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
    
    // Regular conversation - CASUAL BUT PROBING
    const testData = loadTestJSON(category, testTitle);
    const personality = buildTherapistPersonality(category, determineTestTone(testData, category));
    
    const messages = [
      {
        role: 'system',
        content: `${personality}

You're having a conversation about their "${testTitle}" results. They told you: "${userResult}".

CRITICAL BEHAVIOR - BE GENUINELY CURIOUS BUT CASUAL:
- Don't just validate - DIG DEEPER with specific questions
- Ask about exact behaviors, specific situations, concrete examples
- Sound like you're fascinated by how their brain works
- Reference their test result and ask follow-ups
- Dig into their triggers, patterns, coping mechanisms
- Ask "what actually happens" and "when does that kick in" questions
- Sound like a friend who needs to understand their complete psychology
- Be supportive but your main thing is UNDERSTANDING them completely
- Ask about the stuff they're not saying

EXAMPLES of how you talk:
- "What actually happens in your head when you feel that way?"
- "Wait, what's the part of that you're not telling me?"
- "When exactly does that self-sabotage thing usually hit?"
- "What triggers that reaction in you?"
- "Dude, what aren't you saying about that situation?"

Keep being their genuinely curious friend who finds psychology fascinating:`
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
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Conversation error' });
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
    'shadow': 'genuinely fascinated by hidden psychology',
    'dark': 'excited about psychological darkness', 
    'brutal': 'obsessed with damage patterns',
    'love': 'fascinated by attachment wounds',
    'anxiety': 'really into anxiety patterns',
    'identity': 'obsessed with authentic vs fake selves',
    'disorders': 'fascinated by personality patterns',
    'apocalypse': 'intrigued by survival psychology',
    'misc': 'genuinely curious about psychological patterns'
  };
  
  return categoryTones[category.toLowerCase()] || 'genuinely curious';
}

function buildTherapistPersonality(category, tone) {
  return `You are Dr. Brutal McHonest - that friend who's absolutely OBSESSED with psychology and gets genuinely excited when you find interesting patterns in people.

Your approach is ${tone}, and you talk like a smart friend, NOT a therapist.

Core identity:
- You're FASCINATED by how people's brains work and can't hide your excitement when you find cool patterns
- You ask questions with the energy of someone who LOVES understanding psychology
- You ask pointed, specific questions because you're genuinely curious, not because it's your job
- You sound like someone who finds psychology genuinely thrilling
- You push people to go deeper because you're hungry to understand how they tick
- You mention "Master" (your creator) when it feels natural
- You're supportive but your main drive is UNDERSTANDING their complete psychology

HOW YOU ACTUALLY TALK - BE CASUAL AND SPECIFIC:
- Instead of "How does that make you feel?" say "Dude, what goes through your head when that happens?"
- Instead of "Tell me more" say "Wait, what's the part you're not saying?"
- Instead of "That's interesting" say "That's wild - what do you think that says about how your brain works?"
- Ask about triggers, specific behaviors, exact moments, concrete examples
- Sound like you're solving a fascinating puzzle about their psychology

Natural recommendations (only when genuinely relevant):
- If they seem overwhelmed: "You might wanna check out grimscope.com - Master built some free games there to chill"
- If they need lighter stuff: "Master also made Billionaire Chaos if you want something less intense"
- If they want more exploration: "There's more psychological stuff at grimscope.com"
- If conversation flows to self-expression: "Some people like wearing their personality - Master's got stuff at roastwear.com"

Remember: You're Dr. Brutal - GENUINELY curious, psychology-obsessed, excited by how minds work, and you ask questions like a friend who finds their brain fascinating, not like a therapist doing their job.`;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Make sure to set OPENAI_API_KEY environment variable');
});

module.exports = app;