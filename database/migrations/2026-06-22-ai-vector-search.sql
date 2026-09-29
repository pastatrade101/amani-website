-- ============================================================================
-- Goldfinch AI Travel Advisor — v2 semantic layer search functions (§10).
-- ADDITIVE: creates two stable SQL functions used by aiRetrieval. Requires the
-- pgvector tables from 2026-06-22-ai-advisor-v2.sql.
--
-- NOTE: the vector(1536) dimension must match cms_embeddings.embedding /
-- ai_answer_cache.question_embedding and AI_EMBEDDING_DIMENSIONS. If you switch
-- to a 1024-dim provider (e.g. Voyage voyage-3), change 1536 -> 1024 here AND
-- in the column definitions.
-- ============================================================================

-- Nearest CMS embeddings (tours/destinations/faqs) by cosine similarity.
create or replace function match_cms_embeddings(
  query_embedding vector(1536),
  match_source_type text default null,
  match_count int default 5
)
returns table (source_type text, source_id uuid, content text, similarity float)
language sql stable as $$
  select e.source_type, e.source_id, e.content,
         1 - (e.embedding <=> query_embedding) as similarity
  from cms_embeddings e
  where e.embedding is not null
    and (match_source_type is null or e.source_type = match_source_type)
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Nearest cached answer by cosine similarity (semantic answer cache).
create or replace function match_answer_cache(
  query_embedding vector(1536),
  match_count int default 1
)
returns table (id uuid, question text, answer text, source text, similarity float)
language sql stable as $$
  select c.id, c.question, c.answer, c.source,
         1 - (c.question_embedding <=> query_embedding) as similarity
  from ai_answer_cache c
  where c.question_embedding is not null
  order by c.question_embedding <=> query_embedding
  limit match_count;
$$;
