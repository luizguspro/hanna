'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

type OrbState = 'idle' | 'listening' | 'speaking'

interface OrbProps {
  state?: OrbState
  audioLevel?: number
}

function OrbMesh({ state = 'idle', audioLevel = 0 }: OrbProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<any>(null)
  
  // Controle de animação baseado no estado
  const animationSpeed = useMemo(() => {
    switch (state) {
      case 'idle': return 0.5
      case 'listening': return 2.0
      case 'speaking': return 1.5 + audioLevel * 2
      default: return 0.5
    }
  }, [state, audioLevel])

  const distortionScale = useMemo(() => {
    switch (state) {
      case 'idle': return 0.2
      case 'listening': return 0.4
      case 'speaking': return 0.3 + audioLevel * 0.5
      default: return 0.2
    }
  }, [state, audioLevel])

  // Animação contínua
  useFrame((state) => {
    if (meshRef.current) {
      // Rotação suave
      meshRef.current.rotation.x += 0.001 * animationSpeed
      meshRef.current.rotation.y += 0.002 * animationSpeed
      
      // Pulsação baseada no estado
      const time = state.clock.getElapsedTime()
      const pulse = Math.sin(time * animationSpeed) * 0.05 + 1
      meshRef.current.scale.setScalar(pulse)
    }

    if (materialRef.current) {
      // Variação de intensidade da emissão
      const time = state.clock.getElapsedTime()
      const intensity = state === 'speaking' 
        ? 2 + Math.sin(time * 10) * audioLevel * 2
        : state === 'listening' 
        ? 1.5 + Math.sin(time * 5) * 0.5
        : 1 + Math.sin(time * 2) * 0.2
      
      materialRef.current.emissiveIntensity = intensity
    }
  })

  return (
    <Sphere ref={meshRef} args={[1, 128, 128]}>
      <MeshDistortMaterial
        ref={materialRef}
        color="#00B4D8"
        emissive="#0077BE"
        emissiveIntensity={1}
        metalness={0.8}
        roughness={0.2}
        distort={distortionScale}
        speed={animationSpeed}
        transparent
        opacity={0.9}
      />
    </Sphere>
  )
}

export default function Orb({ state = 'idle', audioLevel = 0 }: OrbProps) {
  return (
    <div className="w-full h-full relative orb-glow">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Iluminação */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#00B4D8" />
        
        {/* Orbe */}
        <OrbMesh state={state} audioLevel={audioLevel} />
        
        {/* Efeitos de pós-processamento */}
        <EffectComposer>
          <Bloom 
            intensity={2}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            radius={0.8}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}