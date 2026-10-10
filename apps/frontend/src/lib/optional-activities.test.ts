import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optionalQuotationAmount } from './optional-activities.js';
const activity = {activity_id:'balloon',name:'Balloon',additional_cost:true,price:250,currency:'USD',price_type:'per_person',pricing_option_id:'rate'};
test('quotation add-ons respect per-person, per-child and per-group charges', () => {
 assert.equal(optionalQuotationAmount(activity,2,1,'USD'),'750');
 assert.equal(optionalQuotationAmount({...activity,price_type:'per_child'},2,1,'USD'),'250');
 assert.equal(optionalQuotationAmount({...activity,price_type:'per_group'},2,1,'USD'),'250');
});
test('unpriced and different-currency add-ons require an administrator-confirmed amount', () => {
 assert.equal(optionalQuotationAmount({...activity,price:null},2,0,'USD'),'');
 assert.equal(optionalQuotationAmount(activity,2,0,'EUR'),'');
 assert.equal(optionalQuotationAmount({...activity,additional_cost:false},2,0,'EUR'),'0');
});
