# ThreatScope Production Readiness

This checklist tracks the work required before ThreatScope is presented as a
publicly deployable network security product. The current implementation is a
multi-user, multi-sensor project release; unchecked items remain commercial
production work.

## Deployment

- [ ] Host the FastAPI service and dashboard on production infrastructure.
- [ ] Configure HTTPS, production domains, secrets, logging, backups, and health checks.
- [ ] Keep the sensor-to-API connection outbound so users do not expose inbound network ports.

## Sensor Enrollment

- [x] Use a unique, revocable credential for every graphically enrolled sensor.
- [x] Add one-time enrollment codes generated from an authenticated dashboard.
- [x] Persist sensor identity, health, commands, and last-seen status in the database.
- [x] Support multiple sensors per user account with independent controls and scan state.
- [ ] Add organizations and named network locations above account-level ownership.
- [x] Show sensor name, platform, version, current state, and last-seen time.

## Installation

- [ ] Produce a signed and notarized macOS installer with guided plain-English steps.
- [ ] Add automatic sensor upgrades with rollback and integrity verification.
- [ ] Provide an uninstall flow through the operating system and dashboard.
- [ ] Package a Linux service for gateways, servers, and dedicated monitoring devices.
- [ ] Document where a sensor must be placed to see relevant network traffic.

## Accounts And Data Isolation

- [x] Require verified email addresses for non-demo registrations.
- [ ] Add organizations, membership roles, and invitations.
- [x] Scope every alert and sensor action by user and enforce alert reads with RLS.
- [x] Enforce sensor-owner relationships with database constraints and private service-role-only tables.
- [ ] Move user-level ownership to organization membership and role policies.
- [ ] Separate demo data from production accounts and remove shared demo credentials.

## Release Verification

- [ ] Test installation, restart, reconnect, upgrade, and uninstall on supported systems.
- [ ] Test credential rotation and revocation for a compromised or retired sensor.
- [x] Add two-tenant authorization tests for alert reads, heartbeat, controls, scans, schedules, AI, and revocation.
- [ ] Run an independent security review and dependency scan before a public release.
- [ ] Publish supported platforms, network visibility limits, and a privacy policy.
