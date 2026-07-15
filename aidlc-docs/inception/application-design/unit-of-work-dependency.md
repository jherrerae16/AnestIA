# Unit Dependency Matrix — AnestIA

## Build order (strictly sequential)
U0 → U1 → U2 → U3 → U4 → U5 → U6 → U7

## Dependency matrix
| Unit | Depends on | Reason (hard data/artifact dependency) |
|---|---|---|
| U0 | — | foundation |
| U1 | U0 | needs auth, seed, schemas, queue setup |
| U2 | U1 | consumes submitted attachments + `form.submitted` |
| U3 | U2 | consumes extracted+flagged labs + answers |
| U4 | U3 | renders the generated assessment |
| U5 | U4 | reviews/approves the rendered draft |
| U6 | U5 | distributes the approved immutable PDF |
| U7 | U0–U6 | hardens the whole system |

## Why sequential (not parallel)
Each unit's input is the prior unit's output — this is a pipeline (form → labs → clinical → document → review → distribution). No two adjacent units can run in parallel without stubbing the other's output, which the AI-stub already partially provides but the app flow still chains them. U7 is cross-cutting and must run last.

## Shared foundations (built in U0, used by all)
- Prisma schema + client, npm workspaces, shared Zod schemas, adapter interfaces (stub impls), pg-boss, AuthService, AuditLogger skeleton.

## Cross-cutting concerns per unit
- **Security extension**: applies to every unit that adds endpoints/handlers (U0-U6); consolidated hardening in U7.
- **PBT extension**: property identification during each unit's Functional Design; tests generated in Code Generation; CI/seed-logging finalized in U7 / Build&Test.
