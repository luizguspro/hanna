'use client'

import { motion } from 'framer-motion'

interface PermissionStatusProps {
  hasPermission: boolean
  permissionError: string | null
  onRequestPermission: () => void
}

export default function PermissionStatus({ 
  hasPermission, 
  permissionError, 
  onRequestPermission 
}: PermissionStatusProps) {
  if (hasPermission) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md shadow-xl"
    >
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-medium mb-1">
            Permissão de Microfone Necessária
          </h3>
          <p className="text-gray-400 text-sm mb-3">
            {permissionError || 'Para conversar com a Hanna, precisamos acessar seu microfone.'}
          </p>
          <button
            onClick={onRequestPermission}
            className="px-4 py-2 bg-hanna-blue text-white rounded-md hover:bg-opacity-80 transition-colors text-sm"
          >
            Permitir Acesso ao Microfone
          </button>
        </div>
      </div>
    </motion.div>
  )
}