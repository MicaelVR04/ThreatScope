import { supabase } from '../supabaseClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
  }
}

async function apiFetch(path, options = {}) {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    let message = `API error: ${res.status}`
    try {
      const data = await res.json()
      if (data?.detail) message = data.detail
    } catch {}
    throw new Error(message)
  }
  return res.json()
}

export async function getAlerts() {
  if (supabase) {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('timestamp', { ascending: false })
    if (error) throw error
    return data
  }
  return apiFetch('/alerts')
}

export async function getAlertsSummary() {
  if (supabase) {
    const { data, error } = await supabase
      .from('alerts')
      .select('severity')
    if (error) throw error
    const total  = data.length
    const high   = data.filter(a => a.severity === 'HIGH').length
    const medium = data.filter(a => a.severity === 'MEDIUM').length
    const low    = data.filter(a => a.severity === 'LOW').length
    return { total, high, medium, low }
  }
  return apiFetch('/alerts/summary')
}

export async function getAlertStats() {
  if (supabase) {
    const { data, error } = await supabase
      .from('alerts')
      .select('timestamp, severity')
      .order('timestamp', { ascending: true })
    if (error) throw error
    return data
  }
  return apiFetch('/alerts/stats')
}

export async function getAttackTypeStats() {
  if (supabase) {
    const { data, error } = await supabase
      .from('alerts')
      .select('type, severity')
    if (error) throw error
    const grouped = {}
    data.forEach(({ type, severity }) => {
      if (!grouped[type]) grouped[type] = { type, count: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
      grouped[type].count++
      grouped[type][severity]++
    })
    return Object.values(grouped)
  }
  const data = await apiFetch('/alerts')
  const grouped = {}
  data.forEach(({ type, severity }) => {
    if (!grouped[type]) grouped[type] = { type, count: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    grouped[type].count++
    if (severity) grouped[type][severity]++
  })
  return Object.values(grouped)
}

export async function analyzeRecentAlerts() {
  return apiFetch('/ai/analyze-alerts', { method: 'POST' })
}

export async function getScanStatus() {
  return apiFetch('/scan/status')
}

export async function runScanNow() {
  return apiFetch('/scan/run', { method: 'POST' })
}

export async function setScanSchedule(enabled, intervalMinutes) {
  return apiFetch('/scan/schedule', {
    method: 'POST',
    body: JSON.stringify({
      enabled,
      interval_minutes: intervalMinutes,
    }),
  })
}
