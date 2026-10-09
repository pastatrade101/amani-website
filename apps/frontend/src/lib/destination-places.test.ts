import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coordinateError, locationLine, matchAdminArea, regionTidyUp, splitAreas } from './admin/destination-places.js';

test('an administrative area matches with or without its suffix', () => {
	assert.equal(matchAdminArea('Tanzania', 'manyara'), 'Manyara Region');
	assert.equal(matchAdminArea('Tanzania', 'Manyara Region '), 'Manyara Region');
	assert.equal(matchAdminArea('Kenya', 'Narok'), 'Narok County');
	assert.equal(matchAdminArea('Tanzania', 'Narnia'), null);
});

test('a stored location reads back into the list, or stays as typed', () => {
	assert.deepEqual(splitAreas('Tanzania', 'Mara Region, Simiyu Region'), { areas: ['Mara Region', 'Simiyu Region'], custom: '' });
	assert.deepEqual(splitAreas('Tanzania', 'Mara and Simiyu'), { areas: ['Mara Region', 'Simiyu Region'], custom: '' });
	assert.deepEqual(splitAreas('Tanzania', 'Indian Ocean, off the Tanzanian coast'), { areas: [], custom: 'Indian Ocean, off the Tanzanian coast' });
	assert.deepEqual(splitAreas('Tanzania', ''), { areas: [], custom: '' });
});

test('an area typed as the safari region is spotted, with the region it belongs to', () => {
	assert.deepEqual(regionTidyUp('Tanzania', 'Arusha'), { area: 'Arusha Region', safariRegion: 'Northern Circuit' });
	assert.deepEqual(regionTidyUp('Kenya', 'Nairobi'), null, 'Nairobi is also a Kenyan safari region, so it is left alone');
	assert.equal(regionTidyUp('Tanzania', 'Northern Circuit'), null);
	assert.equal(regionTidyUp('Tanzania', 'Somewhere else'), null);
});

test('the location line drops blanks and repeats, like the public page', () => {
	assert.equal(locationLine('Manyara Region', 'Northern Circuit', 'Tanzania'), 'Manyara Region · Northern Circuit · Tanzania');
	assert.equal(locationLine('', 'Nairobi', 'Kenya'), 'Nairobi · Kenya');
	assert.equal(locationLine('Kenya', 'Nairobi', 'Kenya'), 'Kenya · Nairobi');
});

test('coordinates must come as a valid pair', () => {
	assert.equal(coordinateError('', ''), '');
	assert.equal(coordinateError('-3.38', '36.68'), '');
	assert.match(coordinateError('-3.38', ''), /both/);
	assert.match(coordinateError('-95', '36'), /Latitude/);
	assert.match(coordinateError('-3', '200'), /Longitude/);
});
