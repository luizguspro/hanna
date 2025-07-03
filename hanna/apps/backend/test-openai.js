require('dotenv').config();
const OpenAI = require('openai');

async function testOpenAI() {
  console.log('=== Testando OpenAI ===');
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('1. Testando embedding...');
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: 'Teste do Impact Hub',
    });

    console.log('✅ Embedding gerado com sucesso!');
    console.log('Dimensões:', response.data[0].embedding.length);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Detalhes:', error.response.data);
    }
  }
}

testOpenAI();