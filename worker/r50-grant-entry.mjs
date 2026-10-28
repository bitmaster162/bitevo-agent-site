// R50-G3-L2: Worker entrypoint for local workerd compatibility checks.
// The implementation module retains its named R50_CONSUME_SQL export for tests.
// This module exposes only the Worker handler, as required by workerd.
// No deployment or production D1 binding is authorized by this file.
import grantWorker from './r50-grant-claim.mjs';

export default grantWorker;
