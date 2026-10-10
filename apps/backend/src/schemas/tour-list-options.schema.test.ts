import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tourListOptionBulkSchema, tourListOptionCreateSchema, tourListOptionUpdateSchema } from './tour-list-options.schema';
import { tourInclusionCreateSchema } from './tour-inclusions.schema';
import { tourExclusionCreateSchema } from './tour-exclusions.schema';

const id = '5b0c4f7e-9a51-4f1c-8a53-7f7d0b0f1a2b';
describe('reusable package terms', () => {
  it('normalizes wording and defaults to an available option', () => {
    const option = tourListOptionCreateSchema.parse({kind:'inclusion',title:'  Park   entry fees  '});
    assert.equal(option.title, 'Park entry fees');
    assert.equal(option.is_active, true);
    assert.equal(option.sort_order, 0);
  });
  it('permits wording/availability edits while keeping the list type immutable', () => {
    assert.deepEqual(tourListOptionUpdateSchema.parse({title:'Guide',is_active:false}), {title:'Guide',is_active:false});
    assert.equal(tourListOptionUpdateSchema.safeParse({kind:'exclusion'}).success, false);
    assert.equal(tourListOptionUpdateSchema.safeParse({title:' '}).success, false);
    assert.equal(tourListOptionCreateSchema.safeParse({kind:'inclusion',title:'x'.repeat(101)}).success, false);
  });
  it('validates every pasted item before any are inserted', () => {
    assert.deepEqual(tourListOptionBulkSchema.parse({kind:'exclusion',titles:[' Visa ', 'Insurance']}), {kind:'exclusion',titles:['Visa','Insurance']});
    for (const titles of [[], ['Visa',''], ['x'.repeat(101)], Array(201).fill('Visa')]) {
      assert.equal(tourListOptionBulkSchema.safeParse({kind:'exclusion',titles}).success, false);
    }
  });
  it('standalone tour details select canonical IDs and refuse free text', () => {
    for(const schema of [tourInclusionCreateSchema,tourExclusionCreateSchema]) {
      assert.equal(schema.safeParse({tour_id:id,option_id:id}).success,true);
      assert.equal(schema.safeParse({tour_id:id,title:'Park fees'}).success,false);
      assert.equal(schema.safeParse({tour_id:id,option_id:id,title:'Override the library'}).success,false);
    }
  });
});
