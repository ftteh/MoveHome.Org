import { searchListings, getMapPins } from '@/lib/queries';
import ListingGrid from '@/components/ListingGrid';
import MapView from '@/components/MapView';
import Filters from '@/components/Filters';
import type { ServiceType } from '@/lib/types';

export const revalidate = 60;

interface SearchPageProps {
  searchParams: Promise<{
    service_type?: ServiceType;
    bedrooms_min?: string;
    rent_pcm_max?: string;
    un_locode?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const params = {
    service_type: sp.service_type,
    bedrooms_min: sp.bedrooms_min ? Number(sp.bedrooms_min) : undefined,
    rent_pcm_max: sp.rent_pcm_max ? Number(sp.rent_pcm_max) : undefined,
    un_locode: sp.un_locode,
    limit: 48
  };
  const { results, total } = await searchListings(params);
  const pins = await getMapPins(params);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Search</h1>
      <Filters />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section>
          <MapView pins={pins} />
        </section>
        <aside>
          <p className="text-sm text-slate-500 mt-4 mb-3">
            {total} listing{total === 1 ? '' : 's'}
          </p>
          <ListingGrid listings={results} />
        </aside>
      </div>
    </div>
  );
}
