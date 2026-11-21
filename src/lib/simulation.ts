export interface SimulationScenario {
  id: string
  header: string | null
  label: string
  expected: string
}

/** Scenarios from the assignment's failover table. Values are sent verbatim as the header. */
export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  { id: 'off', header: null, label: 'No simulated failure', expected: 'Normal request' },
  {
    id: 'k1-429',
    header: 'key_1=429',
    label: 'key_1=429',
    expected: 'key_1 rate-limited, key_2 answers',
  },
  {
    id: 'k1-429-k2-500',
    header: 'key_1=429,key_2=500',
    label: 'key_1=429,key_2=500',
    expected: 'Both keys fail: 503',
  },
  { id: 'all-429', header: '*=429', label: '*=429', expected: 'Every key fails: 503' },
]
