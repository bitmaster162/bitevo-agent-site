import example from '../../data/build-workflow-value-example.json';

export function GET() {
  return new Response(`${JSON.stringify(example, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    }
  });
}
