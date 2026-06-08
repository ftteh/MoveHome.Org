// POST /api/enquire — accept enquiry from MoveHome UI, persist to
// tbl_enquiries, forward to source agent's enquiry_endpoint.
//
// Wire payload mirrors RAIA Protocol v0.2 enquiry.json — see
// estateaigents.org/schemas/enquiry.json.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createEnquiry, type ViewingRequest } from '@/lib/enquiry';

interface IncomingPayload {
  raia_id?: unknown;
  enquirer?: {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    preferred_contact?: unknown;
  };
  message?: unknown;
  viewing_request?: {
    preferred_dates?: unknown;
    party_size?: unknown;
  };
}

const RAIA_ID_RE = /^prop-[a-z]{2}-[a-z0-9-]{2,32}-[0-9]{4,}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PREFERRED_CONTACTS = new Set(['email', 'phone', 'whatsapp']);

export async function POST(request: Request) {
  let body: IncomingPayload;
  try {
    body = (await request.json()) as IncomingPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Validate ────────────────────────────────────────────────────────────
  const raia_id = typeof body.raia_id === 'string' ? body.raia_id : '';
  if (!RAIA_ID_RE.test(raia_id)) {
    return NextResponse.json({ error: 'Invalid raia_id' }, { status: 400 });
  }

  const name = typeof body.enquirer?.name === 'string' ? body.enquirer.name.trim() : '';
  const email = typeof body.enquirer?.email === 'string' ? body.enquirer.email.trim() : '';
  if (!name || name.length > 200) {
    return NextResponse.json({ error: 'enquirer.name required (1-200 chars)' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'enquirer.email invalid' }, { status: 400 });
  }

  const phone = typeof body.enquirer?.phone === 'string' ? body.enquirer.phone.trim() : null;
  const preferred_contact_raw =
    typeof body.enquirer?.preferred_contact === 'string' ? body.enquirer.preferred_contact : null;
  const preferred_contact =
    preferred_contact_raw && PREFERRED_CONTACTS.has(preferred_contact_raw)
      ? preferred_contact_raw
      : null;

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length < 1 || message.length > 2000) {
    return NextResponse.json({ error: 'message required (1-2000 chars)' }, { status: 400 });
  }

  const viewing_request: ViewingRequest | null =
    body.viewing_request &&
    Array.isArray(body.viewing_request.preferred_dates) &&
    body.viewing_request.preferred_dates.length > 0
      ? {
          preferred_dates: (body.viewing_request.preferred_dates as unknown[])
            .filter((d): d is string => typeof d === 'string')
            .slice(0, 3),
          ...(typeof body.viewing_request.party_size === 'number'
            ? { party_size: body.viewing_request.party_size }
            : {})
        }
      : null;

  // ── Optional auth — link enquiry to user if signed in ──────────────────
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();

  const result = await createEnquiry({
    raia_id,
    name,
    email,
    phone,
    preferred_contact,
    message,
    viewing_request,
    userId: user?.id ?? null,
    ipCountry: request.headers.get('x-vercel-ip-country')
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  }

  return NextResponse.json({ enquiry_id: result.enquiry_id, status: result.status }, { status: 201 });
}
