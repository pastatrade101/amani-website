import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destinationUpdateSchema } from './destinations.schema';
test('saving destination guides preserves legacy imports and typed CMS blocks',()=>{
  const guide=[{title:'At a glance',items:[{title:'Best for',body:'Wildlife'}]},{type:'table',columns:['Season'],rows:[['June']],editor_note:'keep'},{type:'photo',url:'https://example.com/place.jpg',caption:'A landscape'}];
  assert.deepEqual(destinationUpdateSchema.parse({guide}).guide,guide);
  assert.deepEqual(destinationUpdateSchema.parse({guide:[]}).guide,[]);
});
test('guide saves reject malformed blocks without changing destination status',()=>{
  assert.equal(destinationUpdateSchema.safeParse({guide:[null]}).success,false);
  assert.equal(destinationUpdateSchema.safeParse({guide:[{type:12}]}).success,false);
  assert.equal(destinationUpdateSchema.parse({guide:[]}).status,undefined);
});
