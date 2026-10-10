/** Tour endpoints are CMS links; legacy labels are read-only compatibility fields. */
export const tripPointColumns = 'id,name,slug,role,gateway_type,airport_code,destination_id,transfer_info,status,deleted_at';
export const tripPointEmbeds = `start_point:trip_points!tours_start_trip_point_id_fkey(${tripPointColumns}),end_point:trip_points!tours_end_trip_point_id_fkey(${tripPointColumns})`;
type Row = Record<string, any>;

export function tripPointProblem(tour: Row, points: Row[]): string | null {
  for (const side of ['start', 'end']) {
    const id = tour[`${side}_trip_point_id`];
    if (!id) {
      if (tour.status === 'published') return `Select a ${side} point from Trip Points before publishing this tour.`;
      continue;
    }
    const point = points.find((item) => item.id === id);
    if (!point || point.deleted_at || point.status === 'archived') return `The selected ${side} point is unavailable. Choose another Trip Point.`;
    if (point.role !== side && point.role !== 'both') return `The selected point cannot be used as a ${side} point.`;
    if (tour.status === 'published' && point.status !== 'published') return `Publish the selected ${side} point in Trip Points before publishing this tour.`;
  }
  return null;
}

export function normaliseTourTripPoints(tour: Row, staff = true): Row {
  for (const side of ['start', 'end']) {
    const point = tour[`${side}_point`];
    const visible = point && !point.deleted_at && point.status !== 'archived' && (staff || point.status === 'published');
    tour[`${side}_point`] = visible ? point : null;
    tour[`${side}_location`] = visible ? point.name : null;
  }
  if (Array.isArray(tour.itinerary_days)) {
    const days = [...tour.itinerary_days].sort((a, b) => Number(a.day_number) - Number(b.day_number));
    tour.itinerary_days = days.map((day, index) => ({
      ...day,
      start_point: index === 0 ? tour.start_point : null,
      end_point: index === days.length - 1 ? tour.end_point : null
    }));
  }
  return tour;
}
