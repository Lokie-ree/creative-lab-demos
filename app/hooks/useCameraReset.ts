import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { SolidId } from '~/types'

export function useCameraReset(
  solidId: SolidId,
  orbitRef: React.RefObject<OrbitControlsImpl | null>,
) {
  const { camera } = useThree()

  useEffect(() => {
    if (orbitRef.current) orbitRef.current.enabled = false
    const tween = gsap.to(camera.position, {
      x: 0,
      y: 2,
      z: 7,
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: () => camera.lookAt(0, 0, 0),
      onComplete: () => {
        if (orbitRef.current) orbitRef.current.enabled = true
      },
    })
    return () => {
      tween.kill()
      if (orbitRef.current) orbitRef.current.enabled = true
    }
  }, [solidId])
}
