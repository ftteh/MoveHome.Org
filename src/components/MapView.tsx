'use client';

// Placeholder map. Wire up Google Maps loader + pin clustering in a follow-up.
// Receives MapPin[] from getMapPins() in src/lib/queries.ts.

export default function MapView() {
  return (
    <div className="aspect-[4/3] w-full rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400">
      <div className="text-center">
        <p className="font-medium">Map placeholder</p>
        <p className="text-xs mt-1">
          Wire up Google Maps + <code>getMapPins()</code> next.
        </p>
      </div>
    </div>
  );
}
