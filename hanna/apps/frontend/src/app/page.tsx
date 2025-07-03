'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import ChatTranscript, { Message } from '@/components/ChatTranscript/ChatTranscript'

// Importação dinâmica do Orb para evitar problemas de SSR com Three.js
const Orb = dynamic(() => import('@/components/Orb/Orb'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-hanna-blue animate-pulse">Carregando...</div>
    </div>
  )
})

// Dados mockados para demonstração
const mockMessages: Message[] = [
  {
    id: '1',
    text: 'Olá! Quais são os planos disponíveis no Impact Hub?',
    sender: 'user',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: '2',
    text: 'Olá! Bem-vindo ao Impact Hub. Temos várias opções de planos para atender suas necessidades. Nossos principais planos são: Day Pass para uso diário, Hot Desk para uso flexível mensal, e Dedicated Desk para sua mesa fixa. Qual tipo de uso você tem em mente?',
    sender: 'hanna',
    timestamp: new Date(Date.now() - 50000),
  },
  {
    id: '3',
    text: 'Estou interessado no plano mensal flexível. Como funciona?',
    sender: 'user',
    timestamp: new Date(Date.now() - 40000),
  },
  {
    id: '4',
    text: 'O plano Hot Desk é perfeito para profissionais que precisam de flexibilidade! Com ele, você tem acesso ilimitado durante o horário comercial, pode usar qualquer mesa disponível no espaço compartilhado, tem direito a 4 horas mensais de sala de reunião, acesso à nossa comunidade e eventos exclusivos. O valor é bem acessível e você pode começar quando quiser!',
    sender: 'hanna',
    timestamp: new Date(Date.now() - 30000),
  },
]

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'speaking'>('idle')
  const [hasInteraction, setHasInteraction] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  // Simula o carregamento gradual das mensagens
  useEffect(() => {
    if (hasInteraction) {
      mockMessages.forEach((msg, index) => {
        setTimeout(() => {
          setMessages(prev => [...prev, msg])
          
          // Simula estados do orbe
          if (msg.sender === 'user') {
            setOrbState('listening')
          } else {
            setOrbState('speaking')
            // Simula variação de áudio
            const audioInterval = setInterval(() => {
              setAudioLevel(Math.random() * 0.5 + 0.3)
            }, 100)
            
            setTimeout(() => {
              clearInterval(audioInterval)
              setOrbState('idle')
              setAudioLevel(0)
            }, 3000)
          }
        }, index * 2000)
      })
    }
  }, [hasInteraction])

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-gradient-to-b from-hanna-dark to-black">
      {/* Background com efeito de partículas */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-[128px]" />
      </div>

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
              Aproxime-se para conversar
            </motion.p>

            <motion.button
              className="mt-8 px-6 py-3 bg-hanna-blue bg-opacity-20 border border-hanna-blue rounded-full text-hanna-blue hover:bg-opacity-30 transition-all"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setHasInteraction(true)}
            >
              Iniciar Conversa (Demo)
            </motion.button>
          </motion.div>
        ) : (
          // Estado de conversa - Orbe no topo, chat embaixo
          <motion.div
            key="conversation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-10 w-full h-full flex flex-col"
          >
            {/* Orbe no topo */}
            <motion.div 
              className="w-full flex justify-center pt-8 pb-4"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 20 }}
            >
              <div className="w-48 h-48">
                <Orb state={orbState} audioLevel={audioLevel} />
              </div>
            </motion.div>

            {/* Área de transcrição */}
            <motion.div 
              className="flex-1 max-w-4xl mx-auto w-full px-4 pb-8"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <ChatTranscript messages={messages} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}