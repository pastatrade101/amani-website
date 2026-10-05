import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvedReviews, costRows, guideRows } from './homepage-guides';
import { mergeSections } from './home-content';

test('CMS guide copy, ordering, and hidden markers override defaults', () => {
  const sections=mergeSections([{section_key:'safari_day',is_active:false},{section_key:'safari_duration',sort_order:2,title:'A custom heading',subtitle:'A real CMS introduction',extra_data:{eyebrow:'TRAVEL SLOWLY',rows:[{label:'9 days',title:'Our longer safari',text:'Personal route'}]}}]);
  const duration=sections.find(s=>s.section_key==='safari_duration')!;
  assert.equal(duration.title,'A custom heading');
  assert.equal(duration.content,'A real CMS introduction');
  assert.equal(duration.subtitle,'TRAVEL SLOWLY');
  assert.equal(sections[1],duration);
  assert.deepEqual(guideRows(duration),[{label:'9 days',title:'Our longer safari',text:'Personal route'}]);
  assert.equal(sections.find(s=>s.section_key==='safari_day')?.is_active,false);
});
test('explicitly empty CMS rows stay empty, missing records get editorial defaults', () => {
  assert.deepEqual(guideRows({section_key:'safari_day',extra_data:{rows:[]}}),[]);
  assert.deepEqual(costRows({section_key:'cost_ranges',extra_data:{ranges:[]}}),[]);
  assert.equal(guideRows({section_key:'safari_day'}).length,7);
  assert.ok(costRows({section_key:'cost_ranges'}).every(row=>row.from==='Tailored quote'));
});
test('review cards require approval and valid rating; no fabricated reviews', () => {
  const base={id:'1',author_name:'Guest',message:'A wonderful experience',rating:4};
  assert.deepEqual(approvedReviews([]),[]);
  assert.deepEqual(approvedReviews([{...base,status:'pending'},{...base,status:'approved',rating:9},{...base,status:'approved'}]),[{...base,status:'approved'}]);
});
