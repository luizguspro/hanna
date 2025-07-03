'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import ChatTranscript, { Message } from '@/components/ChatTranscript/ChatTranscript'
import AudioLevelIndicator from '@/components/AudioLevelIndicator/AudioLevelIndicator'
import { useAudioCapture } from '@/hooks/useAudioCapture'
import { useWebSocket } from '@/hooks/useWebSocket'

// Importação dinâmica do Orb para evitar problemas de SSR com Three.js
const Orb = dynamic(() => import('@/components/Orb/Orb'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-hanna-blue animate-pulse">Carregando...</div>
    </div>
  )
})

// Gerar ID único para o dispositivo
const DEVICE_ID = `hanna-device-${Math.random().toString(36).substr(2, 9)}`

export default function Home() {
  // Estados da aplicação
  const [messages, setMessages] = useState<Message[]>([])
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'speaking'>('idle')
  const [hasInteraction, setHasInteraction] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTranscript, setCurrentTranscript] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  
  // Refs para controle de áudio
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<ArrayBuffer[]>([])
  const isPlayingAudioRef = useRef(false)
  const audioChunkCountRef = useRef(0)

  // Função de debug
  const addDebug = (message: string) => {
    console.log(`[HANNA DEBUG] ${message}`)
    setDebugInfo(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  // WebSocket Hook
  const websocket = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
    
    onSessionStarted: (sessionId) => {
      addDebug(`✅ Sessão iniciada: ${sessionId}`)
      setError(null)
      
      // Iniciar captura de áudio após sessão criada
      setTimeout(() => {
        addDebug('🎤 Iniciando captura de áudio...')
        audioCapture.startListening()
      }, 500)
    },
    
    onUserTranscript: (transcript, isFinal) => {
      addDebug(`📝 Transcrição: "${transcript}" (final: ${isFinal})`)
      
      if (!isFinal) {
        setCurrentTranscript(transcript)
      } else if (transcript) {
        // Adicionar mensagem do usuário
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          text: transcript,
          sender: 'user',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, userMessage])
        setCurrentTranscript('')
        setIsProcessing(true)
        setOrbState('idle')
      }
    },
    
    onHannaSpeakingText: (text) => {
      addDebug(`🤖 Hanna respondeu: "${text.substring(0, 50)}..."`)
      
      // Adicionar resposta da Hanna
      const hannaMessage: Message = {
        id: `hanna-${Date.now()}`,
        text: text,
        sender: 'hanna',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, hannaMessage])
      setIsProcessing(false)
    },
    
    onHannaSpeakingAudio: async (audioData) => {
      addDebug(`🔊 Áudio recebido: ${audioData.byteLength} bytes`)
      
      // Adicionar áudio à fila
      audioQueueRef.current.push(audioData)
      
      // Tocar se não estiver tocando
      if (!isPlayingAudioRef.current) {
        playNextAudio()
      }
    },
    
    onError: (error) => {
      addDebug(`❌ Erro: ${error.message}`)
      setError(error.message)
      setOrbState('idle')
      setIsProcessing(false)
    },
  })

  // Audio Capture Hook
  const audioCapture = useAudioCapture({
    onAudioData: (audioData, metadata) => {
      // Contar chunks enviados
      audioChunkCountRef.current++
      
      // Log a cada 10 chunks
      if (audioChunkCountRef.current % 10 === 0) {
        addDebug(`📤 ${audioChunkCountRef.current} chunks enviados (RMS: ${metadata.rms.toFixed(4)})`)
      }
      
      // Enviar áudio para o servidor
      websocket.sendAudioChunk(audioData)
      
      // Atualizar estado visual baseado no nível de áudio
      if (metadata.rms > 0.01 && !isProcessing) {
        setOrbState('listening')
      }
    },
    
    onSilenceDetected: () => {
      addDebug('🔇 Silêncio detectado, enviando fim de fala...')
      audioChunkCountRef.current = 0
      
      if (!isProcessing) {
        websocket.endOfSpeech()
        setOrbState('idle')
      }
    },
    
    onSpeechStarted: () => {
      addDebug('🗣️ Fala detectada!')
      if (!isProcessing) {
        setOrbState('listening')
      }
    },
    
    onError: (error) => {
      addDebug(`❌ Erro de áudio: ${error.message}`)
      setError(error.message)
      setOrbState('idle')
    },
  })

  // Tocar próximo áudio da fila
  const playNextAudio = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      addDebug('🔇 Fila de áudio vazia, parando reprodução')
      isPlayingAudioRef.current = false
      setOrbState('idle')
      return
    }

    isPlayingAudioRef.current = true
    setOrbState('speaking')

    try {
      // Pegar próximo áudio da fila
      const audioData = audioQueueRef.current.shift()!
      addDebug(`▶️ Tocando áudio: ${audioData.byteLength} bytes`)
      
      // Criar AudioContext se não existir
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      // Decodificar e tocar áudio MP3
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData)
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)
      
      // Quando terminar, tocar próximo
      source.onended = () => {
        playNextAudio()
      }
      
      source.start()
      
    } catch (error) {
      addDebug(`❌ Erro ao tocar áudio: ${error}`)
      console.error('Erro ao tocar áudio:', error)
      isPlayingAudioRef.current = false
      setOrbState('idle')
    }
  }, [])

  // Iniciar interação
  const startInteraction = useCallback(async () => {
    addDebug('🚀 Iniciando interação...')
    setHasInteraction(true)
    setError(null)

    // Solicitar permissão do microfone primeiro
    const hasPermission = await audioCapture.requestPermission()
    
    if (hasPermission) {
      addDebug('✅ Permissão do microfone concedida')
      // Conectar WebSocket e iniciar sessão
      websocket.startSession(DEVICE_ID)
    } else {
      addDebug('❌ Permissão do microfone negada')
    }
  }, [audioCapture, websocket])

  // Parar interação
  const stopInteraction = useCallback(() => {
    addDebug('⏹️ Parando interação...')
    audioCapture.stopListening()
    websocket.disconnect()
    setHasInteraction(false)
    setOrbState('idle')
    
    // Limpar fila de áudio
    audioQueueRef.current = []
    isPlayingAudioRef.current = false
  }, [audioCapture, websocket])

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      audioCapture.stopListening()
      websocket.disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-gradient-to-b from-hanna-dark to-black">
      {/* Background com efeito de partículas */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-[128px]" />
      </div>

      {/* Debug Info (apenas em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && debugInfo.length > 0 && (
        <div className="absolute top-4 right-4 w-96 bg-black bg-opacity-80 p-4 rounded-lg text-xs font-mono max-h-64 overflow-y-auto">
          <div className="text-green-400 mb-2">Debug Info:</div>
          {debugInfo.map((info, i) => (
            <div key={i} className="text-gray-400 mb-1">{info}</div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {!hasInteraction ? (
          // Estado inicial - Orbe centralizado
          <motion.div
            key="initial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full h-full flex flex-col items-center justify-center"
          >
            <motion.div 
              className="w-80 h-80"
              animate={{ 
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Orb state="idle" />
            </motion.div>
            
            <motion.h1 
              className="mt-8 text-4xl font-light text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Olá, eu sou a Hanna
            </motion.h1>
            
            <motion.p 
              className="mt-4 text-lg text-gray-400"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              Sua assistente virtual do Impact Hub
            </motion.p>

            <motion.button
              className="mt-8 px-8 py-4 bg-hanna-blue bg-opacity-20 border border-hanna-blue rounded-full text-hanna-blue hover:bg-opacity-30 transition-all text-lg font-medium"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startInteraction}
            >
              Começar Conversa
            </motion.button>

            {/* Mostrar erro se houver */}
            {error && (
              <motion.div
                className="mt-6 px-6 py-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg text-red-400 max-w-md text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}
          </motion.div>
        ) : (
          // Estado de conversa - Orbe no topo, chat embaixo
          <motion.div
            key="conversation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-10 w-full h-full flex flex-col"
          >
            {/* Header com status */}
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full animate-pulse ${
                  websocket.state.isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-sm text-gray-300">
                  {websocket.state.isConnected ? 'Conectado' : 'Conectando...'}
                </span>
                {isProcessing && (
                  <span className="text-sm text-hanna-blue">
                    Processando resposta...
                  </span>
                )}
              </div>
              
              <button
                className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2"
                onClick={stopInteraction}
              >
                ✕ Encerrar
              </button>
            </div>

            {/* Orbe no topo */}
            <motion.div 
              className="w-full flex justify-center pb-2"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 20 }}
            >
              <div className="w-64 h-64">
                <Orb 
                  state={orbState} 
                  audioLevel={audioCapture.state.audioLevel}
                />
              </div>
            </motion.div>

            {/* Status de captura com indicador de áudio */}
            <div className="text-center mb-4 space-y-3">
              {audioCapture.state.isListening && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center space-y-3"
                >
                  <AudioLevelIndicator 
                    level={audioCapture.state.audioLevel} 
                    isActive={orbState === 'listening'}
                  />
                  <p className="text-sm text-hanna-blue font-medium">
                    {isProcessing 
                      ? '🤔 Pensando...' 
                      : orbState === 'speaking' 
                      ? '💬 Hanna está falando...'
                      : orbState === 'listening' 
                      ? '🎤 Ouvindo...' 
                      : '⏸️ Aguardando...'}
                  </p>
                </motion.div>
              )}
              
              {currentTranscript && (
                <motion.p
                  className="text-sm text-gray-400 italic mt-2 max-w-2xl mx-auto px-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  "{currentTranscript}"
                </motion.p>
              )}
            </div>

            {/* Área de transcrição */}
            <motion.div 
              className="flex-1 max-w-4xl mx-auto w-full px-4 pb-8 overflow-hidden"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <ChatTranscript messages={messages} />
            </motion.div>

            {/* Erro inline */}
            {error && (
              <motion.div
                className="absolute bottom-4 left-4 right-4 px-4 py-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg text-red-400 text-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}