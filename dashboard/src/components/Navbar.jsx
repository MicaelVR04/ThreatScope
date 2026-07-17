import { NavLink } from 'react-router-dom'
import { Shield, LayoutDashboard, Clock, Wifi, WifiOff, LogOut } from 'lucide-react'
import Button from './theme/Button'

export default function Navbar({ connected, userEmail, signingOut, onLogout }) {
  return (
    <header className="flex items-center gap-6 border-b border-white/[0.08] bg-surface px-8 py-3.5">
      <div className="flex min-w-[180px] items-center gap-2.5">
        <div
          aria-hidden="true"
          className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-signal shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_22px_-4px_rgba(46,235,209,0.35)]"
        >
          <Shield size={18} className="text-base" strokeWidth={2.4} />
        </div>
        <div>
          <span className="block font-display text-lg font-bold tracking-tight text-ink">ThreatScope</span>
          <span className="mt-px block font-mono text-[10px] font-bold uppercase tracking-[0.8px] text-ink-faint">NIDS Console</span>
        </div>
      </div>

      <nav className="ml-3 flex flex-1 gap-5">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `flex items-center gap-1.5 py-1 font-sans text-sm no-underline transition-colors duration-150 ease-swift ${
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
            `flex items-center gap-1.5 py-1 font-sans text-sm no-underline transition-colors duration-150 ease-swift ${
              isActive ? 'font-semibold text-signal' : 'text-ink-muted'
            }`
          }
        >
          <Clock size={15} />
          Alert History
        </NavLink>
      </nav>

      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${
            connected ? 'border-severity-low/25' : 'border-severity-high/25'
          }`}
        >
          {connected ? (
            <>
              <span className="h-[7px] w-[7px] rounded-full bg-severity-low animate-[ts-pulse_1.4s_ease-in-out_infinite]" />
              <Wifi size={13} className="text-severity-low" />
              <span className="font-mono text-[11px] font-bold tracking-[0.8px] text-severity-low">LIVE</span>
            </>
          ) : (
            <>
              <WifiOff size={13} className="text-severity-high" />
              <span className="font-mono text-[11px] font-bold tracking-[0.8px] text-severity-high">DISCONNECTED</span>
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
          variant="secondary"
          size="sm"
          onClick={onLogout}
          disabled={signingOut}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={15} />
          <span className="ts-logout-text leading-none">{signingOut ? 'Signing out' : 'Logout'}</span>
        </Button>
      </div>

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
      `}</style>
    </header>
  )
}
