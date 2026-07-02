import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export const NotFoundPage = () => {
  const navigate = useNavigate()

  useEffect(() => { document.title = 'Page Not Found — IntellMeet' }, [])

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-8xl font-bold text-[#E8E4DD]">404</div>
      <h1 className="text-2xl font-semibold text-[#1A1A1A] mt-4">Page not found</h1>
      <p className="text-sm text-[#6B6560] mt-2">The page you're looking for doesn't exist.</p>
      <button
        onClick={() => navigate('/dashboard')}
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6D28D9]"
      >
        Back to dashboard
      </button>
    </div>
  )
}
