'use client'

import { Download, Check } from 'lucide-react'

const STEPS = [
  {
    step: '1',
    title: 'Download the plugin',
    desc: 'Click the button below to download coovex.php.',
  },
  {
    step: '2',
    title: 'Upload to WordPress',
    desc: 'In your WP admin: Plugins → Add New → Upload Plugin → choose coovex.php → Install Now → Activate.',
  },
  {
    step: '3',
    title: 'Configure settings',
    desc: 'Go to Settings → CooVex. Enter your API Key and Workspace ID from CooVex → Settings → Integrations.',
  },
  {
    step: '4',
    title: 'Add your Chatbot ID',
    desc: 'In CooVex → Chatbot Builder, copy your chatbot ID and paste it in the plugin settings. Enable the chat widget.',
  },
]

const FEATURES = [
  { icon: '💬', title: 'AI Chat Widget',    desc: 'Automatic footer widget on every page, or use the [coovex_chat] shortcode anywhere.' },
  { icon: '📝', title: 'Post Auto-Sync',    desc: 'Every published post is pushed to your CooVex content calendar automatically.' },
  { icon: '🔗', title: 'Lead Capture',      desc: 'Chat conversations create leads in your CooVex pipeline via webhook.' },
  { icon: '📊', title: 'Dashboard Widget',  desc: 'See CooVex status and quick links directly in the WordPress admin dashboard.' },
]

export default function WordPressIntegrationPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">WordPress Plugin</h1>
        <p className="text-slate-400 text-sm mt-0.5">Connect your WordPress site to CooVex in under 5 minutes</p>
      </div>

      {/* Download card */}
      <div className="bg-gradient-to-br from-violet-950/40 to-slate-900 border border-violet-800/30 rounded-2xl p-6 mb-6 flex items-center gap-6">
        <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
          ⚡
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold">CooVex AI Business Agent</h2>
          <p className="text-slate-400 text-sm">v1.0.0 · WordPress Plugin · Single PHP file</p>
          <div className="flex gap-3 mt-2">
            {['Chat Widget', 'Post Sync', 'Lead Capture', 'Dashboard Widget'].map(f => (
              <span key={f} className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="w-3 h-3" />{f}
              </span>
            ))}
          </div>
        </div>
        <a
          href="/api/integrations/wordpress/plugin"
          download="coovex.php"
          className="flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          Download Plugin
        </a>
      </div>

      {/* Installation steps */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <h2 className="text-white font-semibold text-sm mb-5">Installation</h2>
        <div className="space-y-4">
          {STEPS.map(s => (
            <div key={s.step} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-700/40 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {s.step}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{s.title}</p>
                <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {FEATURES.map(f => (
          <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-2xl mb-2">{f.icon}</div>
            <p className="text-white text-sm font-medium">{f.title}</p>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Shortcode */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-medium text-sm mb-3">Shortcode Usage</h3>
        <div className="space-y-2">
          <div className="bg-slate-950 rounded-lg p-3 font-mono text-sm text-violet-300">[coovex_chat]</div>
          <div className="bg-slate-950 rounded-lg p-3 font-mono text-sm text-violet-300">[coovex_chat width=&quot;400&quot; height=&quot;600&quot;]</div>
        </div>
        <p className="text-slate-500 text-xs mt-2">Add to any page, post, or widget area to embed the chat widget inline.</p>
      </div>
    </div>
  )
}
