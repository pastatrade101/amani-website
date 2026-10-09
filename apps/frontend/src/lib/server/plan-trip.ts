import { fail, type RequestEvent } from '@sveltejs/kit';
import { apiRequest, ApiError } from '$lib/server/api';
import { checkContact, cleanNotes, composeMessage, composeSubject, parsePlan, planReference, recapRows } from '$lib/planner/compose';

// Dates a day behind UTC are still "today" somewhere the visitor may be.
const earliestDay = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

/**
 * The "plan" action on /plan-my-trip. Sends the answers through the same
 * enquiry pipeline as the enquiry form (POST /api/contact), so a trip plan
 * reaches the same inbox, emails and /admin/messages list.
 * Returns { success, reference, recap } or fail(…, { success, message, field? }).
 */
export async function planTrip({ request, fetch, getClientAddress }: RequestEvent) {
	const data = await request.formData();
	const value = (key: string) => String(data.get(key) ?? '').trim();
	if (value('company_website')) return fail(400, { success: false, message: 'Unable to send this request.' });
	const answers = parsePlan(String(data.get('plan') ?? ''), earliestDay());
	if (!answers) return fail(400, { success: false, message: 'Something went wrong with your answers. Please check them and try again.' });
	const contact = checkContact({ full_name: value('full_name'), email: value('email'), dial_code: value('dial_code'), phone: value('phone') }, answers.contact);
	if (!contact.ok) return fail(400, { success: false, message: contact.message, field: contact.field });
	// One key per page load: a repeat of the same request carries the same reference.
	const reference = planReference(value('request_key')) ?? planReference(crypto.randomUUID())!;
	try {
		await apiRequest('contact', fetch, {
			method: 'POST', headers: { 'X-Forwarded-For': getClientAddress() },
			body: JSON.stringify({
				full_name: contact.full_name, email: contact.email, phone: contact.phone,
				subject: composeSubject(answers, reference),
				message: composeMessage(answers, reference, cleanNotes(data.get('notes'))),
				source: 'plan_my_trip', reference
			})
		});
		return { success: true, reference, recap: recapRows(answers) };
	} catch (error) {
		const status = error instanceof ApiError ? error.status : 0;
		// 428 is the backend asking for a captcha after several sends; the planner has none, so it reads as "wait".
		if (status === 429 || status === 428) return fail(429, { success: false, message: 'Please wait a few minutes before sending another request.' });
		if (status === 400 || status === 422) return fail(400, { success: false, message: 'Please check your details and try again.' });
		return fail(503, { success: false, message: 'We couldn’t send your plan right now. Your answers are still here; please try again shortly.' });
	}
}
