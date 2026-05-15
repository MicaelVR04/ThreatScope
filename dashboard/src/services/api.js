import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Fetch all historical alerts.
 * @returns {Promise<Array>}
 */
export async function getAlerts() {
  const { data } = await api.get('/alerts')
  return data
}

/**
 * Fetch alert severity summary counts.
 * @returns {Promise<{ total: number, high: number, medium: number, low: number }>}
 */
export async function getAlertsSummary() {
  const { data } = await api.get('/alerts/summary')
  return data
}

export default api
