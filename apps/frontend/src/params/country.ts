import type { ParamMatcher } from '@sveltejs/kit';
import { countryFromSlug } from '$lib/countries';

/** /destinations/kenya is a country page; any other slug stays a place page. */
export const match: ParamMatcher = (param) => countryFromSlug(param) !== null;
