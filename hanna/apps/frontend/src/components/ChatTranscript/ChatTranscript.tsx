'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface Message {
  id: string
  text: string
  sender: 'user' | 'hanna'
  timestamp: Date
}

interface ChatTranscriptProps {
  messages: Message[]
}

export default function ChatTranscript({ messages }: ChatTranscriptProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="w-full h-full flex flex-col">
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-8 py-6 space-y-4 chat-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex ${
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-6 py-3 ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                    : 'bg-gray-800 bg-opacity-80 text-gray-100 border border-gray-700'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs opacity-70 mb-1">
                    {message.sender === 'user' ? 'Você' : 'Hanna'}
                  </span>
                  <p className="text-base leading-relaxed">{message.text}</p>
                  <span className="text-xs opacity-50 mt-2">
                    {message.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}