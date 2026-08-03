import { Sparkles, CheckSquare, HelpCircle, AlertTriangle, Gavel, Loader } from 'lucide-react'

const KINDS = {
  decision: { label: 'Decision', Icon: Gavel, className: 'bg-emerald-500/15 text-emerald-300' },
  action: { label: 'Action', Icon: CheckSquare, className: 'bg-[#7C3AED]/20 text-purple-300' },
  question: { label: 'Open question', Icon: HelpCircle, className: 'bg-sky-500/15 text-sky-300' },
  risk: { label: 'Risk', Icon: AlertTriangle, className: 'bg-amber-500/15 text-amber-300' },
}

/**
 * Live AI insights surfaced while the meeting is still running.
 *
 * Insights arrive incrementally over the socket; the server does the analysis
 * once per room, so every participant sees the same list.
 */
export const CopilotPanel = ({ items = [], status = 'idle' }) => {
  const isDisabled = status === 'disabled'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles size={15} className="text-[#7C3AED]" aria-hidden="true" />
          AI Copilot
        </h2>
        {status === 'thinking' && (
          <span className="flex items-center gap-1.5 text-[11px] text-white/50">
            <Loader size={12} className="animate-spin" aria-hidden="true" />
            Analysing
          </span>
        )}
      </div>

      {/* Announce new insights to assistive tech without stealing focus. */}
      <div className="flex-1 overflow-y-auto p-3" aria-live="polite" aria-atomic="false">
        {isDisabled ? (
          <p className="px-2 py-8 text-center text-xs text-white/40">
            The live assistant is unavailable for this meeting.
          </p>
        ) : items.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-white/40">
            Decisions, action items and open questions will appear here as they come up.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const kind = KINDS[item.kind] || KINDS.decision
              const { Icon } = kind

              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kind.className}`}
                    >
                      <Icon size={11} aria-hidden="true" />
                      {kind.label}
                    </span>
                    {item.assignee && (
                      <span className="truncate text-[11px] text-white/50">{item.assignee}</span>
                    )}
                  </div>
                  <p className="text-sm leading-snug text-white/90">{item.text}</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <p className="border-t border-white/10 px-4 py-2 text-[10px] text-white/35">
          AI-generated — verify anything important before acting on it.
        </p>
      )}
    </div>
  )
}

export default CopilotPanel
