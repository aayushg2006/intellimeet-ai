import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export const NotFoundPage = () => {
  const navigate = useNavigate()

  useEffect(() => { document.title = 'Page Not Found — IntellMeet' }, [])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#FAF9F7] to-[#F3F0FF] text-[#1A1A1A]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-4rem] top-[-2rem] h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-50" />
        <div className="absolute bottom-[-3rem] right-[-2rem] h-[20rem] w-[24rem] rounded-[45%] bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-45" />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
        <div className="rounded-3xl border border-[#E8E4DD] bg-white/90 px-8 py-10 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.25)] backdrop-blur-sm sm:px-12">
          <div className="text-7xl font-black tracking-tight sm:text-8xl">
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#2563EB] bg-clip-text text-transparent">404</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-[#1A1A1A]">Page not found</h1>
          <p className="mt-2 text-sm text-[#6B6560]">The page you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-[#6D28D9] hover:to-[#5B21B6]"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
