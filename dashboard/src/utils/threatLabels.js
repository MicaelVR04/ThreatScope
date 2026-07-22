export const THREAT_DETAILS = {
  PING_SWEEP: {
    label: 'Host discovery',
    friendly: 'Multiple devices are being checked',
    plain: 'One device is checking multiple machines to see which ones are online.',
  },
  PORT_SCAN: {
    label: 'Port scan',
    friendly: 'Network services are being checked',
    plain: 'One device is checking many doors into a system to find open services.',
  },
  ARP_SPOOF: {
    label: 'Network impersonation',
    friendly: 'Possible device impersonation',
    plain: 'A device may be pretending to be another device on the local network.',
  },
  SYN_FLOOD: {
    label: 'Connection flood',
    friendly: 'Too many connection requests',
    plain: 'A device is sending many connection requests that could overwhelm a service.',
  },
}

export function threatLabel(type) {
  return THREAT_DETAILS[type]?.label || type || 'Unknown alert'
}

export function threatPlainEnglish(type) {
  return THREAT_DETAILS[type]?.plain || 'ThreatScope detected suspicious network behavior.'
}

export function threatFriendlyLabel(type) {
  return THREAT_DETAILS[type]?.friendly || threatLabel(type)
}
