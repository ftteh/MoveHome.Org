import ThemeToggle from '@/components/ThemeToggle';

function BotInShield({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" className={className} aria-hidden="true">
      {/* Shield Outline with dynamic theme colors */}
      <path 
        d="M20 2 L35 6.5 V18 C35 26.5 28.5 34 20 37.5 C11.5 34 5 26.5 5 18 V6.5 Z" 
        fill="var(--tint-lightest)" 
        stroke="var(--accent)" 
        strokeWidth="2.5" 
        strokeLinejoin="round" 
      />
      {/* Pixel-art bot logo centered inside the shield */}
      <g transform="translate(4, 4)">
        <rect x="12" y="1" width="8" height="4" fill="var(--accent)"/>
        <rect x="14" y="4" width="4" height="4" fill="var(--accent)"/>
        <rect x="5" y="7" width="22" height="18" fill="var(--accent)"/>
        <rect x="8" y="25" width="16" height="3" fill="var(--accent-hover)"/>
        <rect x="9" y="11" width="5" height="5" fill="#ffffff"/>
        <rect x="18" y="11" width="5" height="5" fill="#ffffff"/>
      </g>
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg)] text-[var(--text)] font-sans selection:bg-[var(--tint-light)] selection:text-[var(--accent-hover)]">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md px-6 md:px-12 flex items-center justify-between">
        <a href="#" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-md px-2 py-1">
          <BotInShield className="w-8 h-8 group-hover:scale-105 transition-transform" />
          <span className="text-lg font-bold tracking-tight font-sans">
            MoveHome<span className="text-[var(--accent)]">.org</span>
          </span>
        </a>
        <div className="flex items-center gap-4">
          <a 
            href="https://estateaigents.org/charter.html" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sm font-medium text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors hidden sm:inline-block focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded"
          >
            The Charter
          </a>
          <ThemeToggle />
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 pt-32 pb-16 px-6 md:px-12 max-w-5xl mx-auto flex flex-col items-center justify-center">
        
        {/* Hero Section */}
        <section className="text-center mb-16 flex flex-col items-center">
          <div className="relative mb-8 group">
            {/* Soft breathing background glow */}
            <div className="absolute inset-0 bg-[var(--accent)] rounded-full filter blur-xl opacity-20 group-hover:opacity-35 transition-opacity animate-pulse-glow" style={{ width: '80px', height: '80px', margin: 'auto' }}></div>
            <BotInShield className="w-20 h-20 relative hover:scale-105 transition-transform duration-300 cursor-pointer" />
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-bright)] bg-[var(--bg-elev)] text-xs font-semibold text-[var(--accent)] mb-6 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping"></span>
            CIC Regulated Foundation
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 max-w-3xl leading-tight">
            The non-profit behind <br />
            the <span className="text-[var(--accent)]">RAIA</span> protocol.
          </h1>
          
          <p className="text-lg md:text-xl text-[var(--text-dim)] max-w-2xl mx-auto leading-relaxed mb-4">
            Move Home Organisation CIC (Co. No. 17202438) is a UK Community Interest Company. 
            Asset-locked, mission-bound. The protocol belongs to the community it serves.
          </p>
        </section>

        {/* Commitment Section (Why we are a CIC - Red Team Guard) */}
        <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 p-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
          <div className="md:col-span-2">
            <h2 className="text-xl font-bold mb-4 tracking-tight">The Commitment of an Asset Lock</h2>
            <p className="text-sm md:text-base text-[var(--text-dim)] leading-relaxed mb-4">
              In May 2026, OpenAI&apos;s defense against Elon Musk&apos;s lawsuit wasn&apos;t &quot;we didn&apos;t do it.&quot; It was &quot;you noticed too late.&quot; 
              If a single commercial entity controlled the property AI standard, the industry would simply trade one walled garden for another.
            </p>
            <p className="text-sm md:text-base text-[var(--text-dim)] leading-relaxed">
              We did the opposite. By establishing Move Home Organisation as a Community Interest Company, our mission and assets are legally locked under UK law. 
              The standard cannot be sold, demutualized, or pivoted for private gain. Our asset-lock is enforced by the Office of the CIC Regulator, not corporate policy.
            </p>
          </div>
          <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-[var(--border)] pt-6 md:pt-0 md:pl-8">
            <div className="text-xs font-mono text-[var(--accent)] mb-2 uppercase tracking-wider">Regulated Status</div>
            <div className="text-sm font-semibold mb-3">Office of the CIC Regulator</div>
            <div className="text-xs text-[var(--text-dim)] leading-relaxed mb-4">
              Guarantees all assets, intellectual property, and code bases of the RAIA standard remain free, public, and open forever.
            </div>
            <a 
              href="https://estateaigents.org/charter.html" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors group focus:outline-none"
            >
              Read the full RAIA Charter 
              <span className="transform group-hover:translate-x-0.5 transition-transform">→</span>
            </a>
          </div>
        </section>

        {/* Outbound CTAs */}
        <section className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          
          {/* Outbound Card 1: Product */}
          <div className="flex flex-col justify-between p-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgba(52,211,153,0.02)] transition-all group">
            <div>
              <div className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-2">The Reference Implementation</div>
              <h3 className="text-2xl font-bold tracking-tight mb-2">The Product</h3>
              <p className="text-sm text-[var(--text-dim)] leading-relaxed mb-6">
                EstateAigents.com is the world&apos;s first autonomous, dual-brand property assistant. 
                Managing real bookings, viewings, compliance, and rent collection at a flat £1/property rate.
              </p>
            </div>
            <a 
              href="https://estateaigents.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full py-3.5 px-6 rounded-xl border border-[var(--border-bright)] group-hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white dark:hover:text-black font-semibold text-sm text-center transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)] flex items-center justify-center gap-1.5"
            >
              Launch EstateAigents.com
              <span className="text-xs">↗</span>
            </a>
          </div>

          {/* Outbound Card 2: Protocol */}
          <div className="flex flex-col justify-between p-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgba(52,211,153,0.02)] transition-all group">
            <div>
              <div className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider mb-2">The Open Specification</div>
              <h3 className="text-2xl font-bold tracking-tight mb-2">The Protocol</h3>
              <p className="text-sm text-[var(--text-dim)] leading-relaxed mb-6">
                An open language for AI agents to discover, verify, and transact property. 
                Full support for Google A2A standards, Model Context Protocol (MCP) servers, schemas, and SDKs.
              </p>
            </div>
            <a 
              href="https://estateaigents.org" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full py-3.5 px-6 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-black font-semibold text-sm text-center transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)] flex items-center justify-center gap-1.5 shadow-sm shadow-[var(--accent)]/10"
            >
              Explore estateaigents.org
              <span className="text-xs">↗</span>
            </a>
          </div>

        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[var(--border)] bg-[var(--bg-elev)]/50 py-8 px-6 md:px-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-xs font-mono text-[var(--text-dim)] text-center md:text-left leading-relaxed">
            Move Home Organisation CIC · Registered in England &amp; Wales · Co. No. 17202438<br />
            An asset-locked Community Interest Company governed by the CIC Regulator.
          </div>
          <div className="flex gap-6 text-xs font-semibold text-[var(--text-dim)]">
            <a href="https://estateaigents.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">.com</a>
            <a href="https://estateaigents.org" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">.org</a>
            <a href="https://github.com/estateaigents/raia-protocol" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">GitHub</a>
            <a href="https://estateaigents.org/charter.html" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">Charter</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
