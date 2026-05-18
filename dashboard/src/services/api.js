import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://api:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Fetch all historical alerts.
 * GET /alerts
 * @returns {Promise<Array>}
 */
export async function getAlerts() {
  const { data } = await api.get('/alerts')
  return data
}

/**
 * Fetch alert severity summary counts.
 * GET /alerts/summary
 * @returns {Promise<{ total: number, high: number, medium: number, low: number }>}
 */
export async function getAlertsSummary() {
  const { data } = await api.get('/alerts/summary')
  return data
}

/**
 * Fetch time-series traffic stats for the area chart.
 * GET /alerts/stats
 * @returns {Promise<Array<{ timestamp: string, HIGH: number, MEDIUM: number, LOW: number }>>}
 */
export async function getAlertStats() {
  const { data } = await api.get('/alerts/stats')
  return data
}

/**
 * Fetch alert counts grouped by attack type.
 * GET /alerts/stats?group_by=type
 * @returns {Promise<Array<{ type: string, count: number, HIGH: number, MEDIUM: number, LOW: number }>>}
 */
export async function getAttackTypeStats() {
  const { data } = await api.get('/alerts/stats', { params: { group_by: 'type' } })
  return data
}

export default api
