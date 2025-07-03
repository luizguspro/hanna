import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioCaptureProps {
  onAudioData: (audioData: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

interface AudioCaptureState {
  isListening: boolean;
  hasPermission: boolean;
  isRequestingPermission: boolean;
  error: string | null;
  audioLevel: number;
}

export function useAudioCapture({ onAudioData, onError }: UseAudioCaptureProps) {
  const [state, setState] = useState<AudioCaptureState>({
    isListening: false,
    hasPermission: false,
    isRequestingPermission: false,
    error: null,
    audioLevel: 0,
  });

  // Refs para manter referências estáveis
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Função para calcular o nível de áudio (para feedback visual)
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !state.isListening) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calcular o nível médio
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255;

    setState(prev => ({ ...prev, audioLevel: normalizedLevel }));

    // Continuar animação
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [state.isListening]);

  // Solicitar permissão do microfone
  const requestPermission = useCallback(async () => {
    setState(prev => ({ ...prev, isRequestingPermission: true, error: null }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        }
      });

      streamRef.current = stream;
      setState(prev => ({
        ...prev,
        hasPermission: true,
        isRequestingPermission: false,
        error: null,
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao acessar microfone';
      setState(prev => ({
        ...prev,
        hasPermission: false,
        isRequestingPermission: false,
        error: errorMessage,
      }));

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }

      return false;
    }
  }, [onError]);

  // Iniciar captura de áudio
  const startListening = useCallback(async () => {
    if (!streamRef.current) {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;
    }

    try {
      // Criar AudioContext se não existir
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 44100,
        });
      }

      const audioContext = audioContextRef.current;

      // Carregar e adicionar o AudioWorklet
      await audioContext.audioWorklet.addModule('/audio-processor.js');

      // Criar os nós de áudio
      const source = audioContext.createMediaStreamSource(streamRef.current!);
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
      const analyser = audioContext.createAnalyser();

      // Configurar analyser para visualização
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // Conectar o grafo de áudio
      source.connect(analyser);
      analyser.connect(workletNode);
      workletNode.connect(audioContext.destination); // Necessário para manter o processamento ativo

      // Configurar o handler para receber dados do worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          onAudioData(event.data.data);
        }
      };

      // Informar o sample rate ao worklet
      workletNode.port.postMessage({
        command: 'updateSampleRate',
        sampleRate: audioContext.sampleRate,
      });

      // Salvar referências
      sourceRef.current = source;
      workletNodeRef.current = workletNode;
      analyserRef.current = analyser;

      // Iniciar análise de nível de áudio
      updateAudioLevel();

      setState(prev => ({ ...prev, isListening: true, error: null }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao iniciar gravação';
      setState(prev => ({ ...prev, error: errorMessage }));

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }, [requestPermission, onAudioData, onError, updateAudioLevel]);

  // Parar captura de áudio
  const stopListening = useCallback(() => {
    // Parar animação
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Enviar comando de parada ao worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ command: 'stop' });
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Desconectar nós
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    setState(prev => ({ ...prev, isListening: false, audioLevel: 0 }));
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopListening();

      // Parar todas as tracks do stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Fechar AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopListening]);

  return {
    // Estado
    isListening: state.isListening,
    hasPermission: state.hasPermission,
    isRequestingPermission: state.isRequestingPermission,
    error: state.error,
    audioLevel: state.audioLevel,

    // Ações
    requestPermission,
    startListening,
    stopListening,
  };
}