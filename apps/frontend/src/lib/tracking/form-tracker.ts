import { trackEvent, type AnalyticsEventName, type EventMeta, type GoogleExtras } from '$lib/admin/analytics';

export type FormTrackerContext = { form_name: string; form_type?: string; lead_type: string };

/**
 * One tracker per form on the page. It records the form's whole path (seen,
 * first answer, each step passed, what stopped a step, where it was left, and
 * the lead) under one form_name, so reports show where people drop out. Each
 * milestone fires once per page view (steps once per step), so going back and
 * forward does not inflate the counts. Fields are reported by key, never value.
 *
 * `submitEvent` is the lead event: plan_my_trip_submitted reaches Google as
 * generate_lead with lead_source set to the form's lead_type.
 */
export function createFormTracker(context: FormTrackerContext, submitEvent: AnalyticsEventName = 'form_submitted') {
	let opened = false;
	let started = false;
	let sent = false;
	/**
	 * Hidden is not gone: switching tabs or apps hides the page, and on phones
	 * it is often the last signal before the browser discards it. So an abandon
	 * is reported on hide, once per place in the form: it re-arms only when the
	 * visitor moves on, so flicking between tabs does not repeat it.
	 */
	let abandoned = false;
	let last: { index: number; key: string } | null = null;
	const passed = new Set<number>();
	const base = (): EventMeta => ({ ...context });

	const onLeave = () => {
		if (!started || sent || abandoned) return;
		abandoned = true;
		trackEvent('form_abandoned', { ...base(), step_index: last?.index ?? 0, step_key: last?.key ?? 'start' });
	};

	return {
		/** The form came into view (or its page opened). */
		opened() {
			if (opened) return;
			opened = true;
			trackEvent('form_opened', base());
		},
		/** The visitor's first answer. Prefilled answers do not count. */
		started() {
			if (started) return;
			started = true;
			abandoned = false;
			this.opened();
			trackEvent('form_started', base());
		},
		/** Where the visitor is, for the abandon event. */
		at(index: number, key: string) {
			if (last?.index !== index) abandoned = false;
			last = { index, key };
		},
		/** A step was answered and passed. */
		step(index: number, key: string) {
			this.started();
			if (passed.has(index)) return;
			passed.add(index);
			trackEvent('form_step_completed', { ...base(), step_index: index, step_key: key });
		},
		/** A step refused to move on; the first field at fault, by its key. */
		invalid(stepKey: string, field: string) {
			trackEvent('form_validation_error', { ...base(), step_key: stepKey, field_name: field, error_type: 'required_or_invalid' });
		},
		/** The server confirmed the lead. `google` carries Google-only extras such as campaign tags. */
		submitted(extra: EventMeta = {}, google: GoogleExtras = {}) {
			if (sent) return;
			sent = true;
			trackEvent(submitEvent, { ...base(), ...extra }, google);
		},
		/** The request failed on its way to us. */
		failed(errorType: 'server_validation' | 'rate_limited' | 'submit_failed' = 'submit_failed') {
			trackEvent('form_submit_error', { ...base(), error_type: errorType });
		},
		/** Report an unfinished form when the visitor leaves. Returns the cleanup for onMount. */
		watchLeave(): () => void {
			if (typeof window === 'undefined') return () => {};
			const visibility = () => {
				if (document.visibilityState === 'hidden') onLeave();
			};
			const shown = (event: PageTransitionEvent) => {
				if (event.persisted) abandoned = false; // restored from the back/forward cache
			};
			window.addEventListener('pagehide', onLeave);
			window.addEventListener('pageshow', shown);
			document.addEventListener('visibilitychange', visibility);
			return () => {
				// An in-site navigation away also counts as leaving.
				onLeave();
				window.removeEventListener('pagehide', onLeave);
				window.removeEventListener('pageshow', shown);
				document.removeEventListener('visibilitychange', visibility);
			};
		}
	};
}

export type FormTracker = ReturnType<typeof createFormTracker>;
