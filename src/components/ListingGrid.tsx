import type { Listing } from '@/lib/types';
import ListingCard from './ListingCard';

export default function ListingGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] py-16 px-6 text-center">
        <p className="text-2xl mb-2">🏠</p>
        <p className="font-semibold text-[var(--text)]">No properties match your filters</p>
        <p className="text-sm text-[var(--text-dim)] mt-1">Try widening your search or clearing a filter.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3">
      {listings.map((l) => (
        <ListingCard key={l.raia_id} listing={l} />
      ))}
    </div>
  );
}
