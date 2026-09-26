import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { batchFields, getTranslationProvider, parseReply } from './translation-provider';
import type { TranslationFields } from '../utils/translations';

/**
 * A long safari package used to go out as one request, and the Swahili reply
 * ran past the output limit and stopped mid-string: "malformed output". What
 * matters is that long pages are split, a cut-off reply is recovered rather
 * than reported, and nothing partial is ever returned.
 */

type Reply = { status?: number; text?: string; stop?: string };

const realFetch = globalThis.fetch;
let calls: Array<Record<string, string | string[]>> = [];
let answer: (sent: Record<string, string | string[]>, call: number) => Reply;

const context = { entityType: 'safari_packages', entityName: 'Test', sourceLanguage: 'en', targetLanguage: 'sw', fieldLabels: {} };

// Echoes each sent value back upper-cased, as a stand-in for a translation.
const translateAll = (sent: Record<string, string | string[]>): Reply => ({
  text: JSON.stringify(
    Object.fromEntries(
      Object.entries(sent).map(([key, value]) => [key, Array.isArray(value) ? value.map((v) => v.toUpperCase()) : value.toUpperCase()])
    )
  )
});

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  calls = [];
  answer = translateAll;
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const content = JSON.parse(init.body).messages[0].content as string;
    const sent = JSON.parse(content.slice(content.lastIndexOf('\n') + 1));
    calls.push(sent);
    const reply = answer(sent, calls.length);
    return new Response(
      JSON.stringify({ content: [{ type: 'text', text: reply.text ?? '' }], stop_reason: reply.stop ?? 'end_turn' }),
      { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const longPage = (count: number, size: number): TranslationFields =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`sections.#b${i}.body`, `word `.repeat(size / 5)]));

describe('batchFields', () => {
  it('keeps a short record in one request', () => {
    assert.equal(batchFields({ name: 'A', hero_title: 'B' }).length, 1);
  });

  it('splits a long record, in order, without losing a field', () => {
    const fields = longPage(12, 1000);
    const batches = batchFields(fields, 4000);
    assert.ok(batches.length > 1);
    assert.deepEqual(batches.flatMap((batch) => Object.keys(batch)), Object.keys(fields));
  });

  it('never splits one field', () => {
    const batches = batchFields({ huge: 'x'.repeat(9000), small: 'y' }, 4000);
    assert.deepEqual(batches.map((batch) => Object.keys(batch)), [['huge'], ['small']]);
  });
});

describe('parseReply', () => {
  it('reads plain, fenced and wrapped JSON', () => {
    assert.deepEqual(parseReply('{"a":"b"}'), { a: 'b' });
    assert.deepEqual(parseReply('```json\n{"a":"b"}\n```'), { a: 'b' });
    assert.deepEqual(parseReply('Here it is: {"a":"b"} Done.'), { a: 'b' });
  });

  it('refuses a reply that was cut off', () => {
    assert.equal(parseReply('{"a":"mtindo wa malazi — kamb'), null);
  });
});

describe('AI translation', () => {
  it('translates a long page in several requests and returns every field', async () => {
    const fields = longPage(12, 1000);
    const out = await getTranslationProvider().translate(fields, context);
    assert.ok(calls.length > 1);
    assert.deepEqual(Object.keys(out).sort(), Object.keys(fields).sort());
    assert.equal(out['sections.#b0.body'], String(fields['sections.#b0.body']).toUpperCase());
  });

  it('recovers when a reply is cut off at the output limit', async () => {
    // The first, full-size request is truncated; the halves succeed.
    answer = (sent, call) => (call === 1 ? { text: '{"name":"JI', stop: 'max_tokens' } : translateAll(sent));
    const out = await getTranslationProvider().translate({ name: 'a', hero_title: 'b', hero_subtitle: 'c' }, context);
    assert.deepEqual(out, { name: 'A', hero_title: 'B', hero_subtitle: 'C' });
    assert.equal(calls.length, 3);
  });

  it('retries once when the service is busy', async () => {
    answer = (sent, call) => (call === 1 ? { status: 529, text: '' } : translateAll(sent));
    const out = await getTranslationProvider().translate({ name: 'a' }, context);
    assert.deepEqual(out, { name: 'A' });
  });

  it('names the field when one field alone is too long, and returns nothing', async () => {
    answer = () => ({ text: '{"name":"JI', stop: 'max_tokens' });
    await assert.rejects(
      getTranslationProvider().translate({ name: 'a' }, { ...context, fieldLabels: { name: 'Package name' } }),
      /"Package name" is too long/
    );
  });

  it('drops keys that were never sent', async () => {
    answer = () => ({ text: '{"name":"A","injected":"x"}' });
    assert.deepEqual(await getTranslationProvider().translate({ name: 'a' }, context), { name: 'A' });
  });
});
