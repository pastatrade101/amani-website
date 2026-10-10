import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normaliseTourTripPoints, tripPointProblem } from './tour-trip-points';
const start = { id: 'start', name: 'Kilimanjaro Airport', status: 'published', role: 'start' };
const end = { id: 'end', name: 'Arusha', status: 'published', role: 'end' };
const tour = { status: 'published', start_trip_point_id: 'start', end_trip_point_id: 'end' };

test('published tours require real, available points with the right role', () => {
  assert.equal(tripPointProblem(tour, [start, end]), null);
  assert.match(tripPointProblem({ ...tour, start_trip_point_id: null }, [end])!, /Select a start/);
  assert.match(tripPointProblem(tour, [start])!, /unavailable/);
  assert.match(tripPointProblem(tour, [{ ...start, role: 'end' }, end])!, /cannot be used/);
  assert.match(tripPointProblem(tour, [{ ...start, status: 'draft' }, end])!, /Publish/);
  assert.match(tripPointProblem(tour, [{ ...start, deleted_at: 'today' }, end])!, /unavailable/);
  assert.match(tripPointProblem(tour, [start, { ...end, status: 'archived' }])!, /unavailable/);
  assert.equal(tripPointProblem({ status: 'draft' }, []), null);
  assert.equal(tripPointProblem({ ...tour, status: 'draft' }, [{ ...start, status: 'draft' }, end]), null);
});

test('itinerary endpoints follow first and last day after reordering, without duplicate stored links', () => {
  const result = normaliseTourTripPoints({ start_point: start, end_point: end, start_location: 'Old label', itinerary_days: [{ day_number: 3 }, { day_number: 1 }, { day_number: 2 }] });
  assert.equal(result.start_location, start.name);
  assert.equal(result.itinerary_days[0].start_point.id, start.id);
  assert.equal(result.itinerary_days[0].end_point, null);
  assert.equal(result.itinerary_days[1].start_point, null);
  assert.equal(result.itinerary_days[2].end_point.id, end.id);
});

test('one-day trips inherit both endpoints and renamed points appear everywhere', () => {
  const renamed = { ...start, name: 'Renamed airport' };
  const result = normaliseTourTripPoints({ start_point: renamed, end_point: end, itinerary_days: [{ day_number: 1 }] });
  assert.equal(result.start_location, 'Renamed airport');
  assert.equal(result.itinerary_days[0].start_point.name, 'Renamed airport');
  assert.equal(result.itinerary_days[0].end_point.id, end.id);
});

test('unpublished or removed points never leak onto public itineraries', () => {
  const result = normaliseTourTripPoints({ start_point: { ...start, status: 'draft' }, end_point: { ...end, deleted_at: 'today' }, start_location: 'Legacy', itinerary_days: [{ day_number: 1 }] }, false);
  assert.equal(result.start_point, null);
  assert.equal(result.start_location, null);
  assert.equal(result.itinerary_days[0].end_point, null);
});
