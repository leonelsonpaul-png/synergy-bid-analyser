-- Additive tender-analysis and evidence-review metadata.
-- Reviewed against live public schema on 2026-11-22: these columns do not exist yet.
alter table public.tender_files
  add column if not exists extracted_text text,
  add column if not exists page_references jsonb not null default '[]'::jsonb,
  add column if not exists extraction_metadata jsonb not null default '{}'::jsonb;

alter table public.evidence_documents
  add column if not exists extracted_text text,
  add column if not exists page_references jsonb not null default '[]'::jsonb,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

alter table public.tender_analyses
  add column if not exists report_storage_path text,
  add column if not exists model_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_tender_analyses_tender_version
  on public.tender_analyses (tender_id, version desc);

create index if not exists idx_audit_events_entity_created
  on public.audit_events (entity_type, entity_id, created_at desc);

comment on column public.tender_files.extracted_text is 'Text extracted by the tender-analysis Edge Function; page references are retained separately.';
comment on column public.tender_files.page_references is 'Per-page extraction/citation metadata generated from the source document; empty when source format has no stable pagination.';
comment on column public.evidence_documents.reviewed_by is 'Administrator who last verified or rejected this company evidence document.';
comment on column public.evidence_documents.reviewed_at is 'Timestamp of the latest administrator evidence review.';
comment on column public.evidence_documents.review_notes is 'Notes recorded by the administrator during the latest evidence review.';
comment on column public.tender_analyses.report_storage_path is 'Private Storage object path for the generated clause-wise PDF report.';
