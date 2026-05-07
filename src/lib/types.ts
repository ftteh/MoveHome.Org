// Mirrors raia-protocol/schemas/listing.json v0.2 and the raia-public.tbl_listings DDL.

export type ServiceType = 'long_term' | 'short_term' | 'sale';

export type ListingStatus =
  | 'available'
  | 'under_offer'
  | 'let_agreed'
  | 'sale_agreed'
  | 'exchanged'
  | 'completed'
  | 'fallen_through'
  | 'withdrawn'
  | 'paused';

export type Visibility = 'public' | 'pre_launch' | 'off_market';

export interface ListingPhoto {
  url: string;
  caption: string | null;
  order: number;
}

export interface Listing {
  raia_id: string;
  asset_id: string;
  agent_id: string;
  agent_ref: string | null;
  branch_id: string | null;
  agent_card_url: string | null;

  un_locode: string;
  jurisdiction: string;

  headline: string | null;
  marketing_description: string | null;

  lat: number | null;
  lon: number | null;
  postcode_full: string | null;
  postcode_district: string | null;
  street_name: string | null;
  building_number: string | null;
  suburb: string | null;

  property_type: string | null;
  service_type: ServiceType;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area_sqm: number | null;
  floor: number | null;
  total_floors: number | null;
  furnishing: string | null;
  is_new_build: boolean;
  development_name: string | null;

  rent_pcm: number | null;
  daily_rate: number | null;
  asking_price: number | null;
  currency: string;
  pricing_id: string | null;
  available_from: string | null;

  listing_status: ListingStatus | null;
  status_effective_from: string | null;

  features: string[];

  featured_image_url: string | null;
  photo_url: string | null;
  photos: ListingPhoto[] | null;
  floor_plan_url: string | null;
  video_url: string | null;
  tour_360_url: string | null;

  visibility: Visibility;
  publish_from: string | null;
  publish_until: string | null;

  enquiry_endpoint: string | null;

  snapshot_version: number;
  synced_at: string;
  withdrawn_at: string | null;
}

export interface ListingUK {
  raia_id: string;
  tenure: string | null;
  lease_years_remaining: number | null;
  service_charge_pa: number | null;
  ground_rent_pa: number | null;
  council_tax_band: string | null;
  epc_rating: string | null;
  epc_register_url: string | null;
  hmo_licence_required: boolean | null;
  hmo_licence_number: string | null;
  material_info_complete: boolean;
}

export interface ListingTH {
  raia_id: string;
  ownership_type: string | null;
  foreign_ownership_eligible: boolean | null;
  foreign_quota_remaining_pct: number | null;
  chanote_type: string | null;
  bts_station: string | null;
  bts_distance_m: number | null;
  mrt_station: string | null;
  mrt_distance_m: number | null;
}

export interface ListingPortal {
  raia_id: string;
  portal_key: string;
  is_enabled: boolean;
  status: string | null;
  portal_listing_url: string | null;
  pushed_at: string | null;
  last_seen_live_at: string | null;
}

export interface SearchParams {
  un_locode?: string;
  bbox?: { sw_lat: number; sw_lon: number; ne_lat: number; ne_lon: number };
  service_type?: ServiceType;
  bedrooms_min?: number;
  bedrooms_max?: number;
  rent_pcm_max?: number;
  asking_price_max?: number;
  property_type?: string;
  features?: string[];
  limit?: number;
  offset?: number;
}

export interface MapPin {
  raia_id: string;
  lat: number;
  lon: number;
  rent_pcm: number | null;
  asking_price: number | null;
  bedrooms: number | null;
  property_type: string | null;
  photo_url: string | null;
  agent_id: string;
}
