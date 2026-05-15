import { useState, useEffect } from 'react'
import AlertTable from '../components/AlertTable'
import { getAlerts } from '../services/api'

export default function AlertHistory() {
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    getAlerts()
      .then(setAlerts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main style={styles.main}>
      <h1 style={styles.heading}>Alert History</h1>

      {loading && <p style={styles.muted}>Loading alerts...</p>}
      {error   && <p style={styles.error}>Error: {error}</p>}
      {!loading && !error && <AlertTable alerts={alerts} />}
    </main>
  )
}

const styles = {
  main:    { padding: '24px 32px' },
  heading: { fontSize: 20, color: '#f1f5f9', marginBottom: 20 },
  muted:   { color: '#475569', fontStyle: 'italic' },
  error:   { color: '#ef4444' },
}
