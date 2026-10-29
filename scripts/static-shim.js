// Proof of Life, public read-only copy (made by scripts/build-public-site.mjs).
// The page talks to /api/* as if a local server were there; this answers from
// the snapshot in ./api/, refuses every write, and checks signatures right here
// in the browser with WebCrypto Ed25519 against the signer's public key.
(function () {
  const real = window.fetch.bind(window);
  const FILES = { '/api/state': 'api/state.json', '/api/board': 'api/board.json', '/api/bestiary': 'api/bestiary.json', '/api/pubkey': 'api/pubkey.json', '/api/version': 'api/version.json', '/api/profile': 'api/profile.json' };
  const reply = (body, status) => new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
  let keyP = null, byIdP = null;
  const key = () => keyP || (keyP = real('api/pubkey.json').then((r) => r.json()).then((p) => {
    const b64 = p.publicKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    return crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']).then((k) => ({ k, fp: p.fingerprint }));
  }));
  const byId = () => byIdP || (byIdP = real('api/state.json').then((r) => r.json()).then((s) => new Map(s.creatures.map((c) => [c.id, c]))));
  // the exact message server.js creaturePayload() signs, key order included
  function payload(c) {
    const p = { op: c.op || null, id: c.id, dur: c.durationMs, dom: c.domainKey, err: !!c.error, tier: c.rarity.tier, seed: c.seed, born: c.bornAt };
    if (c.toolCalls != null) p.calls = c.toolCalls;
    if (c.actHash) p.act = c.actHash;
    if (c.ruleVersion != null) p.ruleVersion = c.ruleVersion;
    return JSON.stringify(p);
  }
  async function verify(id) {
    const c = (await byId()).get(id);
    if (!c || !c.att) return { valid: false, reason: c ? 'no attestation' : 'not found' };
    if (c.bredBy) return { valid: false, reason: 'hybrids are checked on the owner\'s machine' };
    try {
      const { k, fp } = await key();
      const sig = Uint8Array.from(atob(c.att.sig), (ch) => ch.charCodeAt(0));
      const ok = await crypto.subtle.verify({ name: 'Ed25519' }, k, sig, new TextEncoder().encode(payload(c)));
      return { valid: ok, fp: c.att.fp, alg: c.att.alg, signer: fp, where: 'checked in your browser' };
    } catch (e) { return { valid: false, reason: 'this browser cannot check Ed25519 (' + e.message + ')' }; }
  }
  window.POL_PUBLIC = true;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input.url;
    const u = new URL(url, location.href);
    const p = u.pathname.replace(/^.*?(\/api\/)/, '/api/');
    if (!/\/api\//.test(u.pathname)) return real(input, init);
    if (init && init.method && init.method.toUpperCase() !== 'GET') return reply({ error: 'This is a read-only public copy.' }, 403);
    if (p === '/api/verify') return reply(await verify(u.searchParams.get('id')));
    if (FILES[p]) return real(FILES[p]);
    return reply({ error: 'not in the public copy' }, 404);
  };
})();
