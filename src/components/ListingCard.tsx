import Link from 'next/link';
import type { Listing } from '@/lib/types';
import AgentAttribution from './AgentAttribution';

function formatPrice(l: Listing): string {
  if (!l.currency) return 'Price on application';
  const fmt = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: l.currency,
    maximumFractionDigits: 0
  });
  if (l.service_type === 'long_term' && l.rent_pcm) return `${fmt.format(l.rent_pcm)} pcm`;
  if (l.service_type === 'short_term' && l.daily_rate) return `${fmt.format(l.daily_rate)} / night`;
  if (l.service_type === 'sale' && l.asking_price) return fmt.format(l.asking_price);
  return 'Price on application';
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const meta = [
    listing.bedrooms != null && `${listing.bedrooms} bed`,
    listing.bathrooms != null && `${listing.bathrooms} bath`,
    listing.property_type
  ].filter(Boolean) as string[];

  return (
    <Link
      href={`/property/${listing.raia_id}`}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden transition-all hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    >
      <div className="aspect-[4/3] bg-[var(--bg-elev)] relative overflow-hidden">
        {listing.photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.photo_url}
            alt={listing.headline ?? listing.raia_id}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-medium text-[var(--text-dim)]">
            No photo
          </div>
        )}
        {listing.listing_status && listing.listing_status !== 'available' && (
          <span className="absolute top-3 left-3 rounded-full border border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur px-2.5 py-1 text-xs font-semibold capitalize text-[var(--text)]">
            {listing.listing_status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4">
        <p className="text-lg font-bold tracking-tight text-[var(--text)]">{formatPrice(listing)}</p>
        <p className="mt-1 text-sm text-[var(--text-dim)] line-clamp-1">
          {listing.headline ?? listing.suburb ?? listing.postcode_district ?? '—'}
        </p>
        {meta.length > 0 && (
          <p className="mt-2 text-xs font-medium text-[var(--text-dim)] capitalize">{meta.join(' · ')}</p>
        )}
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <AgentAttribution agentId={listing.agent_id} agentCardUrl={listing.agent_card_url} />
        </div>
      </div>
    </Link>
  );
}
