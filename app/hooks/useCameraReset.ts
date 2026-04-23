import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import type { SolidId } from '~/types'

export function useCameraReset(solidId: SolidId) {
  const { camera } = useThree()

  useEffect(() => {
    const tween = gsap.to(camera.position, {
      x: 0,
      y: 2,
      z: 7,
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: () => camera.lookAt(0, 0, 0),
    })
    return () => { tween.kill() }
  }, [solidId])
}
