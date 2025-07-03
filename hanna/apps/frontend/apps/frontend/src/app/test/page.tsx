'use client'

import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'

export default function TestPage() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString()
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📝'
    const log = `[${time}] ${prefix} ${message}`
    setLogs(prev => [...prev, log])
    console.log(log)
  }

  // Conectar WebSocket
  useEffect(() => {
    addLog('Conectando ao WebSocket...')
    const newSocket = io('http://localhost:3001')
    
    newSocket.on('connect', () => {
      addLog('WebSocket conectado!', 'success')
      setIsConnected(true)
      
      // Iniciar sessão automaticamente
      newSocket.emit('client:start_session', { 
        deviceId: 'test-device-debug-001' 
      })
    })

    newSocket.on('disconnect', () => {
      addLog('WebSocket desconectado', 'error')
      setIsConnected(false)
      setSessionId(null)
    })

    newSocket.on('server:session_started', (data) => {
      addLog(`Sessão iniciada: ${data.sessionId}`, 'success')
      setSessionId(data.sessionId)
    })

    newSocket.on('server:user_transcript', (data) => {
      addLog(`TRANSCRIÇÃO REAL: "${data.transcript}" (final: ${data.is_final})`, 'success')
    })

    newSocket.on('server:hanna_speaking_text', (data) => {
      addLog(`RESPOSTA REAL DA HANNA: "${data.text_chunk}"`, 'success')
    })

    newSocket.on('server:error', (data) => {
      addLog(`ERRO: ${data.message}`, 'error')
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  // Iniciar gravação
  const startRecording = async () => {
    try {
      addLog('Solicitando permissão do microfone...')
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      setMediaStream(stream)
      addLog('Microfone autorizado', 'success')

      const context = new AudioContext({ sampleRate: 44100 })
      setAudioContext(context)
      
      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      
      let chunkCount = 0
      processor.onaudioprocess = (e) => {
        if (!socket || !sessionId) return
        
        const inputData = e.inputBuffer.getChannelData(0)
        
        // Converter para Int16Array
        const int16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        
        // Enviar para o servidor
        socket.emit('client:audio_chunk', int16.buffer)
        chunkCount++
        
        if (chunkCount % 20 === 0) {
          addLog(`Enviados ${chunkCount} chunks de áudio`)
        }
      }
      
      source.connect(processor)
      processor.connect(context.destination)
      
      setIsRecording(true)
      addLog('GRAVAÇÃO INICIADA - FALE AGORA!', 'success')
      
      // Parar após 5 segundos
      setTimeout(() => {
        processor.disconnect()
        source.disconnect()
        socket?.emit('client:end_of_speech')
        setIsRecording(false)
        addLog('Gravação finalizada, aguardando resposta...', 'info')
      }, 5000)
      
    } catch (error) {
      addLog(`Erro: ${error}`, 'error')
    }
  }

  // Status do sistema
  const systemStatus = {
    'WebSocket': isConnected ? '✅ Conectado' : '❌ Desconectado',
    'Sessão': sessionId ? `✅ ${sessionId}` : '❌ Sem sessão',
    'Microfone': mediaStream ? '✅ Autorizado' : '⏸️ Não autorizado',
    'Backend': 'http://localhost:3001',
    'Modo': '🔥 REAL (sem mocks)'
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🧪 Teste de Sistema - Hanna</h1>
        <p className="text-gray-400 mb-8">Esta página testa se as APIs reais estão funcionando</p>
        
        <div className="grid grid-cols-2 gap-8">
          {/* Status */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Status do Sistema</h2>
            <div className="space-y-2">
              {Object.entries(systemStatus).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-400">{key}:</span>
                  <span className="font-mono text-sm">{value}</span>
                </div>
              ))}
            </div>
            
            <button
              onClick={startRecording}
              disabled={!isConnected || !sessionId || isRecording}
              className={`w-full mt-6 py-3 px-6 rounded-lg font-medium transition-all ${
                isRecording 
                  ? 'bg-red-600 animate-pulse' 
                  : !isConnected || !sessionId
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRecording ? '🔴 Gravando (5s)...' : '🎤 Testar Gravação Real'}
            </button>
          </div>
          
          {/* Logs */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Logs em Tempo Real</h2>
            <div className="h-96 overflow-y-auto bg-black p-4 rounded font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className="text-gray-500">Aguardando eventos...</div>
              ) : (
                logs.map((log, i) => (
                  <div 
                    key={i} 
                    className={
                      log.includes('❌') ? 'text-red-400' : 
                      log.includes('✅') ? 'text-green-400' : 
                      'text-gray-300'
                    }
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
          <h3 className="font-semibold mb-2">⚠️ Como testar:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Clique em "Testar Gravação Real"</li>
            <li>Fale algo como "Olá, quais são os planos?"</li>
            <li>Aguarde 5 segundos</li>
            <li>Se funcionar, você verá a TRANSCRIÇÃO REAL e RESPOSTA REAL nos logs</li>
            <li>Se continuar vendo respostas mockadas, o backend não está processando</li>
          </ol>
        </div>
      </div>
    </main>
  )
}