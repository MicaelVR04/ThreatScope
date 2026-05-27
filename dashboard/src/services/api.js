import { supabase } from '../supabaseClient'

export async function getAlerts() {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('timestamp', { ascending: false })
  if (error) throw error
  return data
}

export async function getAlertsSummary() {
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

export async function getAlertStats() {
  const { data, error } = await supabase
    .from('alerts')
    .select('timestamp, severity')
    .order('timestamp', { ascending: true })
  if (error) throw error
  return data
}

export async function getAttackTypeStats() {
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
