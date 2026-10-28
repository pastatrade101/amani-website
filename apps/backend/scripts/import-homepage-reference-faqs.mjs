/** Add the supplied homepage FAQs to the existing CMS library. Dry-run by default.
 * Run: node apps/backend/scripts/import-homepage-reference-faqs.mjs --apply
 * Existing questions (including drafts) are preserved, never overwritten.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Backend Supabase configuration is required.');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const rows=JSON.parse(readFileSync(new URL('./homepage-reference-faqs.json',import.meta.url),'utf8'));
const {data:existing,error}=await db.from('faqs').select('question').is('deleted_at',null);
if(error)throw new Error('Could not read existing FAQs. No changes made.');
const known=new Set(existing.map(row=>row.question.trim().toLowerCase()));
const pending=rows.filter(row=>!known.has(row.question.trim().toLowerCase()));
if(!process.argv.includes('--apply')){console.log(`${pending.length} new FAQs ready; pass --apply to import.`);process.exit(0);}
let added=0;
for(const row of pending){
 const {data:created,error:insertError}=await db.from('faqs').insert(row).select('id').single();
 if(insertError)throw new Error(`FAQ insert failed after ${added} successful imports.`);
 const {error:placementError}=await db.rpc('set_faq_placements',{p_faq_id:created.id,p_home:true,p_category_ids:[],p_tour_ids:[],p_destination_ids:[]});
 if(placementError){
  await db.from('faqs').delete().eq('id',created.id);
  throw new Error(`Homepage placement failed after ${added} imports; the unplaced new FAQ was rolled back.`);
 }
 added++;
}
console.log(`Imported ${added} FAQs into the homepage CMS. ${rows.length-pending.length} existing questions preserved.`);
