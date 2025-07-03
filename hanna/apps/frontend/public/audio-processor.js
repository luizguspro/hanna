/**
 * AudioWorklet Processor para captura e processamento de áudio em tempo real
 * Roda em thread separado para melhor performance
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Buffer para acumular amostras antes de enviar
    this.bufferSize = 4096; // ~93ms @ 44.1kHz
    this.audioBuffer = [];
    
    // Configurações de processamento
    this.sampleRate = 44100; // Será atualizado pelo contexto real
    this.isActive = true;
    
    // Receber comandos do thread principal
    this.port.onmessage = (event) => {
      if (event.data.command === 'stop') {
        this.isActive = false;
      } else if (event.data.command === 'start') {
        this.isActive = true;
        this.audioBuffer = [];
      } else if (event.data.command === 'updateSampleRate') {
        this.sampleRate = event.data.sampleRate;
      }
    };
  }

  /**
   * Processa o áudio do microfone
   * @param {Float32Array[][]} inputs - Array de canais de entrada
   * @param {Float32Array[][]} outputs - Array de canais de saída
   * @param {Object} parameters - Parâmetros de áudio
   * @returns {boolean} - true para continuar processando
   */
  process(inputs, outputs, parameters) {
    // Verificar se há entrada de áudio
    const input = inputs[0];
    
    if (!this.isActive || !input || input.length === 0) {
      return true;
    }

    // Usar apenas o primeiro canal (mono)
    const channelData = input[0];
    
    if (!channelData) {
      return true;
    }

    // Adicionar as amostras ao buffer
    for (let i = 0; i < channelData.length; i++) {
      this.audioBuffer.push(channelData[i]);
    }

    // Quando o buffer atingir o tamanho desejado, processar e enviar
    while (this.audioBuffer.length >= this.bufferSize) {
      const chunk = this.audioBuffer.splice(0, this.bufferSize);
      
      // Converter Float32Array para Int16Array (formato PCM16)
      const pcm16 = this.float32ToInt16(chunk);
      
      // Enviar para o thread principal
      this.port.postMessage({
        type: 'audio',
        data: pcm16.buffer,
        sampleRate: this.sampleRate,
        timestamp: currentTime
      }, [pcm16.buffer]); // Transferir ownership para evitar cópia
    }

    return true; // Continuar processando
  }

  /**
   * Converte Float32 (-1 a 1) para Int16 (-32768 a 32767)
   * @param {number[]} float32Array - Array de amostras float32
   * @returns {Int16Array} - Array convertido para int16
   */
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp para garantir que está no range [-1, 1]
      let sample = Math.max(-1, Math.min(1, float32Array[i]));
      
      // Converter para int16
      // Multiplicar por 32767 para usar toda a faixa dinâmica
      int16Array[i] = Math.floor(sample * 32767);
    }
    
    return int16Array;
  }
}

// Registrar o processor
registerProcessor('audio-processor', AudioProcessor);