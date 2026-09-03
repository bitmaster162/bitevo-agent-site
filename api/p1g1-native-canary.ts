export default {
  async fetch(_request: Request) {
    return Response.json(
      {
        status: 'SERVICE_DISABLED',
        phase: 'P1G1_NATIVE_VERCEL_CANARY',
        provider_io: 0
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex'
        }
      }
    );
  }
};
