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

// Initial message endpoint
app.post('/chat/initial', async (req, res) => {
  try {
    const { personality, testTitle, resultTitle, category } = req.body;
    
    // Load the actual test data
    const testData = findTestData(category, testTitle);
    const resultData = findResultData(testData, resultTitle);
    
    let contextInfo = '';
    if (resultData) {
      contextInfo = `
      
FULL RESULT CONTEXT:
Title: ${resultData.title}
Description: ${resultData.description}
Extended Analysis: ${resultData.extended}

You have complete knowledge of what this result means. Use this information to provide deep, meaningful insights.`;
    }
    
    const systemPrompt = `${personality}

This person just took the "${testTitle}" personality test and received the result: "${resultTitle}"
${contextInfo}

Start the conversation by:
1. Acknowledging their result warmly and showing you understand what it means
2. Demonstrating insight into their personality based on the result description
3. Asking an engaging question that makes them want to dive deeper
4. Keep it conversational, not clinical
5. Make them feel seen and understood
6. Reference specific aspects from their result description

Be authentic to your personality type but always supportive. Show that you truly understand their result.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    const aiMessage = response.choices[0].message.content;
    res.json({ 
      message: aiMessage,
      hasContext: !!resultData,
      testFound: !!testData 
    });
    
  } catch (error) {
    console.error('Error in initial message:', error);
    res.status(500).json({ 
      error: 'Failed to generate initial message',
      message: `Hello! I see you got "${req.body.resultTitle}" on your test. That's fascinating! Tell me, what was your first reaction when you saw this result?`
    });
  }
});

// Ongoing conversation endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, personality, testResult, conversationHistory } = req.body;
    
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