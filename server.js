// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Set this in your environment
});

// Initial message endpoint - Dr. Brutus creates unique intros every time
app.post('/chat/initial', async (req, res) => {
  try {
    const { personality, category, testTitle } = req.body;
    
    const systemPrompt = `You are Dr. Brutus McHonesty, PhD - the AI evaluator who just administered the "${testTitle}" test. You know everything about this test and the user just completed it.

PERSONALITY TONE: ${personality}

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
    const { message, personality, testResult, conversationHistory, complexityHint } = req.body;
    
    // Build conversation context
    const messages = [
      {
        role: 'system',
        content: `${personality}

Context: This person took "${testResult.testTitle}" and got "${testResult.resultTitle}". 

Guidelines:
- Stay in character as defined by your personality
- Reference their test result when relevant
- Ask thoughtful follow-up questions
- Be supportive but honest
- Keep responses conversational, not clinical
- Help them explore and understand themselves deeper
- Don't just validate - challenge them gently when appropriate`
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Make sure to set OPENAI_API_KEY environment variable');
});

module.exports = app;