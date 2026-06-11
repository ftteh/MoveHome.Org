'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const FIELD =
  'rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-1.5';

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
    <form className="flex flex-wrap gap-4 items-end rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 md:p-5">
      <label className="flex flex-col">
        <span className={LABEL}>Service</span>
        <select
          className={FIELD}
          defaultValue={params.get('service_type') ?? ''}
          onChange={(e) => update('service_type', e.target.value)}
        >
          <option value="">All</option>
          <option value="long_term">Long-term rent</option>
          <option value="short_term">Short-term rent</option>
          <option value="sale">For sale</option>
        </select>
      </label>

      <label className="flex flex-col">
        <span className={LABEL}>Min beds</span>
        <input
          type="number"
          min={0}
          max={10}
          className={`${FIELD} w-24`}
          defaultValue={params.get('bedrooms_min') ?? ''}
          onBlur={(e) => update('bedrooms_min', e.target.value)}
        />
      </label>

      <label className="flex flex-col">
        <span className={LABEL}>Max rent (pcm)</span>
        <input
          type="number"
          min={0}
          step={50}
          className={`${FIELD} w-32`}
          defaultValue={params.get('rent_pcm_max') ?? ''}
          onBlur={(e) => update('rent_pcm_max', e.target.value)}
        />
      </label>

      <label className="flex flex-col">
        <span className={LABEL}>Location</span>
        <select
          className={FIELD}
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
