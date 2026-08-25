# System Assurance release scope

Release candidate: `agent/system-assurance-offer`

Purpose: add a commercial System Assurance umbrella without replacing the existing Agent Authority & Evidence Primary Audit.

Included:
- `/assurance` public page
- AI Evidence Readiness Sprint — $1,500 fixed entry scope
- Security Control Validation — $1,500 fixed bounded staging scope
- Primary Agent Authority & Evidence Audit remains $4,900
- finance / voice / legal / hospitality / enterprise AI are examples of system types, not separate commercial lines
- `/ai-audit` becomes a noindex compatibility route pointing to System Assurance
- sitemap and reviewed CSP allowlists updated for the new canonical page

Validation:
- Vercel preview READY at commit `37f4a8f862d1e953839233d181f8520453044d0b`
- `/assurance` HTTP 200
- canonical points to `https://bitevo.work/assurance`
- project quality gate and inline CSP gate passed

No production exploitation, certification claim, legal opinion, penetration-test claim, or compliance-pass guarantee is introduced.
