import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinationGuide, destinationHref, destinationImage, filterDestinations } from './destination-content';
test('destination guides accept legacy imports and every CMS block shape without executing HTML',()=>{
  const blocks=destinationGuide([{title:'At a glance',items:[{title:'Region',body:'North'}]},{type:'facts',items:[{label:'Best for',value:'Wildlife'}]},{type:'faq',items:[{q:'When?',a:'In June'}]},{type:'richtext',heading:'The story',body:'<p>CMS copy</p>'},{type:'photo',url:'javascript:alert(1)'},{type:'table',columns:['Place'],rows:[['Serengeti']]},null]);
  assert.equal(blocks[0].type,'facts');assert.deepEqual(blocks[1].items,[{title:'Best for',body:'Wildlife'}]);assert.equal(blocks[2].items[0].title,'When?');assert.equal(blocks[3].title,'The story');assert.equal(blocks[4].url,'');assert.deepEqual(blocks[5].rows,[['Serengeti']]);
});
test('destination filters combine country, region and text and ignore invalid circuits',()=>{
  const items=[{id:'1',name:'Serengeti',slug:'serengeti',country:'Tanzania'},{id:'2',name:'Zanzibar',slug:'zanzibar',country:'Tanzania'},{id:'3',name:'Mara',slug:'mara',country:'Kenya'}];
  assert.deepEqual(filterDestinations(items,new URLSearchParams('country=Tanzania&circuit=northern&search=ser')).items,[items[0]]);
  assert.equal(filterDestinations(items,new URLSearchParams('circuit=invalid')).items.length,3);
  assert.equal(filterDestinations(items,new URLSearchParams('search=unmatched')).items.length,0);
});
test('destination links encode slugs and image-less records do not borrow unrelated photos',()=>{
  assert.equal(destinationHref({slug:'a/b'}),'/destinations/a%2Fb');
  assert.equal(destinationImage({id:'1',name:'Place',slug:'place'}),'');
});

test('Serengeti subregions remain in the Northern Circuit',()=>{
  const places=[{id:'1',name:'Western Serengeti',slug:'western-serengeti'},{id:'2',name:'Ndutu / Southern Serengeti',slug:'ndutu-southern-serengeti'}];
  assert.equal(filterDestinations(places,new URLSearchParams('circuit=northern')).items.length,2);
  assert.equal(filterDestinations(places,new URLSearchParams('circuit=southern')).items.length,0);
});
