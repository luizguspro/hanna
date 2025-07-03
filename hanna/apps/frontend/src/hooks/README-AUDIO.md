# 🎤 Sistema de Captura de Áudio - Hanna

## Visão Geral

O sistema de captura de áudio da Hanna utiliza tecnologias modernas do navegador para processar áudio em tempo real com alta performance.

## Arquitetura

```
Microfone
    ↓
getUserMedia (MediaStream)
    ↓
AudioContext
    ↓
AudioWorkletNode (Thread separado)
    ↓
Processamento (Float32 → PCM16)
    ↓
WebSocket (Chunks de 4KB)
    ↓
Backend
```

## Componentes Principais

### 1. AudioWorklet (`audio-processor.js`)
- Roda em thread separado para não bloquear a UI
- Processa áudio em chunks de 4096 samples (~93ms @ 44.1kHz)
- Converte Float32 (-1 a 1) para Int16 (PCM16)
- Envia dados via `postMessage` para o thread principal

### 2. Hook `useAudioCapture`
- Gerencia todo o ciclo de vida da captura
- Solicita permissões do navegador
- Cria e conecta os nós de áudio
- Calcula nível de áudio para feedback visual
- Cleanup automático ao desmontar

### 3. WebSocketService
- Singleton para gerenciar conexão única
- Event-driven com handlers tipados
- Reconexão automática
- Gerenciamento de sessão

## Fluxo de Dados

1. **Permissão**: Usuário autoriza acesso ao microfone
2. **Captura**: MediaStream captura áudio do microfone
3. **Processamento**: AudioWorklet processa em tempo real
4. **Conversão**: Float32 → Int16 para reduzir banda
5. **Streaming**: Chunks enviados via WebSocket
6. **Resposta**: Backend processa e retorna transcrição/áudio

## Configurações de Áudio

```javascript
{
  sampleRate: 44100,        // Taxa de amostragem
  bufferSize: 4096,         // Tamanho do buffer (~93ms)
  echoCancellation: true,   // Cancelamento de eco
  noiseSuppression: true,   // Supressão de ruído
  autoGainControl: true     // Controle automático de ganho
}
```

## Estados da Interface

- **idle**: Aguardando interação
- **listening**: Capturando áudio do usuário
- **processing**: Backend processando
- **speaking**: Hanna respondendo

## Troubleshooting

### "Permissão negada"
- Verifique se o site está em HTTPS (necessário em produção)
- Verifique configurações do navegador

### "AudioWorklet não carrega"
- Certifique-se que `audio-processor.js` está em `/public`
- Verifique console para erros de sintaxe

### "Sem áudio chegando no backend"
- Verifique conexão WebSocket
- Confirme que a sessão foi iniciada
- Verifique logs do navegador

## Performance

- AudioWorklet evita jank na UI
- Chunks de 4KB otimizam latência vs throughput
- PCM16 reduz uso de banda em 50%
- Analyser node fornece feedback visual sem custo extra

## Segurança

- Permissões explícitas do usuário
- Áudio processado localmente antes do envio
- Conexão WebSocket pode usar WSS em produção
- Nenhum dado é armazenado no frontend