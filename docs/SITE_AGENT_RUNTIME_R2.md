# BitEvo Qualification Concierge — Runtime R2

State: `SOURCE_PREPARED / LOCAL_ONLY / HUMAN_REVIEW`
Baseline: `8d6b28532a56075c0f1cb78d4845b274125deaeb`

Flow: `intent → workflow facts → consequence boundary → never-automate boundary → sensitive-data guard → human-ready brief → recommended next artifact`.

Intent routing:
- audit → evidence/readiness review;
- build → bounded implementation brief;
- governance → authority/effect-gate map;
- automation → candidate-vs-human-control matrix;
- unsure → diagnostic.

R2 blocks credentials, secrets, wallet seeds, card data and obvious private customer/identity material from the local builder. It adds an ephemeral session receipt and a deterministic recommended next artifact. No external submission, CRM write, testing, deploy, account access, payment or messaging authority is granted.