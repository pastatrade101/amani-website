import { supabase } from '../config/supabase';
import { AppError } from '../utils/api-response';
import { tripPointColumns, tripPointProblem } from '../utils/tour-trip-points';

export async function validateTourTripPoints(payload: Record<string, unknown>, previous: Record<string, unknown> = {}) {
  const tour = { ...previous, ...payload };
  const ids = [...new Set([tour.start_trip_point_id, tour.end_trip_point_id].filter(Boolean))] as string[];
  const { data, error } = ids.length
    ? await supabase.from('trip_points').select(tripPointColumns).in('id', ids)
    : { data: [], error: null };
  if (error) throw new AppError('Unable to validate the trip points.', 500, [error]);
  const problem = tripPointProblem(tour, data ?? []);
  if (problem) throw new AppError(problem, 422);
}

/** CSV names may reference existing CMS records, but never create free-text endpoints. */
export async function resolveImportedTripPoint(value: string, side: 'start' | 'end'): Promise<string> {
  const needle = value.trim().toLowerCase();
  const { data, error } = await supabase.from('trip_points').select(tripPointColumns).is('deleted_at', null).neq('status', 'archived');
  if (error) throw new AppError('Unable to read Trip Points for this import.', 500, [error]);
  const matches = (data ?? []).filter((point) =>
    (point.role === side || point.role === 'both') &&
    [point.id, point.slug, point.name, point.airport_code].some((candidate) => String(candidate ?? '').trim().toLowerCase() === needle));
  if (matches.length !== 1) throw new AppError(`The ${side} point "${value}" must match one existing Trip Point. Use its UUID or add it in Trip Points first.`, 422);
  return matches[0].id;
}
