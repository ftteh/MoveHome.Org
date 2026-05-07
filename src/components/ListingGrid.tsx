import type { Listing } from '@/lib/types';
import ListingCard from './ListingCard';

export default function ListingGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic py-8 text-center">No listings to show.</p>
    );
  }
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {listings.map((l) => (
        <ListingCard key={l.raia_id} listing={l} />
      ))}
    </div>
  );
}
