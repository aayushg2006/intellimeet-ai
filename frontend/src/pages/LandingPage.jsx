import { useNavigate } from 'react-router-dom'
import { Video, Zap, Shield, ArrowRight } from 'lucide-react'

export const LandingPage = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0F0F11] text-white overflow-x-hidden">
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.15); }
          66% { transform: translate(20px, -40px) scale(0.85); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(25px, 25px) scale(1.05); }
        }
        .orb-1 { animation: float1 8s ease-in-out infinite; }
        .orb-2 { animation: float2 10s ease-in-out infinite; }
        .orb-3 { animation: float3 12s ease-in-out infinite; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.6s ease forwards; }
        .animate-fade-in { animation: fadeIn 0.5s ease forwards; }
        .animate-scale-in { animation: scaleIn 0.5s ease forwards; }
        .delay-100 { animation-delay: 0.1s; opacity: 0; }
        .delay-200 { animation-delay: 0.2s; opacity: 0; }
        .delay-300 { animation-delay: 0.3s; opacity: 0; }
        .delay-400 { animation-delay: 0.4s; opacity: 0; }
        .delay-500 { animation-delay: 0.5s; opacity: 0; }
        .delay-600 { animation-delay: 0.6s; opacity: 0; }
      `}</style>

      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, transparent 60%, #0F0F11 100%)',
          }}
        />
        <div
          className="orb-1 absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}
        />
        <div
          className="orb-2 absolute -top-20 -right-32 w-80 h-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)' }}
        />
        <div
          className="orb-3 absolute bottom-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}
        />
        <div
          className="orb-2 absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)' }}
        />
        <div
          className="orb-1 absolute top-1/2 -left-20 w-64 h-64 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}
        />
      </div>

      <nav className="relative z-10 fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0F0F11]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <img src="/logo.png" alt="IntellMeet" className="h-8 w-auto brightness-0 invert" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-white/60 hover:text-white transition px-4 py-2"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 rounded-xl font-medium transition"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      <section className="relative z-10 pt-32 pb-24 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#7C3AED] text-xs px-3 py-1.5 rounded-full mb-8 animate-fade-in-up delay-100">
          <Zap size={12} />
          AI-Powered Meeting Intelligence
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight animate-fade-in-up delay-200">
          Meetings that{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] to-[#2563EB]">
            actually work
          </span>
        </h1>

        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-300">
          IntellMeet transforms every meeting into an actionable event with real-time video, AI summaries, and smart task management.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap animate-fade-in-up delay-400">
          <button
            onClick={() => navigate('/register')}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition active:scale-95 transition-all duration-150"
          >
            Start for free
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="border border-white/10 text-white/70 hover:bg-white/5 px-6 py-3 rounded-xl font-medium transition active:scale-95 transition-all duration-150"
          >
            Sign in
          </button>
        </div>

        <div className="mt-16 relative max-w-4xl mx-auto animate-scale-in delay-500">
          <div className="absolute inset-0 bg-gradient-to-b from-[#7C3AED]/20 to-transparent rounded-3xl blur-3xl" />
          <div className="relative bg-[#1C1C1E] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-[#111113] px-4 py-3 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <img src="/logo.png" alt="IntellMeet" className="h-6 w-auto brightness-0 invert" />
                <span className="text-white/20">•</span>
                <span className="text-white/40 text-sm">24:35</span>
              </div>
              <div className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">
                LIVE
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 bg-[#0F0F11] h-48">
              <div className="bg-[#1C1C1E] rounded-xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                  <span className="text-xs text-white/60">Mina</span>
                </div>
              </div>
              <div className="bg-[#1C1C1E] rounded-xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
                  <span className="text-xs text-white/60">Alex</span>
                </div>
              </div>
              <div className="bg-[#1C1C1E] rounded-xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500" />
                  <span className="text-xs text-white/60">Kai</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1C1C1E] border-t border-white/5 px-4 py-3 flex items-center gap-3">
              <Zap size={14} className="text-[#7C3AED]" />
              <span className="text-sm text-white/60">AI Summary ready</span>
              <button className="ml-auto text-xs text-[#7C3AED]">View</button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 py-24 px-6 max-w-6xl mx-auto">
        <div className="text-xs font-semibold text-[#7C3AED] uppercase tracking-wider text-center mb-4">
          Everything you need
        </div>
        <h2 className="text-3xl font-bold text-center mb-4">Built for modern teams</h2>
        <p className="text-white/50 text-center mb-16 max-w-xl mx-auto">
          From kickoff calls to weekly retrospectives, IntellMeet keeps every conversation productive and actionable.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-6 hover:border-[#7C3AED]/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#7C3AED]/10 transition-all duration-300 animate-fade-in-up delay-100">
            <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-xl flex items-center justify-center mb-4">
              <Video size={20} className="text-[#7C3AED]" />
            </div>
            <h3 className="font-semibold text-white mb-2">Crystal clear video</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              HD video meetings with screen sharing, recording, and up to 50 participants with ultra-low latency.
            </p>
          </div>

          <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-6 hover:border-[#7C3AED]/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#7C3AED]/10 transition-all duration-300 animate-fade-in-up delay-200">
            <div className="w-10 h-10 bg-[#2563EB]/10 rounded-xl flex items-center justify-center mb-4">
              <Zap size={20} className="text-[#2563EB]" />
            </div>
            <h3 className="font-semibold text-white mb-2">AI meeting intelligence</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Automatic transcription, smart summaries, and action item extraction — so you can focus on the conversation.
            </p>
          </div>

          <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-6 hover:border-[#7C3AED]/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#7C3AED]/10 transition-all duration-300 animate-fade-in-up delay-300">
            <div className="w-10 h-10 bg-[#059669]/10 rounded-xl flex items-center justify-center mb-4">
              <Shield size={20} className="text-[#059669]" />
            </div>
            <h3 className="font-semibold text-white mb-2">Enterprise secure</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              End-to-end encryption, JWT authentication, and role-based access control to keep your meetings private.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 py-16 px-6 border-y border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          <div className="animate-fade-in-up delay-100">
            <div className="text-4xl font-bold text-white">40%</div>
            <div className="text-sm text-white/40 mt-1">Less time in follow-ups</div>
          </div>
          <div className="animate-fade-in-up delay-200">
            <div className="text-4xl font-bold text-white">50+</div>
            <div className="text-sm text-white/40 mt-1">Participants per meeting</div>
          </div>
          <div className="animate-fade-in-up delay-300">
            <div className="text-4xl font-bold text-white">99.9%</div>
            <div className="text-sm text-white/40 mt-1">Uptime guarantee</div>
          </div>
        </div>
      </section>

      <section className="relative z-10 py-24 px-6 text-center max-w-3xl mx-auto">
        <h2 className="text-4xl font-bold mb-4">Ready to transform your meetings?</h2>
        <p className="text-white/50 mb-10">
          Start with a free workspace and see how IntellMeet can turn every conversation into momentum.
        </p>
        <button
          onClick={() => navigate('/register')}
          className="bg-gradient-to-r from-[#7C3AED] to-[#2563EB] text-white px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition flex items-center gap-2 mx-auto w-fit"
        >
          Get started free
          <ArrowRight size={18} />
        </button>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/30">
            <img src="/logo.png" alt="IntellMeet" className="h-6 w-auto brightness-0 invert" />
            <span className="ml-4">© 2026 IntellMeet. Built for Zidio Development.</span>
          </div>
          <div className="text-sm text-white/30">Made with ♥ by the IntellMeet team</div>
        </div>
      </footer>
    </div>
  )
}
