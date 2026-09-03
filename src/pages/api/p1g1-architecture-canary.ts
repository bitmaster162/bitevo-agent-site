export const prerender = false;

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex'
};

export function GET() {
  return new Response(JSON.stringify({
    status: 'SERVICE_DISABLED',
    phase: 'P1G1_ARCHITECTURE_CANARY',
    provider_io: 0
  }), { status: 503, headers });
}

export function POST() {
  return new Response(JSON.stringify({
    status: 'SERVICE_DISABLED',
    phase: 'P1G1_ARCHITECTURE_CANARY',
    provider_io: 0
  }), { status: 503, headers });
}
