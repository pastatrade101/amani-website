import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

// This API stub never connects to Supabase, sends email, or writes real contacts.
test('built frontend matches the Express contracts and fails safely', { timeout: 30000 }, async () => {
  const calls = [];
  const contacts = [];
  const adminRequests = [];
  let unavailable = false;
  let rejectContact = false;
  const id = '0de809b1-15ac-4111-b805-5bc25910c0ae';
  const page = (items) => ({ items, pagination: { page: 1, limit: 12, total: items.length, totalPages: 1 } });
  const api = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    calls.push(url);
    res.setHeader('Content-Type', 'application/json');
    if (unavailable || (url.pathname === '/api/contact' && rejectContact)) {
      res.writeHead(503).end(JSON.stringify({ success: false, message: 'Test API unavailable' }));
      return;
    }
    let data;
    if (url.pathname.startsWith('/api/auth/') || url.pathname === '/api/dashboard/stats') {
      let body = '';
      for await (const chunk of req) body += chunk;
      adminRequests.push({ path: url.pathname, authorization: req.headers.authorization, forwarded: req.headers['x-forwarded-for'], body });
      if (url.pathname === '/api/auth/login') {
        const credentials = JSON.parse(body);
        if (credentials.email !== 'test@example.invalid' || credentials.password !== 'fixture-password-only') {
          res.writeHead(401).end(JSON.stringify({success:false,message:'Invalid credentials'})); return;
        }
        data = {token:'fixture-token',user:{name:'Test admin',role:'super_admin'}};
      } else if (req.headers.authorization !== 'Bearer fixture-token') {
        res.writeHead(401).end(JSON.stringify({success:false,message:'Authentication required'})); return;
      } else data = {name:'Test admin',role:'super_admin'};
      res.end(JSON.stringify({success:true,message:'OK',data})); return;
    }
    if (url.pathname === '/api/homepage') data = [{ section_key: 'hero', title: 'Live Tanzania Adventures' }, { section_key: 'when_to_go', is_active: false }];
    else if (url.pathname === '/api/destinations') data = page([{ id, name: 'Live Serengeti', slug: 'serengeti', country: 'Tanzania' }]);
    else if (url.pathname === '/api/activities') data = page([]);
    else if (url.pathname === '/api/categories') data = page([{ id, name: 'Private Safaris', slug: 'private' }]);
    else if (url.pathname === '/api/tours') data = page(url.searchParams.get('search') === 'no match' ? [] : [{ id, title: 'Live API Safari', slug: 'live-safari', duration_days: 5, price_from: 900, currency: 'USD', main_image_url: '/images/serengeti.jpg' }]);
    else if (url.pathname === '/api/contact' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      contacts.push(JSON.parse(body));
      data = { id: 'test-contact', ...contacts.at(-1) };
      res.statusCode = 201;
    } else { res.writeHead(404).end('{}'); return; }
    res.end(JSON.stringify({ success: true, message: 'OK', data }));
  });
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  let logs = '';
  const child = spawn(process.execPath, ['build'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), ORIGIN: origin, API_BASE_URL: `http://127.0.0.1:${api.address().port}/api` },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (data) => logs += data);
  child.stderr.on('data', (data) => logs += data);
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* starting */ }
      await delay(100);
    }
    assert.ok(ready, logs);
    const html = await (await fetch(origin)).text();
    assert.ok(html.includes('Live Tanzania Adventures'));
    assert.ok(html.includes('<title>Live Tanzania Adventures | Key2africa Tours and Safaris ltd</title>'));
    assert.ok(html.includes('Key2africa Safaris home'));
    assert.ok(!html.includes('Amani Safaris'));
    const schemaMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(schemaMatch, 'Search metadata is server-rendered');
    const schema = JSON.parse(schemaMatch[1]);
    assert.equal(schema['@graph'][0].name, 'Key2africa Tours and Safaris ltd');
    assert.equal(schema['@graph'][0].url, `${origin}/`);
    assert.equal(schema['@graph'][1].legalName, 'Key2africa Tours and Safaris ltd');
    assert.ok(!/<[^>]*data-motion=[^>]*style="[^"]*opacity:\s*0/.test(html), 'Content remains visible without JavaScript');
    assert.ok(html.includes('Live API Safari'));
    assert.ok(html.includes('$900'));
    assert.ok(!html.includes('id="when-to-go"'), 'Disabled CMS section stays hidden');
    assert.ok(!html.includes('Explore Great Migration'), 'Empty published activities do not repopulate with reference fixtures');

    await fetch(`${origin}/?search=no+match&destination_id=${id}&category_id=${id}&status=all&from=2026-12-01`);
    const searchCall = calls.filter((url) => url.pathname === '/api/tours').at(-1);
    assert.equal(searchCall.searchParams.get('status'), 'published');
    assert.equal(searchCall.searchParams.get('destination_id'), id);
    assert.equal(searchCall.searchParams.get('category_id'), id);
    assert.equal(searchCall.searchParams.has('from'), false);
    const noMatch = await (await fetch(`${origin}/?search=no+match`)).text();
    assert.ok(noMatch.includes('No safaris match your search yet'));

    const fields = { full_name: 'Test Traveler', email: 'test@example.invalid', phone: '', message: 'A private safari for our local test.', travel_date: '2026-12-01', travelers: '2', interest: 'Serengeti', website: '' };
    const submit = (values) => fetch(`${origin}/?/enquire`, { method: 'POST', headers: { Origin: origin, Accept: 'application/json', 'x-sveltekit-action': 'true' }, body: new URLSearchParams(values) });
    const success = await (await submit(fields)).json();
    assert.equal(success.type, 'success');
    assert.equal(contacts.length, 1);
    assert.deepEqual(Object.keys(contacts[0]).sort(), ['email', 'full_name', 'message', 'phone', 'subject']);
    assert.ok(contacts[0].message.includes('Travelers: 2'));
    assert.ok(contacts[0].message.includes('Travel date: 2026-12-01'));
    assert.equal((await (await submit({ ...fields, travel_date: '2026-99-99' })).json()).status, 400);
    assert.equal((await (await submit({ ...fields, website: 'bot' })).json()).status, 400);
    assert.equal(contacts.length, 1);
    rejectContact = true;
    const failed = await (await submit(fields)).json();
    assert.equal(failed.type, 'failure');
    assert.equal(failed.status, 503);
    assert.ok(failed.data.includes('test@example.invalid'), 'Failed enquiry keeps form values');
    assert.equal(contacts.length, 1);

    // Admin pages are registered and private APIs retain backend authentication.
    const adminPage = await (await fetch(`${origin}/admin`)).text();
    assert.ok(adminPage.includes('Checking your session'));
    assert.ok(adminPage.includes('noindex, nofollow'));
    const loginPage = await (await fetch(`${origin}/admin/login`)).text();
    assert.ok(loginPage.includes('Sign in'));
    assert.ok(!loginPage.includes('ADMIN_PASSWORD'));
    assert.equal((await fetch(`${origin}/api/auth/me`)).status, 401);
    const login = await fetch(`${origin}/api/auth/login`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'test@example.invalid',password:'fixture-password-only'})});
    assert.equal(login.status,200);
    assert.equal(login.headers.get('cache-control'),'no-store');
    assert.equal((await login.json()).data.token,'fixture-token');
    const authenticated = await fetch(`${origin}/api/dashboard/stats`, {headers:{authorization:'Bearer fixture-token','x-forwarded-for':'untrusted-client-value'}});
    assert.equal(authenticated.status,200);
    assert.equal(adminRequests.at(-1).authorization,'Bearer fixture-token');
    assert.notEqual(adminRequests.at(-1).forwarded,'untrusted-client-value');
    assert.equal((await fetch(`${origin}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'wrong@example.invalid',password:'wrong'})})).status,401);

    unavailable = true;
    const fallback = await (await fetch(origin)).text();
    assert.ok(fallback.includes('Tanzania Safari Tours'));
    assert.ok(fallback.includes('Explore Great Migration'));
    assert.ok(!fallback.includes('$900'), 'No fabricated price when API is unavailable');
    const alias = await fetch(`${origin}/tanzania-safari?search=lion`, { redirect: 'manual' });
    assert.equal(alias.status, 308);
    assert.equal(alias.headers.get('location'), '/?search=lion');
  } finally {
    child.kill('SIGTERM');
    await once(child, 'exit');
    await new Promise((resolve) => api.close(resolve));
  }
});
