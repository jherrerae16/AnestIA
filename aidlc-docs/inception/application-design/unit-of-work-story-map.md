# Story → Unit Map — AnestIA

Every story assigned to exactly one unit. Coverage verified.

| Unit | Stories | Epic |
|---|---|---|
| U0 Fundaciones | US-0.1 Sign in · US-0.2 Workspace seed | E0 |
| U1 Captura | US-1.1 Preset builder · US-1.2 Case+link · US-1.3 Consent · US-1.4 Patient form · US-1.5 Attachments · US-1.6 Partial save · US-1.7 Persistence | E1 |
| U2 Lab Intelligence | US-2.1 Lab extract · US-2.2 Red-flag · US-2.3 GLP-1 detect | E2 |
| U3 Motor clínico | US-3.1 Structured draft · US-3.2 GLP-1 recs · US-3.3 IMC calc | E3 |
| U4 Documento | US-4.1 PDF render | E4 |
| U5 HITL | US-5.1 Side-by-side · US-5.2 Inline edit · US-5.3 Exam confirm · US-5.4 Blocking approval · US-5.5 Reject | E5 |
| U6 Distribución/historial | US-6.1 Directory distribute · US-6.2 Sheets export · US-6.3 Patient history · US-6.4 Dashboard · US-6.5 Recipient receive | E6 |
| U7 Afinado | US-7.1 Audit · US-7.2 Retries/idempotency · US-7.3 Security/encryption | E7 |

## Coverage check
- **Stories**: all ~30 stories assigned; none orphaned; none duplicated.
- **Personas**: P1 across U0-U7; P2 in U1; P3 in U6.
- **PRD modules 1–12**: M1→U1, M2→U1, M3→U1/U2, M4→U2, M5→U3, M6→U4, M7→U5, M8→U6, M9→U6, M10→U0, M11→U6, M12→U6.
- **Clinical safety CS1–CS8**: enforced across U1/U2/U3/U4/U5/U6 as mapped in stories.md; verified in U7.
