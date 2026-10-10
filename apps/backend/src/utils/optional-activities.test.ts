import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optionalActivitySnapshots } from './optional-activities';
const link = { is_optional:true, additional_cost:true, activity:{id:'balloon',name:'Balloon safari',status:'published',deleted_at:null}, tour:{id:'tour-a',status:'published',deleted_at:null}, pricing_option:{id:'price-a',price:250,currency:'USD',price_type:'per_person'} };
test('optional selections use the linked tour rate and preserve requested order', () => {
 const rows = optionalActivitySnapshots('tour-a',['walk','balloon'],[link,{...link,additional_cost:false,activity:{...link.activity,id:'walk',name:'Nature walk'}}]);
 assert.deepEqual(rows.map(row => row.name),['Nature walk','Balloon safari']);
 assert.equal(rows[0].price,null);assert.equal(rows[1].price,250);assert.equal(rows[1].pricing_option_id,'price-a');
});
test('included, unpublished, deleted and other-tour activities are rejected', () => {
 for (const row of [{...link,is_optional:false},{...link,activity:{...link.activity,status:'draft'}},{...link,activity:{...link.activity,deleted_at:'today'}},{...link,tour:{...link.tour,id:'tour-b'}},{...link,tour:{...link.tour,status:'draft'}}]) assert.throws(() => optionalActivitySnapshots('tour-a',['balloon'],[row]));
});
test('general inquiries never promise a specific tour rate', () => {
 const row = optionalActivitySnapshots(null,['balloon'],[link])[0];assert.equal(row.price,null);assert.equal(row.pricing_option_id,null);assert.equal(row.additional_cost,true);
});
test('removed selections and duplicate IDs fail instead of silently disappearing', () => {
 assert.throws(() => optionalActivitySnapshots('tour-a',['missing'],[link]));assert.throws(() => optionalActivitySnapshots('tour-a',['balloon','balloon'],[link]));
});
