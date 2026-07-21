import { redirect } from 'next/navigation'
import { isAdminLoggedIn } from '@/lib/admin-auth'
import Link from 'next/link'

export default async function Home() {
  const loggedIn = await isAdminLoggedIn()

  if (loggedIn) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="glass-card max-w-2xl text-center p-12 rounded-3xl">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-2xl">
            ◯
          </div>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300 mb-4">
          Pollution Monitor
        </h1>
        
        <p className="text-lg text-white/80 mb-6">
          Real-time air quality monitoring and pollution source tracking for Luzon
        </p>

        <div className="mb-8">
          <p className="text-white/60 mb-4">
            Track multiple monitoring nodes, visualize pollution sources on an interactive map, and analyze air quality data with advanced spatial analytics.
          </p>
        </div>

        <div className="flex gap-4 justify-center flex-wrap mb-12">
          <Link
            href="/sign-in"
            className="glass-button text-lg px-8 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40"
          >
            Admin Login →
          </Link>
        </div>

        <div className="pt-8 border-t border-white/10">
          <h3 className="font-semibold text-white mb-6">Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-left glass p-4 rounded-lg">
              <p className="font-semibold text-white">📍 Real-time Monitoring</p>
              <p className="text-sm text-white/60 mt-1">Live and manual monitoring modes</p>
            </div>
            <div className="text-left glass p-4 rounded-lg">
              <p className="font-semibold text-white">🗺️ Interactive Map</p>
              <p className="text-sm text-white/60 mt-1">MapLibre GL with OpenStreetMap</p>
            </div>
            <div className="text-left glass p-4 rounded-lg">
              <p className="font-semibold text-white">📊 Advanced Analytics</p>
              <p className="text-sm text-white/60 mt-1">PostGIS spatial queries & ECharts</p>
            </div>
            <div className="text-left glass p-4 rounded-lg">
              <p className="font-semibold text-white">🚨 Alert System</p>
              <p className="text-sm text-white/60 mt-1">Peak pollution in red alerts</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
