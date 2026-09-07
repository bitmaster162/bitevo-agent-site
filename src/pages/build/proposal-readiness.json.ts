import readiness from '../../data/build-proposal-readiness.json';

export function GET() {
  return new Response(`${JSON.stringify(readiness, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    }
  });
}
