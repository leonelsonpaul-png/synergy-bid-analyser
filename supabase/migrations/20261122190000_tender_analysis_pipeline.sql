-- Tender analysis pipeline: additive changes only; preserve existing RLS policies and data.
alter table public.tender_files
  add column if not exists extracted_text text,
  add column if not exists page_references jsonb not null default '[]'::jsonb,
  add column if not exists extraction_metadata jsonb not null default '{}'::jsonb;

alter table public.evidence_documents
  add column if not exists extracted_text text,
  add column if not exists page_references jsonb not null default '[]'::jsonb;

alter table public.tender_analyses
  add column if not exists report_storage_path text,
  add column if not exists model_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_tender_analyses_tender_version
  on public.tender_analyses (tender_id, version desc);

comment on column public.tender_files.extracted_text is 'Text extracted by the tender-analysis Edge Function; page references are retained separately.';
comment on column public.tender_files.page_references is 'Per-page extraction/citation metadata generated from the source document.';
comment on column public.tender_analyses.report_storage_path is 'Private Storage object path for the generated clause-wise PDF report.';
