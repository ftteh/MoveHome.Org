import { getSupabase } from './supabase';
import type { Listing, ListingUK, ListingTH, MapPin, SearchParams } from './types';

// Empty-state safety: when Supabase isn't configured (local dev without .env),
// return empty results instead of throwing. movehome.org should still render.

export async function searchListings(params: SearchParams = {}): Promise<{ results: Listing[]; total: number }> {
  const sb = getSupabase();
  if (!sb) return { results: [], total: 0 };

  let query = sb
    .from('tbl_listings')
    .select('*', { count: 'exact' })
    .eq('visibility', 'public')
    .neq('listing_status', 'withdrawn')
    .order('synced_at', { ascending: false });

  if (params.un_locode) query = query.eq('un_locode', params.un_locode);
  if (params.service_type) query = query.eq('service_type', params.service_type);
  if (params.property_type) query = query.eq('property_type', params.property_type);
  if (params.bedrooms_min !== undefined) query = query.gte('bedrooms', params.bedrooms_min);
  if (params.bedrooms_max !== undefined) query = query.lte('bedrooms', params.bedrooms_max);
  if (params.rent_pcm_max !== undefined) query = query.lte('rent_pcm', params.rent_pcm_max);
  if (params.asking_price_max !== undefined) query = query.lte('asking_price', params.asking_price_max);
  if (params.features?.length) query = query.contains('features', params.features);

  const limit = params.limit ?? 24;
  query = query.range(params.offset ?? 0, (params.offset ?? 0) + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[searchListings]', error.message);
    return { results: [], total: 0 };
  }
  return { results: (data ?? []) as Listing[], total: count ?? 0 };
}

export async function getListingByRaiaId(raia_id: string): Promise<{
  listing: Listing | null;
  uk: ListingUK | null;
  th: ListingTH | null;
}> {
  const sb = getSupabase();
  if (!sb) return { listing: null, uk: null, th: null };

  const { data: listing, error } = await sb
    .from('tbl_listings')
    .select('*')
    .eq('raia_id', raia_id)
    .eq('visibility', 'public')
    .maybeSingle();

  if (error || !listing) {
    if (error) console.error('[getListingByRaiaId]', error.message);
    return { listing: null, uk: null, th: null };
  }

  const jur = (listing as Listing).jurisdiction;
  let uk: ListingUK | null = null;
  let th: ListingTH | null = null;

  if (jur === 'GB') {
    const { data } = await sb.from('tbl_listings_uk').select('*').eq('raia_id', raia_id).maybeSingle();
    uk = (data ?? null) as ListingUK | null;
  } else if (jur === 'TH') {
    const { data } = await sb.from('tbl_listings_th').select('*').eq('raia_id', raia_id).maybeSingle();
    th = (data ?? null) as ListingTH | null;
  }

  return { listing: listing as Listing, uk, th };
}

export async function getMapPins(params: SearchParams = {}): Promise<MapPin[]> {
  const sb = getSupabase();
  if (!sb) return [];

  let query = sb
    .from('tbl_listings')
    .select('raia_id,lat,lon,rent_pcm,asking_price,bedrooms,property_type,photo_url,agent_id')
    .eq('visibility', 'public')
    .neq('listing_status', 'withdrawn')
    .not('lat', 'is', null)
    .not('lon', 'is', null);

  if (params.un_locode) query = query.eq('un_locode', params.un_locode);
  if (params.service_type) query = query.eq('service_type', params.service_type);
  if (params.bedrooms_min !== undefined) query = query.gte('bedrooms', params.bedrooms_min);
  if (params.rent_pcm_max !== undefined) query = query.lte('rent_pcm', params.rent_pcm_max);
  if (params.bbox) {
    query = query
      .gte('lat', params.bbox.sw_lat)
      .lte('lat', params.bbox.ne_lat)
      .gte('lon', params.bbox.sw_lon)
      .lte('lon', params.bbox.ne_lon);
  }

  const { data, error } = await query.limit(2000);
  if (error) {
    console.error('[getMapPins]', error.message);
    return [];
  }
  return (data ?? []) as MapPin[];
}
