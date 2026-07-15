# U1 — Frontend Components (Angular 19)

## Panel (P1, guarded)
### PresetBuilderPage
- List presets; editor: add/remove/reorder questions, set type/required/options/conditional; save (versions).
- Signals: `preset`, `questions`, `dirty`. data-testid: `preset-save-button`, `preset-add-question-button`.

### CaseCreatorPage
- Pick preset → create case → show tokenized link + copy button.
- data-testid: `case-create-button`, `case-link-copy-button`, `case-link-input`.

## Patient form (P2, public, mobile-first, branded)
### PatientFormPage (by token)
- Loads preset + prior partial + consent state.
- **ConsentGate** (blocks form until accepted) — shows CONSENT_TEXT, accept checkbox. data-testid: `consent-accept-checkbox`, `consent-continue-button`.
- **DynamicQuestion** — renders per type (texto/select/multi/fecha/número/sí-no/archivo); honors conditional visibility; client validation (Zod-shared).
- **AttachmentUploader** — multi-file, type/size limits, progress. data-testid: `form-attachment-input`.
- Actions: `form-save-partial-button`, `form-submit-button`.
- Branding: profile logo header; responsive; accessible (labels/contrast per web-design-guidelines).

## API integration
- Panel: `/api/panel/presets/**`, `/api/panel/cases/**` (session).
- Form: `/api/form/[token]`, `/save`, `/upload`, `/submit`, `/consent` (token).
