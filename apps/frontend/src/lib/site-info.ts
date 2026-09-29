export const siteInfo = {
	brand: 'Key2africa Safaris',
	company: 'Key2africa Tours and Safaris ltd',
	description: 'Explore Tanzania with Key2africa Tours and Safaris ltd. Discover private safaris, the Serengeti, Ngorongoro and Zanzibar journeys planned around you.'
} as const;

export function websiteSchema(origin: string) {
	const url = new URL('/', origin).href;
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{ '@type': 'WebSite', '@id': `${url}#website`, url, name: siteInfo.company, alternateName: siteInfo.brand, publisher: { '@id': `${url}#organization` } },
			{ '@type': 'Organization', '@id': `${url}#organization`, url, name: siteInfo.company, legalName: siteInfo.company, alternateName: siteInfo.brand }
		]
	};
}
