import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Shield, LayoutDashboard, Clock, Laptop, Wifi, WifiOff, LogOut, Home } from 'lucide-react'
import Button from './theme/Button'

export default function Navbar({ connected, userEmail, signingOut, onLogout }) {
  const navigate = useNavigate()
  const [confirmingLogout, setConfirmingLogout] = useState(false)

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.08] bg-surface px-4 py-3.5 sm:gap-6 sm:px-8">
      <div className="flex items-center gap-2.5">
        <div
          aria-hidden="true"
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-signal shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_22px_-4px_rgba(46,235,209,0.35)]"
        >
          <Shield size={18} className="text-base" strokeWidth={2.4} />
        </div>
        <div>
          <span className="block font-display text-lg font-bold tracking-tight text-ink">ThreatScope</span>
          <span className="ts-console-label mt-px block font-mono text-[10px] font-bold uppercase tracking-[0.8px] text-ink-faint">NIDS Console</span>
        </div>
      </div>

      <nav className="order-3 flex w-full justify-between gap-2 border-t border-white/[0.08] pt-2 sm:order-none sm:ml-3 sm:w-auto sm:flex-1 sm:justify-start sm:gap-5 sm:border-0 sm:pt-0">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-1.5 py-1 font-sans text-sm no-underline transition-colors duration-150 ease-swift sm:min-h-0 ${
              isActive ? 'font-semibold text-signal' : 'text-ink-muted'
            }`
          }
        >
          <LayoutDashboard size={15} />
          Dashboard
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-1.5 py-1 font-sans text-sm no-underline transition-colors duration-150 ease-swift sm:min-h-0 ${
              isActive ? 'font-semibold text-signal' : 'text-ink-muted'
            }`
          }
        >
          <Clock size={15} />
          Alert History
        </NavLink>
        <NavLink
          to="/sensors"
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-1.5 py-1 font-sans text-sm no-underline transition-colors duration-150 ease-swift sm:min-h-0 ${
              isActive ? 'font-semibold text-signal' : 'text-ink-muted'
            }`
          }
        >
          <Laptop size={15} />
          Sensors
        </NavLink>
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${
            connected ? 'border-severity-low/25' : 'border-severity-high/25'
          }`}
        >
          {connected ? (
            <>
              <span className="h-[7px] w-[7px] rounded-full bg-severity-low animate-[ts-pulse_1.4s_ease-in-out_infinite]" />
              <Wifi size={13} className="text-severity-low" />
              <span className="font-mono text-[11px] font-bold tracking-[0.8px] text-severity-low">FEED LIVE</span>
            </>
          ) : (
            <>
              <WifiOff size={13} className="text-severity-high" />
              <span className="font-mono text-[11px] font-bold tracking-[0.8px] text-severity-high">FEED OFFLINE</span>
            </>
          )}
        </div>

        {userEmail && (
          <span className="ts-user-email max-w-[210px] truncate font-sans text-xs text-ink-muted" title={userEmail}>
            {userEmail}
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          title="Back to landing page"
          aria-label="Back to landing page"
        >
          <Home size={15} />
          <span className="ts-logout-text leading-none">Home</span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setConfirmingLogout(true)}
          disabled={signingOut}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={15} />
          <span className="ts-logout-text leading-none">{signingOut ? 'Signing out' : 'Logout'}</span>
        </Button>
      </div>

      {confirmingLogout && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-base/75 px-4 backdrop-blur-sm" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirmation-title"
            className="w-full max-w-sm rounded-lg border border-white/[0.1] bg-surface p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-severity-medium/10 text-severity-medium">
                <LogOut size={18} />
              </div>
              <div>
                <h2 id="logout-confirmation-title" className="font-display text-lg font-semibold text-ink">Sign out of ThreatScope?</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">You will need to sign in again to view your dashboard and sensors.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingLogout(false)} disabled={signingOut}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onLogout}
                disabled={signingOut}
              >
                <LogOut size={15} />
                {signingOut ? 'Signing out' : 'Sign out'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ts-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.5); }
        }

        @media (max-width: 760px) {
          .ts-logout-text,
          .ts-user-email {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .ts-console-label {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}
