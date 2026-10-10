import { fail, type RequestEvent } from '@sveltejs/kit';
import type { TourDetail } from '$lib/types/api';
import { apiGet, apiRequest, ApiError } from '$lib/server/api';

export type EnquiryValues = { full_name: string; email: string; phone: string; message: string; travel_date: string; travelers: string; interest: string; optional_activity_ids: string[] };

/**
 * The "enquire" form action, shared by every page that shows the enquiry form
 * (home, tour pages). Returns { success, message, values } for the form to show.
 */
export async function enquire({ request, fetch, getClientAddress, params, url }: RequestEvent) {
	const data = await request.formData();
	const value = (key: string) => String(data.get(key) ?? '').trim();
	const values: EnquiryValues = { full_name: value('full_name'), email: value('email'), phone: value('phone'), message: value('message'), travel_date: value('travel_date'), travelers: value('travelers'), interest: value('interest'), optional_activity_ids: [...new Set(data.getAll('optional_activity_ids').map(String))] };
	if (value('website')) return fail(400, { success: false, message: 'Unable to send this enquiry.', values });
	if (values.full_name.length < 2 || values.full_name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 254 || values.message.length < 10 || values.message.length > 5000 || values.interest.length > 200 || values.phone.length > 50) {
		return fail(400, { success: false, message: 'Please enter your name, a valid email, and a message of 10–5,000 characters.', values });
	}
	// Bookings need at least 6 characters for a phone; it stays optional.
	if (values.phone && values.phone.length < 6) return fail(400, { success: false, message: 'Please enter a phone number of at least 6 characters, or leave it blank.', values });
	if (!/^([1-9]|1[0-9]|20)$/.test(values.travelers) || (values.travel_date && (!/^\d{4}-\d{2}-\d{2}$/.test(values.travel_date) || !Number.isFinite(Date.parse(values.travel_date)) || new Date(values.travel_date).toISOString().slice(0, 10) !== values.travel_date))) {
		return fail(400, { success: false, message: 'Please check your travel date and number of travelers.', values });
	}
	if (values.optional_activity_ids.length > 50 || values.optional_activity_ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) return fail(400, { success:false, message:'Please select valid optional activities.', values });
	// Contextual inquiries belong to bookings so they can seed customized quotations.
	const preferences = [`Travel date: ${values.travel_date || 'Flexible'}`, `Travelers: ${values.travelers}`, `Interest: ${values.interest || 'Tanzania safari'}`].join('\n');
	try {
		const tour = params.slug && url.pathname.startsWith('/tours/') ? await apiGet<TourDetail>(`tours/${encodeURIComponent(params.slug)}`, fetch) : null;
        await apiRequest('bookings', fetch, {
            method:'POST', headers:{ 'X-Forwarded-For':getClientAddress() },
            body:JSON.stringify({tour_id:tour?.id ?? null, full_name:values.full_name,email:values.email,phone:values.phone || null,travel_date:values.travel_date || null,number_of_adults:Number(values.travelers),number_of_children:0,message:`${values.message}\n\n${preferences}`,source:tour ? 'tour_enquiry' : 'homepage_trip_planner',optional_activity_ids:values.optional_activity_ids,idempotency_key:value('idempotency_key') || undefined,lead_context:{v:1,form_type:tour ? 'tour_enquiry' : 'homepage_trip_planner',page:{url:url.href,title:tour?.title ?? 'Plan my safari'},answers:{travel_interests:values.interest}}})
        });
		return { success: true, message: 'Thank you! Your enquiry has been received. Our team will be in touch.', values: null };
	} catch (error) {
		if (error instanceof ApiError && [400,404,422].includes(error.status)) return fail(422,{success:false,message:values.optional_activity_ids.length ? 'Please check your details and refresh the optional activities; an option may no longer be available.' : 'Please check your details and try again.',values});
		// 428 is the backend asking for a captcha after several sends; this form has none, so it reads as "wait".
		const waiting = error instanceof ApiError && (error.status === 429 || error.status === 428);
		return fail(waiting ? 429 : 503, { success: false, message: waiting ? 'Please wait a few minutes before sending another enquiry.' : 'We couldn’t send your enquiry right now. Your details are still here; please try again shortly.', values });
	}
}
