import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Search, Sparkles, ArrowLeft, Loader, FileText, CornerDownLeft } from 'lucide-react'
import { api } from '../lib/api'
import { useWorkspaceStore } from '../store/workspaceStore'

/**
 * Two ways to find things across past meetings:
 *
 *  - Keyword: instant, debounced, free.
 *  - Ask: a real LLM call per submission, so it fires only on explicit submit.
 *    Never on keystroke.
 */
export const SearchPage = () => {
  const navigate = useNavigate()
  const { activeWorkspace } = useWorkspaceStore()
  const [tab, setTab] = useState('keyword')
  const [input, setInput] = useState('')
  const [debounced, setDebounced] = useState('')
  const [question, setQuestion] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input.trim()), 300)
    return () => clearTimeout(timer)
  }, [input])

  const { data: capabilities } = useQuery({
    queryKey: ['search-capabilities'],
    queryFn: async () => (await api.get('/api/search/capabilities')).data,
    staleTime: Infinity,
  })

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', debounced, activeWorkspace],
    queryFn: async () =>
      (
        await api.get('/api/search', {
          params: { q: debounced, organizationId: activeWorkspace },
        })
      ).data,
    enabled: tab === 'keyword' && debounced.length >= 2,
    placeholderData: (previous) => previous,
  })

  const ask = useMutation({
    mutationFn: async (q) =>
      (await api.post('/api/search/ask', { question: q, organizationId: activeWorkspace })).data,
  })

  const semanticAvailable = capabilities?.semanticSearch !== false

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <header className="border-b border-[#E8E4DD] bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            aria-label="Back to dashboard"
            className="rounded-xl border border-[#E8E4DD] p-2 text-[#6B6560] transition hover:bg-[#F5F2EE]"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <h1 className="text-lg font-semibold text-[#1A1A1A]">Search meetings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div
          role="tablist"
          aria-label="Search mode"
          className="mb-5 inline-flex rounded-xl border border-[#E8E4DD] bg-white p-1"
        >
          <button
            role="tab"
            aria-selected={tab === 'keyword'}
            onClick={() => setTab('keyword')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === 'keyword' ? 'bg-[#7C3AED] text-white' : 'text-[#6B6560] hover:text-[#1A1A1A]'
            }`}
          >
            Keyword
          </button>
          <button
            role="tab"
            aria-selected={tab === 'ask'}
            onClick={() => setTab('ask')}
            disabled={!semanticAvailable}
            title={semanticAvailable ? undefined : 'Semantic search is not configured on this server'}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              tab === 'ask' ? 'bg-[#7C3AED] text-white' : 'text-[#6B6560] hover:text-[#1A1A1A]'
            }`}
          >
            <Sparkles size={14} aria-hidden="true" />
            Ask AI
          </button>
        </div>

        {tab === 'keyword' ? (
          <>
            <label htmlFor="search-input" className="sr-only">
              Search your meetings
            </label>
            <div className="relative">
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9A9490]"
              />
              <input
                id="search-input"
                type="search"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search titles, summaries, transcripts and action items…"
                autoFocus
                className="w-full rounded-2xl border border-[#E8E4DD] bg-white py-3.5 pl-11 pr-4 text-[#1A1A1A] outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
              />
            </div>

            <div className="mt-5" aria-live="polite">
              {debounced.length < 2 ? (
                <p className="py-12 text-center text-sm text-[#9A9490]">
                  Type at least 2 characters to search.
                </p>
              ) : isFetching && !results ? (
                <div className="flex justify-center py-12">
                  <Loader size={22} className="animate-spin text-[#6B6560]" aria-label="Searching" />
                </div>
              ) : !results?.items?.length ? (
                <p className="py-12 text-center text-sm text-[#9A9490]">
                  No meetings matched “{debounced}”.
                </p>
              ) : (
                <ul className="space-y-2">
                  {results.items.map((item) => (
                    <li key={item.meetingId}>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            item.hasSummary
                              ? `/meeting/${item.roomId}/summary`
                              : `/meeting/${item.roomId}`
                          )
                        }
                        className="w-full rounded-2xl border border-[#E8E4DD] bg-white p-4 text-left transition hover:border-[#7C3AED]/40 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="font-semibold text-[#1A1A1A]">{item.title}</h2>
                          <span className="shrink-0 text-xs text-[#9A9490]">
                            {new Date(item.date).toLocaleDateString()}
                          </span>
                        </div>
                        {item.snippet && (
                          <p className="mt-1.5 line-clamp-2 text-sm text-[#6B6560]">{item.snippet}</p>
                        )}
                        {item.matchedActionItems?.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {item.matchedActionItems.map((task) => (
                              <li key={task} className="flex items-start gap-1.5 text-xs text-[#7C3AED]">
                                <FileText size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                                {task}
                              </li>
                            ))}
                          </ul>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const trimmed = question.trim()
                if (trimmed.length >= 5) ask.mutate(trimmed)
              }}
            >
              <label htmlFor="ask-input" className="sr-only">
                Ask a question about your meetings
              </label>
              <div className="relative">
                <Sparkles
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-4 text-[#7C3AED]"
                />
                <textarea
                  id="ask-input"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      e.currentTarget.form?.requestSubmit()
                    }
                  }}
                  rows={3}
                  placeholder="e.g. What did we decide about the pricing model?"
                  className="w-full resize-none rounded-2xl border border-[#E8E4DD] bg-white py-3.5 pl-11 pr-4 text-[#1A1A1A] outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-[#9A9490]">
                  Answers come only from your own meeting transcripts.
                </p>
                <button
                  type="submit"
                  disabled={question.trim().length < 5 || ask.isPending}
                  className="flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {ask.isPending ? (
                    <Loader size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <CornerDownLeft size={15} aria-hidden="true" />
                  )}
                  Ask
                </button>
              </div>
            </form>

            <div className="mt-6" aria-live="polite">
              {ask.isError && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {ask.error?.response?.data?.message || 'Something went wrong. Please try again.'}
                </p>
              )}

              {ask.data && (
                <div className="rounded-2xl border border-[#E8E4DD] bg-white p-5">
                  <p className="whitespace-pre-wrap leading-relaxed text-[#1A1A1A]">
                    {ask.data.answer}
                  </p>

                  {ask.data.sources?.length > 0 && (
                    <>
                      <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-[#9A9490]">
                        Sources
                      </h2>
                      <ul className="space-y-2">
                        {ask.data.sources.map((source, index) => (
                          <li key={`${source.meetingId}-${index}`}>
                            <button
                              type="button"
                              onClick={() => navigate(`/meeting/${source.roomId}/summary`)}
                              className="w-full rounded-xl border border-[#E8E4DD] bg-[#FAF9F7] p-3 text-left transition hover:border-[#7C3AED]/40"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-[#1A1A1A]">
                                  {source.title}
                                </span>
                                <span className="shrink-0 text-xs text-[#9A9490]">{source.date}</span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-[#6B6560]">
                                {source.snippet}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default SearchPage
