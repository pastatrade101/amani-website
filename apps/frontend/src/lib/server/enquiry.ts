import { fail, type RequestEvent } from '@sveltejs/kit';
import { apiRequest, ApiError } from '$lib/server/api';

export type EnquiryValues = { full_name: string; email: string; phone: string; message: string; travel_date: string; travelers: string; interest: string };

/**
 * The "enquire" form action, shared by every page that shows the enquiry form
 * (home, tour pages). Returns { success, message, values } for the form to show.
 */
export async function enquire({ request, fetch, getClientAddress }: RequestEvent) {
	const data = await request.formData();
	const value = (key: string) => String(data.get(key) ?? '').trim();
	const values: EnquiryValues = { full_name: value('full_name'), email: value('email'), phone: value('phone'), message: value('message'), travel_date: value('travel_date'), travelers: value('travelers'), interest: value('interest') };
	if (value('website')) return fail(400, { success: false, message: 'Unable to send this enquiry.', values });
	if (values.full_name.length < 2 || values.full_name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 254 || values.message.length < 10 || values.message.length > 5000 || values.interest.length > 200 || values.phone.length > 50) {
		return fail(400, { success: false, message: 'Please enter your name, a valid email, and a message of 10–5,000 characters.', values });
	}
	if (!/^([1-9]|1[0-9]|20)$/.test(values.travelers) || (values.travel_date && (!/^\d{4}-\d{2}-\d{2}$/.test(values.travel_date) || !Number.isFinite(Date.parse(values.travel_date)) || new Date(values.travel_date).toISOString().slice(0, 10) !== values.travel_date))) {
		return fail(400, { success: false, message: 'Please check your travel date and number of travelers.', values });
	}
	// The contact table has no date/traveler columns. Store trip preferences in message.
	const preferences = [`Travel date: ${values.travel_date || 'Flexible'}`, `Travelers: ${values.travelers}`, `Interest: ${values.interest || 'Tanzania safari'}`].join('\n');
	try {
		await apiRequest('contact', fetch, {
			method: 'POST', headers: { 'X-Forwarded-For': getClientAddress() },
			body: JSON.stringify({ full_name: values.full_name, email: values.email, phone: values.phone || null, subject: `Safari enquiry: ${values.interest || 'Tanzania'}`, message: `${values.message}\n\n${preferences}` })
		});
		return { success: true, message: 'Thank you! Your enquiry has been received. Our team will be in touch.', values: null };
	} catch (error) {
		return fail(error instanceof ApiError && error.status === 429 ? 429 : 503, { success: false, message: error instanceof ApiError && error.status === 429 ? 'Please wait a few minutes before sending another enquiry.' : 'We couldn’t send your enquiry right now. Your details are still here; please try again shortly.', values });
	}
}
