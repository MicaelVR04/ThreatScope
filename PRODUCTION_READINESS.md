# ThreatScope Production Readiness

This checklist tracks the work required before ThreatScope is presented as a
publicly deployable network security product. The current implementation is a
working single-sensor developer preview.

## Deployment

- [ ] Host the FastAPI service and dashboard on production infrastructure.
- [ ] Configure HTTPS, production domains, secrets, logging, backups, and health checks.
- [ ] Keep the sensor-to-API connection outbound so users do not expose inbound network ports.

## Sensor Enrollment

- [ ] Replace the shared `ENGINE_API_KEY` with a unique, revocable credential per sensor.
- [ ] Add one-time enrollment codes generated from an authenticated dashboard.
- [ ] Persist sensor identity, health, commands, and last-seen status in the database.
- [ ] Support multiple sensors and network locations per organization.
- [ ] Show the sensor name, location, version, and connectivity history in the dashboard.

## Installation

- [ ] Produce a signed and notarized macOS installer with guided plain-English steps.
- [ ] Add automatic sensor upgrades with rollback and integrity verification.
- [ ] Provide an uninstall flow through the operating system and dashboard.
- [ ] Package a Linux service for gateways, servers, and dedicated monitoring devices.
- [ ] Document where a sensor must be placed to see relevant network traffic.

## Accounts And Data Isolation

- [ ] Require verified email addresses for non-demo registrations.
- [ ] Add organizations, membership roles, and invitations.
- [ ] Scope every alert and sensor query by organization and enforce that scope with RLS.
- [ ] Separate demo data from production accounts and remove shared demo credentials.

## Release Verification

- [ ] Test installation, restart, reconnect, upgrade, and uninstall on supported systems.
- [ ] Test credential rotation and revocation for a compromised or retired sensor.
- [ ] Perform a multi-tenant authorization review and dependency/security scan.
- [ ] Publish supported platforms, network visibility limits, and a privacy policy.
