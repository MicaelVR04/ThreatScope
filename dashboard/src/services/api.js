import { supabase } from '../supabaseClient'
import { API_URL } from './config'

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
  }
}

async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Your session has expired. Sign in again.')
  return session.user.id
}

function sensorQuery(sensorId) {
  return sensorId ? `?sensor_id=${encodeURIComponent(sensorId)}` : ''
}

async function apiFetch(path, options = {}) {
  const headers = await getHeaders()
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    })
  } catch {
    throw new Error('ThreatScope API is offline. Start the API service and try again.')
  }
  if (!res.ok) {
    let message = `API error: ${res.status}`
    try {
      const data = await res.json()
      if (data?.detail) message = data.detail
    } catch { /* response body wasn't JSON — fall back to the generic message above */ }
    throw new Error(message)
  }
  return res.json()
}

export async function getAlerts(sensorId = null) {
  if (supabase) {
    const userId = await getUserId()
    let query = supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
    if (sensorId) query = query.eq('sensor_id', sensorId)
    const { data, error } = await query
    if (error) throw error
    return data
  }
  return apiFetch(`/alerts${sensorQuery(sensorId)}`)
}

export async function getAlertsSummary(sensorId = null) {
  if (supabase) {
    const userId = await getUserId()
    let query = supabase
      .from('alerts')
      .select('severity')
      .eq('user_id', userId)
    if (sensorId) query = query.eq('sensor_id', sensorId)
    const { data, error } = await query
    if (error) throw error
    const total  = data.length
    const high   = data.filter(a => a.severity === 'HIGH').length
    const medium = data.filter(a => a.severity === 'MEDIUM').length
    const low    = data.filter(a => a.severity === 'LOW').length
    return { total, high, medium, low }
  }
  return apiFetch(`/alerts/summary${sensorQuery(sensorId)}`)
}

export async function getAlertStats(sensorId = null) {
  if (supabase) {
    const userId = await getUserId()
    let query = supabase
      .from('alerts')
      .select('timestamp, severity')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true })
    if (sensorId) query = query.eq('sensor_id', sensorId)
    const { data, error } = await query
    if (error) throw error
    return data
  }
  return apiFetch(`/alerts/stats${sensorQuery(sensorId)}`)
}

export async function getAttackTypeStats(sensorId = null) {
  if (supabase) {
    const userId = await getUserId()
    let query = supabase
      .from('alerts')
      .select('type, severity')
      .eq('user_id', userId)
    if (sensorId) query = query.eq('sensor_id', sensorId)
    const { data, error } = await query
    if (error) throw error
    const grouped = {}
    data.forEach(({ type, severity }) => {
      if (!grouped[type]) grouped[type] = { type, count: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
      grouped[type].count++
      grouped[type][severity]++
    })
    return Object.values(grouped)
  }
  const data = await apiFetch(`/alerts${sensorQuery(sensorId)}`)
  const grouped = {}
  data.forEach(({ type, severity }) => {
    if (!grouped[type]) grouped[type] = { type, count: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    grouped[type].count++
    if (severity) grouped[type][severity]++
  })
  return Object.values(grouped)
}

export async function analyzeRecentAlerts(sensorId) {
  return apiFetch('/ai/analyze-alerts', {
    method: 'POST',
    body: JSON.stringify({ sensor_id: sensorId }),
  })
}

export async function clearMyAlerts() {
  return apiFetch('/alerts/mine', { method: 'DELETE' })
}

export async function getApiHealth() {
  return apiFetch('/health')
}

export async function getScanStatus(sensorId = null) {
  return apiFetch(`/scan/status${sensorQuery(sensorId)}`)
}

export async function runScanNow(sensorId) {
  return apiFetch('/scan/run', {
    method: 'POST',
    body: JSON.stringify({ sensor_id: sensorId }),
  })
}

export async function setSensorMonitoring(sensorId, enabled) {
  return apiFetch('/sensor/monitoring', {
    method: 'POST',
    body: JSON.stringify({ sensor_id: sensorId, enabled }),
  })
}

export async function setScanSchedule(sensorId, enabled, intervalMinutes) {
  return apiFetch('/scan/schedule', {
    method: 'POST',
    body: JSON.stringify({
      sensor_id: sensorId,
      enabled,
      interval_minutes: intervalMinutes,
    }),
  })
}

export async function createSensorEnrollment() {
  return apiFetch('/sensors/enrollment', { method: 'POST' })
}

export async function getSensors() {
  return apiFetch('/sensors')
}

export async function revokeSensor(sensorId) {
  return apiFetch(`/sensors/${encodeURIComponent(sensorId)}`, { method: 'DELETE' })
}
