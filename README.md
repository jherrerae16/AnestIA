# AnestIA

**Automated pre-anesthesia assessment — the paperwork is drafted by AI, the clinical judgement stays with the anesthesiologist.**

A pre-anesthesia assessment is mostly reconstruction work: read the patient's
history, hunt through lab PDFs for the values that matter, cross them against the
planned procedure, and write it all up. AnestIA does the reconstruction and hands
the anesthesiologist a complete draft to correct and sign.

```
Patient form → lab analysis → AI-drafted clinical document → anesthesiologist review → distribution
```

Nothing leaves the system without a human approval step.

## What it does

| Stage | Detail |
|---|---|
| **Capture** | The patient fills a structured questionnaire. Questions and their mapping to clinical fields are configurable (`docs/form-mapping.md`). |
| **Lab intelligence** | Lab reports arrive as PDFs. The system extracts the values, normalizes them, and applies the rule set in `docs/lab-rules.md` to flag what is out of range and what it implies for anesthesia. |
| **Clinical engine** | Combines history, labs and procedure into an assessment: risk classification, findings, recommendations, and what is still missing. |
| **Document** | Generates the clinical document in the official format (`docs/diseno-oficial.md`). |
| **Review (HITL)** | The anesthesiologist reviews, edits and approves. Nothing is distributed before that. |
| **Distribution** | The approved document is delivered to the parties who need it. |

## The qualities that define it

**Human-in-the-loop is structural, not a setting.** The anesthesiologist is the
responsible party and every assessment passes through their approval. The system
is documentation support — it never issues a clinical conclusion on its own
authority. Clinical safety rules are pinned in `.claude/rules/clinical-safety.md`
so they survive every future change.

**The model is chosen per task, not per project.** Clinical reasoning runs on
Opus, because an anesthesiologist puts their signature on the output. Lab
extraction runs on Haiku over embedded text, with Sonnet vision only as a
fallback. Paying frontier-model prices for OCR would be waste; paying
cheap-model prices for clinical judgement would be reckless.

**Lab extraction degrades intelligently and cheaply.** Three modes, set via
`LAB_EXTRACTION_MODE`:

| Mode | Behavior |
|---|---|
| `capas` *(default)* | Reads the PDF's embedded text (unpdf, zero tokens) → Haiku to JSON. If the PDF is a scan or unreadable, it escalates to vision automatically. **~80 % cheaper than pure vision.** |
| `vision` | Forces vision (Sonnet) on every file. |
| `comparativo` | Runs both, persists the vision result, and logs the diff to the audit trail — so the migration decision is made on data, not on a hunch. |

**It builds and runs without an API key.** `AI_PROVIDER=stub` exercises the entire
flow end to end with no LLM calls, which means CI, onboarding and UI work never
depend on a billing account. Switching to `AI_PROVIDER=anthropic` is the single
point of change.

**Deliberately boring infrastructure.** LTS Node, PostgreSQL 16 installed
natively, `pg-boss` for the job queue. No containers, no orchestration layer —
this is meant to run in a clinic, maintained by whoever is there.

**Built under AI-DLC.** Requirements, design and construction artifacts are all in
`aidlc-docs/`, phase by phase, so any decision can be traced to the requirement
that motivated it.

## Stack

Next.js API · Angular admin panel · PostgreSQL 16 + `pgvector` · Prisma ·
`pg-boss` job queue · Anthropic Claude (Opus / Sonnet / Haiku) · TypeScript
end to end.

## Repository layout

```
apps/api/          Next.js — API and clinical engine
apps/web/          Angular — anesthesiologist review panel
packages/shared/   Shared types
prisma/            Schema and migrations
docs/              PRD, official document design, form mapping, lab rules, master prompt
aidlc-docs/        AI-DLC artifacts (inception, construction, audit)
```

## Requirements

Node.js LTS · PostgreSQL 16 with the `pgvector` extension (native install, no containers).

## Getting started

```bash
cp .env.example .env         # fill in DATABASE_URL
npm install
npx prisma migrate dev       # create the schema
npm run seed                 # seed the "Luquetta" profile + base preset
npm run dev                  # API (Next.js) + panel (Angular)
npm run worker               # queue workers (pg-boss)
```

To enable real AI: set `ANTHROPIC_API_KEY` and `AI_PROVIDER=anthropic`.
Leave `AI_PROVIDER=stub` to run the full flow without an API key.

## Status

Inception complete. Construction:
**U0 Foundations ✅ · U1 Capture ✅ · U2 Lab Intelligence ✅ · U3 Clinical engine ✅ · U4 Document ✅ · U5 Review/HITL ✅ · U6 Distribution ✅**

End-to-end functional pilot running against the real Claude key. Currently being
refined: the questionnaire editor, and recovery of stuck cases.

## Documentation

| File | What it covers |
|---|---|
| `CLAUDE.md` | Operating context and golden rules |
| `docs/PRD_AnestIA.md` | Full requirements |
| `docs/como-funciona-anestia.md` | How the system works, end to end |
| `docs/implementation-prompt.md` | Phased construction plan |
| `docs/prompt-maestro-v2.md` | System prompt of the clinical engine |
| `docs/diseno-oficial.md` | Official clinical document format |
| `docs/form-mapping.md` | Questionnaire → clinical field mapping |
| `docs/lab-rules.md` | Lab interpretation rules |

> Document filenames, database identifiers and UI copy stay in Spanish — they are
> real paths and real clinical-facing text.

---

> **Clinical documentation support system.** The anesthesiologist is the
> responsible party; every assessment requires their approval before it leaves
> the system (HITL).

*Private project. Not for redistribution.*
