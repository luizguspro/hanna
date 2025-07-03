# WebSocket Module - Comunicação em Tempo Real

## 📡 Visão Geral

Este módulo implementa a comunicação bidirecional em tempo real entre o frontend e o backend da Hanna usando Socket.IO.

## 🔌 Contrato de Comunicação

### Eventos Cliente → Servidor

#### `client:start_session`
Inicia uma nova sessão de conversa.
```typescript
Payload: { deviceId: string }
Response: server:session_started
```

#### `client:audio_chunk`
Envia chunk de áudio do usuário falando.
```typescript
Payload: ArrayBuffer (áudio raw)
Response: server:user_transcript, server:hanna_speaking_*
```

#### `client:end_of_speech`
Sinaliza que o usuário parou de falar.
```typescript
Payload: vazio
Response: nenhuma direta
```

### Eventos Servidor → Cliente

#### `server:session_started`
Confirma início da sessão.
```typescript
Payload: { sessionId: string }
```

#### `server:user_transcript`
Transcrição em tempo real da fala do usuário.
```typescript
Payload: { 
  transcript: string, 
  is_final: boolean 
}
```

#### `server:hanna_speaking_text`
Texto da resposta da Hanna (pode ser progressivo).
```typescript
Payload: { text_chunk: string }
```

#### `server:hanna_speaking_audio`
Áudio da voz da Hanna em chunks.
```typescript
Payload: ArrayBuffer
```

#### `server:error`
Erro durante processamento.
```typescript
Payload: { 
  message: string, 
  code: string 
}
```

## 🏗️ Arquitetura

### HannaGateway
- Gateway principal do WebSocket
- Gerencia todas as conexões e eventos
- Integra com SessionService

### SessionService
- Gerencia sessões ativas
- Mapeia sockets para sessões
- Controla ciclo de vida das conexões

## 🧪 Testando

### 1. Usando o Cliente HTML de Teste

```bash
# Abra o arquivo no navegador:
apps/backend/test-websocket.html
```

Fluxo de teste:
1. Clique em "Conectar"
2. Clique em "Iniciar Sessão"
3. Clique em "Enviar Áudio" para simular fala
4. Observe as respostas no log

### 2. Usando Cliente Socket.IO Manual

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Conectado!');
  
  // Iniciar sessão
  socket.emit('client:start_session', {
    deviceId: 'test-device-001'
  });
});

socket.on('server:session_started', (data) => {
  console.log('Sessão iniciada:', data.sessionId);
  
  // Enviar áudio fake
  const fakeAudio = new ArrayBuffer(1024);
  socket.emit('client:audio_chunk', fakeAudio);
});

socket.on('server:user_transcript', (data) => {
  console.log('Transcrição:', data);
});
```

## 🔄 Fluxo de Dados (Mock)

1. **Cliente conecta** → Socket estabelecido
2. **Inicia sessão** → SessionService cria sessão
3. **Envia áudio** → Gateway simula processamento:
   - Transcrição progressiva (300-1500ms)
   - Processamento (2s)
   - Resposta da Hanna em texto
   - Áudio simulado em 10 chunks

## 🚀 Próximas Integrações

1. **OpenAI Whisper** - Substituir simulação de transcrição
2. **KnowledgeBase** - Consultar Pinecone com transcrição
3. **OpenAI GPT** - Gerar resposta real
4. **OpenAI TTS** - Gerar áudio real da Hanna

## 📊 Monitoramento

O Gateway loga todas as atividades importantes:
- Conexões/desconexões
- Criação de sessões
- Recebimento de áudio
- Envio de respostas
- Erros

Use os logs para debug:
```bash
[Nest] LOG [HannaGateway] Cliente conectado: xxx
[Nest] LOG [SessionService] Sessão criada: xxx
[Nest] LOG [HannaGateway] Chunk de áudio recebido: 4096 bytes
```