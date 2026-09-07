import gate from '../../data/build-paid-start-gate.json';

export function GET() {
  return new Response(`${JSON.stringify(gate, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    }
  });
}
