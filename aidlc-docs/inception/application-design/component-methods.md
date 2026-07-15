# Component Methods — AnestIA

Method signatures + I/O types. Business rules deferred to per-unit Functional Design. TypeScript-flavored; types live in `packages/shared`.

## AuthService (C-API-1)
```ts
login(email: string, password: string): Promise<{ sessionCookie: string } | AuthError>   // adaptive hash verify, throttled
getSession(req: Request): Promise<Session | null>                                          // validate cookie server-side
requireSession(req: Request): Promise<Session>                                             // throws 401 if none (deny-by-default)
verifyCaseToken(token: string): Promise<{ caseId: string } | null>                         // object-level authz for patient form / downloads
```

## AIProvider (C-API-2)  — the ONLY key-dependent component
```ts
extractLabs(files: FileRef[]): Promise<ExtractedLab[]>          // stub: example values; anthropic: Claude vision. NEVER fabricates absent values.
generateAssessment(input: ClinicalInput): Promise<DocumentJSON> // stub: Anexo-C reference; anthropic: generateObject(documentSchema)
// factory
getAIProvider(): AIProvider                                     // reads AI_PROVIDER=stub|anthropic
```

## StorageProvider (C-API-3)
```ts
put(bytes: Buffer, meta: { caseId: string; type: AttachmentType; filename: string }): Promise<{ key: string; hash: string }>
get(key: string): Promise<Buffer>
signedUrl(key: string, ttlSeconds: number): Promise<string>
```

## Mailer (C-API-4)
```ts
send(msg: { to: string[]; subject: string; html: string; attachments: { filename: string; content: Buffer }[] }): Promise<DeliveryResult>
```

## SheetsExporter (C-API-5)
```ts
export(caseIds: string[]): Promise<{ spreadsheetUrl: string }>
```

## LabEngine (C-API-6) — deterministic, no LLM
```ts
flag(result: ExtractedLab, sex: Sex | null): LabFlag           // NORMAL | ALERTA | CRITICO per lab-rules.md
flagAll(results: ExtractedLab[], sex: Sex | null): ExtractedLab[]
```

## ClinicalEngine (C-API-7)
```ts
buildInput(caseId: string): Promise<ClinicalInput>             // answers + extracted labs + GLP-1 marker
computeIMC(weightKg: number, heightCm: number): number         // deterministic, cm→m (PBT target)
generate(caseId: string): Promise<GeneratedAssessment>         // assemble prompt-maestro, call AIProvider, inject code-IMC, validate documentSchema, reject bad output; exam fields = pendiente_examen
```

## PdfRenderer (C-API-8)
```ts
renderDraft(assessment: GeneratedAssessment, profile: ProfileBranding): Promise<Buffer>   // DRAFT watermark if exam pending / required empty
renderFinal(approved: ApprovalRecord, profile: ProfileBranding): Promise<Buffer>          // only after approval; immutable
```

## QueueManager (C-API-9)  — 4 chained, idempotent handlers
```ts
publish(job: 'form.submitted', payload: { caseId: string }): Promise<void>
// handlers (each: check-if-done → work → persist → advance Case.status → publish next)
onLabExtract(caseId): Promise<void>       // → status LABS extract; publishes lab.flag
onLabFlag(caseId): Promise<void>          // → LABS_ANALIZADOS; publishes clinical.generate
onClinicalGenerate(caseId): Promise<void> // → BORRADOR_GENERADO; publishes document.render
onDocumentRender(caseId): Promise<void>   // → PENDIENTE_REVISION; notifies anesthesiologist
```

## AuditLogger (C-API-10)
```ts
log(entry: { actorId?: string; action: string; entity: string; entityId?: string; meta?: Json }): Promise<void>   // append-only
```

## Domain services (C-API-11)
```ts
// CaseService
createCase(anesthesiologistId, dto): Promise<{ caseId: string; linkToken: string }>
transition(caseId, status): Promise<void>
// PresetService
createPreset(ownerId, dto): Promise<Preset>; newVersion(presetId): Promise<Preset>
// PatientService
upsertFromForm(anesthesiologistId, answers): Promise<Patient>; search(ownerId, query): Promise<Patient[]>; prefill(patientId): Promise<Partial<FormAnswers>>
// DirectoryService
listContacts(ownerId); quickAdd(ownerId, dto); 
// ApprovalService  (blocking-approval rules live here)
canApprove(caseId): Promise<{ ok: boolean; blockers: string[] }>   // required-empty? exam pending?
approve(caseId, approverId, edits): Promise<ApprovalRecord>        // lock version, signature, immutable PDF, audit
reject(caseId, reason): Promise<void>
// DistributionService
distribute(caseId, contactIds, channels): Promise<DeliveryRecord[]>  // approved+immutable only
```

## Shared schemas (C-SHARED-1) — Q5=A nested contract
```ts
// each document field:
type FieldState = 'ok' | 'pendiente_examen' | 'no_reportado' | 'no_disponible'
type DocField<T=string> = { valor: T | null; estado: FieldState; fuente: string | null; alerta?: boolean; nota?: string }
// documentSchema (Zod) sections: identificacion, antecedentes, paraclinicos, examen_fisico, valoracion_plan
// examen_fisico fields default estado='pendiente_examen'
```
