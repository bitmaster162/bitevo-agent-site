import gate from '../../data/build-measured-value-gate.json';

export const prerender = true;

export function GET() {
  return new Response(JSON.stringify(gate, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
