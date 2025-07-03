import { motion } from 'framer-motion'

interface AudioLevelIndicatorProps {
  level: number // 0 a 1
  isActive: boolean
}

export default function AudioLevelIndicator({ level, isActive }: AudioLevelIndicatorProps) {
  const bars = 5
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const barThreshold = (i + 1) / bars
    return level >= barThreshold ? 1 : Math.max(0.2, level * bars - i)
  })

  return (
    <div className="flex items-center gap-1 h-8">
      {barHeights.map((height, index) => (
        <motion.div
          key={index}
          className={`w-1 bg-gradient-to-t ${
            isActive 
              ? 'from-hanna-blue to-hanna-glow' 
              : 'from-gray-600 to-gray-500'
          }`}
          animate={{
            height: `${height * 32}px`,
            opacity: isActive ? 1 : 0.5,
          }}
          transition={{
            height: { duration: 0.1, ease: 'easeOut' },
            opacity: { duration: 0.2 },
          }}
        />
      ))}
    </div>
  )
}