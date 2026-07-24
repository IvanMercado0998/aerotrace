// DO NOT CHANGE LOGIC CALLS
import { redirect } from 'next/navigation'
import { isAdminLoggedIn } from '@/lib/admin-auth'
import Link from 'next/link'

export default async function Home() {
  const loggedIn = await isAdminLoggedIn()

  if (loggedIn) {
    redirect('/dashboard')
  }

  const nodes = [
    { id: 'N01', status: 'good' },
    { id: 'N02', status: 'good' },
    { id: 'N03', status: 'moderate' },
    { id: 'N04', status: 'elevated' },
    { id: 'N05', status: 'good' },
    { id: 'N06', status: 'moderate' },
  ] as const

  const statusColor = {
    good: 'bg-emerald-500',
    moderate: 'bg-amber-500',
    elevated: 'bg-rose-500',
  }

  const features = [
    {
      icon: '◈',
      title: 'Live node telemetry',
      desc: 'Real-time and manual capture modes across the deposition network',
    },
    {
      icon: '◎',
      title: 'Interactive pollution map',
      desc: 'MapLibre GL over OpenStreetMap, node-by-node',
    },
    {
      icon: '✳',
      title: 'ML source identification',
      desc: 'Spatial analytics flag likely emission sources automatically',
    },
    {
      icon: '▤',
      title: 'Governance-ready reports',
      desc: 'Exportable summaries built for LGU environmental review',
    },
  ]

  // TODO: replace with a licensed photo of your own (e.g. a monitoring
  // station, skyline, or field deployment shot) placed in /public.
  const HERO_IMAGE = 'https://picsum.photos/id/1043/1200/1600'

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4 md:p-6">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-300/30 blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-cyan-300/30 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-6xl rounded-[2.5rem] border border-white/60 bg-white/50 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(59,130,246,0.25)] overflow-hidden">
        <div className="grid md:grid-cols-2">
          {/* LEFT — content */}
          <div className="p-8 md:p-12 lg:p-14 flex flex-col justify-center bg-white/40">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-4 py-1.5 text-xs tracking-wide text-blue-700 mb-8 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 motion-safe:animate-pulse" />
              AeroTrace · Dry Deposition Network
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.05] mb-4">
              See the air
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                before it becomes a problem.
              </span>
            </h1>

            <p className="text-slate-600 text-base leading-relaxed mb-9 max-w-md">
              Multi-node air quality monitoring with ML-assisted source
              identification, built to support local environmental
              governance.
            </p>

            <div className="space-y-2.5 mb-10">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/60 px-4 py-3.5 shadow-sm hover:bg-white/90 hover:border-blue-200 transition-colors"
                >
                  <span className="text-blue-600 text-base leading-none mt-0.5" aria-hidden="true">
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{f.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/sign-in"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(37,99,235,0.5)] hover:shadow-[0_10px_40px_-6px_rgba(37,99,235,0.65)] transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 w-fit"
            >
              Admin Login
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </Link>

            <p className="text-xs text-slate-400 mt-8">
              Pilot deployment · LGU environmental governance program
            </p>
          </div>

          {/* RIGHT — image panel */}
          <div
            className="relative min-h-[380px] md:min-h-[600px] border-t md:border-t-0 md:border-l border-white/60 bg-cover bg-center"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          >
            {/* blue-tinted overlay for legibility + brand consistency */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-950/60 via-blue-900/30 to-cyan-950/50" />
            <div className="absolute inset-0 bg-blue-500/10 mix-blend-multiply" />

            {/* scattered sensor pulses */}
            <span className="absolute top-[18%] left-[22%] h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-ping" aria-hidden="true" />
            <span className="absolute top-[18%] left-[22%] h-2 w-2 rounded-full bg-cyan-300" aria-hidden="true" />
            <span className="absolute top-[38%] left-[62%] h-2 w-2 rounded-full bg-rose-400 motion-safe:animate-ping" aria-hidden="true" />
            <span className="absolute top-[38%] left-[62%] h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
            <span className="absolute top-[60%] left-[35%] h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-pulse" aria-hidden="true" />

            {/* top alert chip */}
            <div className="absolute top-6 left-6 right-16 rounded-2xl bg-white/90 backdrop-blur-md text-slate-900 px-4 py-3 shadow-lg border border-white/60">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Node N04 — Elevated PM2.5
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Flagged 09:30–10:00</p>
            </div>

            {/* node status strip */}
            <div className="absolute left-6 right-6 top-[42%] rounded-2xl border border-white/60 bg-white/25 backdrop-blur-md px-3 py-3 grid grid-cols-6 gap-1 text-center shadow-lg">
              {nodes.map((n) => (
                <div key={n.id} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-white/90 font-mono drop-shadow">{n.id}</span>
                  <span className={`h-2 w-2 rounded-full ring-2 ring-white/70 ${statusColor[n.status]}`} />
                </div>
              ))}
            </div>

            {/* floating reading card */}
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/70 bg-white/85 backdrop-blur-md p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-700">Composite AQI — Today</p>
                <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-mono">
                  MODERATE
                </span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-semibold text-slate-900 font-mono tracking-tight">78</span>
                <div className="flex items-end gap-1 h-8">
                  {[40, 65, 50, 78, 60, 45, 70].map((h, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-gradient-to-t from-blue-300 to-cyan-500"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}