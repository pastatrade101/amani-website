import type { TourActivityItem, OptionalActivitySelection } from '$lib/types/api';
import { formatPrice } from './safari-pricing.js';
export function activityCost(item: TourActivityItem): string {
 if (!item.additional_cost) return 'No additional cost';
 const price = item.pricing_option;
 return price ? `${formatPrice(Number(price.price),price.currency || 'USD')} ${price.price_type === 'upgrade' ? 'per group' : price.price_type.replaceAll('_',' ')}` : 'Price on request';
}
export function optionalQuotationAmount(item: OptionalActivitySelection, adults: number, children: number, currency: string): string {
 if (!item.additional_cost) return '0';
 if (item.price === null || item.currency !== currency || !Number.isFinite(item.price)) return '';
 const quantity = item.price_type === 'per_person' ? adults + children : item.price_type === 'per_child' ? children : 1;
 if (quantity <= 0) return '';
 return (Math.round(item.price * Math.max(0,quantity) * 100) / 100).toString();
}
