import { useCallback, useEffect, useState } from 'react'
import { ApiError, api } from '../api/client'
import type { HealthResponse } from '../api/types'
import { config } from '../config'

export type HealthStatus = 'checking' | 'ok' | 'not_ready' | 'down'

export interface UseHealth {
  status: HealthStatus
  health: HealthResponse | null
  refresh: () => void
}

export function useHealth(pollMs: number = config.healthPollMs): UseHealth {
  const [status, setStatus] = useState<HealthStatus>('checking')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    api
      .health(controller.signal)
      .then((h) => {
        setHealth(h)
        setStatus('ok')
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setHealth(null)
        setStatus(err instanceof ApiError && err.status !== null ? 'not_ready' : 'down')
      })
    const timer = pollMs > 0 ? setTimeout(refresh, pollMs) : undefined
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [tick, pollMs, refresh])

  return { status, health, refresh }
}
