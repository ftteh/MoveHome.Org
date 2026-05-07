'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function Filters() {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    router.push(`/search?${sp.toString()}`);
  }

  return (
    <form className="flex flex-wrap gap-3 items-end">
      <label className="flex flex-col text-sm">
        <span className="text-slate-600 text-xs mb-1">Service</span>
        <select
          className="border border-slate-300 rounded px-2 py-1"
          defaultValue={params.get('service_type') ?? ''}
          onChange={(e) => update('service_type', e.target.value)}
        >
          <option value="">All</option>
          <option value="long_term">Long-term rent</option>
          <option value="short_term">Short-term rent</option>
          <option value="sale">For sale</option>
        </select>
      </label>

      <label className="flex flex-col text-sm">
        <span className="text-slate-600 text-xs mb-1">Min beds</span>
        <input
          type="number"
          min={0}
          max={10}
          className="border border-slate-300 rounded px-2 py-1 w-20"
          defaultValue={params.get('bedrooms_min') ?? ''}
          onBlur={(e) => update('bedrooms_min', e.target.value)}
        />
      </label>

      <label className="flex flex-col text-sm">
        <span className="text-slate-600 text-xs mb-1">Max rent (pcm)</span>
        <input
          type="number"
          min={0}
          step={50}
          className="border border-slate-300 rounded px-2 py-1 w-28"
          defaultValue={params.get('rent_pcm_max') ?? ''}
          onBlur={(e) => update('rent_pcm_max', e.target.value)}
        />
      </label>

      <label className="flex flex-col text-sm">
        <span className="text-slate-600 text-xs mb-1">Location</span>
        <select
          className="border border-slate-300 rounded px-2 py-1"
          defaultValue={params.get('un_locode') ?? ''}
          onChange={(e) => update('un_locode', e.target.value)}
        >
          <option value="">All</option>
          <option value="GBLON">London</option>
          <option value="THBKK">Bangkok</option>
        </select>
      </label>
    </form>
  );
}
