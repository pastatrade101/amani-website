import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeHref, sanitizeRichText } from './tour-html.js';

test('keeps the allowed formatting tags and strips their attributes', () => {
	assert.equal(
		sanitizeRichText('<p class="x" style="color:red">Game <strong onclick="x()">drive</strong> and <em>picnic</em><br/>lunch</p><ul><li>One</li><li>Two</li></ul><ol><li>A</li></ol>'),
		'<p>Game <strong>drive</strong> and <em>picnic</em><br>lunch</p><ul><li>One</li><li>Two</li></ul><ol><li>A</li></ol>'
	);
});

test('drops script-like tags together with their content', () => {
	assert.equal(sanitizeRichText('<p>Hello</p><script>alert(1)</script><style>p{}</style><iframe src="https://x"></iframe><p>there</p>'), '<p>Hello</p><p>there</p>');
	assert.equal(sanitizeRichText('<p>Unclosed</p><script>alert(1)'), '<p>Unclosed</p>');
	assert.equal(sanitizeRichText('<svg/><p>ok</p>'), '<p>ok</p>');
});

test('drops unknown tags but keeps their text', () => {
	assert.equal(sanitizeRichText('<p><span>Big</span> <u>five</u> <img src=x onerror=alert(1)>country</p>'), '<p>Big five country</p>');
	assert.equal(sanitizeRichText('<b>Bold</b> <i>italic</i>'), '<strong>Bold</strong> <em>italic</em>');
});

test('turns headings and block wrappers into paragraphs', () => {
	assert.equal(sanitizeRichText('<h2>Arrive</h2><div>Meet your guide</div>'), '<p><strong>Arrive</strong></p><p>Meet your guide</p>');
	assert.equal(sanitizeRichText('<div><p>Nested</p></div>'), '<p>Nested</p>');
	assert.equal(sanitizeRichText('<div><ul><li>In a list</li></ul></div>'), '<ul><li>In a list</li></ul>');
});

test('links keep only safe http(s) and mailto targets, with rel="noopener"', () => {
	assert.equal(sanitizeRichText('<a href="https://example.com/a?b=1&c=2" target="_blank" onclick="x">Park</a>'), '<a href="https://example.com/a?b=1&amp;c=2" rel="noopener">Park</a>');
	assert.equal(sanitizeRichText('<a href="mailto:hello@example.com">Write</a>'), '<a href="mailto:hello@example.com" rel="noopener">Write</a>');
	assert.equal(sanitizeRichText('<a href="javascript:alert(1)">Bad</a>'), 'Bad');
	assert.equal(sanitizeRichText('<a href="jav&#x61;script:alert(1)">Hidden</a>'), 'Hidden');
	assert.equal(sanitizeRichText('<a href=" java\nscript:alert(1)">Split</a>'), 'Split');
	assert.equal(sanitizeRichText('<a href="/relative">Relative</a>'), 'Relative');
	assert.equal(sanitizeRichText('<a href="data:text/html,x">Data</a>'), 'Data');
	assert.equal(sanitizeRichText('<a>No target</a>'), 'No target');
});

test('safeHref reads single, double and unquoted values and ignores look-alike attributes', () => {
	assert.equal(safeHref(` href='https://a.example'`), 'https://a.example');
	assert.equal(safeHref(' href=https://b.example'), 'https://b.example');
	assert.equal(safeHref(' data-href="https://c.example"'), '');
	assert.equal(safeHref(' href="https:/\\evil"'), '');
});

test('output is always balanced and stray markup characters are escaped', () => {
	assert.equal(sanitizeRichText('<p><strong>Open <em>tags'), '<p><strong>Open <em>tags</em></strong></p>');
	assert.equal(sanitizeRichText('<p>a</strong> b</p></p>'), '<p>a b</p>');
	assert.equal(sanitizeRichText('<p>5 < 6 & 7 > 3 &amp; done</p>'), '<p>5 &lt; 6 &amp; 7 &gt; 3 &amp; done</p>');
	assert.equal(sanitizeRichText('<ul><li>One<li>Two</ul>'), '<ul><li>One</li><li>Two</li></ul>');
	assert.equal(sanitizeRichText('<p>Before<ul><li>x</li></ul>'), '<p>Before</p><ul><li>x</li></ul>');
});

test('comments and doctypes disappear; empty input gives an empty string', () => {
	assert.equal(sanitizeRichText('<!-- note --><!DOCTYPE html><p>Kept</p>'), '<p>Kept</p>');
	assert.equal(sanitizeRichText(''), '');
	assert.equal(sanitizeRichText(null), '');
	assert.equal(sanitizeRichText('<p> </p><p><br></p>'), '');
});

test('plain text becomes paragraphs with line breaks', () => {
	assert.equal(sanitizeRichText('Morning drive.\nAfternoon at leisure.\n\nDinner at the lodge & rest.'), '<p>Morning drive.<br>Afternoon at leisure.</p><p>Dinner at the lodge &amp; rest.</p>');
});
