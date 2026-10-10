// Passerelle locale qui imite l'URL d'un projet Supabase pour la pile de test :
//   /rest/v1/*     -> PostgREST local
//   /storage/v1/*  -> stockage en mémoire (photos d'invité surprise)
//   /realtime/v1/* -> refusé proprement (l'application vit sans temps réel)
// Usage : node scripts/qa-stack/gateway.mjs (variables QA_GATEWAY_PORT, QA_PGRST_PORT)
import http from 'node:http';

const PORT = Number(process.env.QA_GATEWAY_PORT || 54321);
const PGRST = Number(process.env.QA_PGRST_PORT || 54330);
const files = new Map();
// Image JPEG 1x1 servie pour toute photo absente (données de test).
const PIXEL = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

function body(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/rest/v1')) {
    const headers = { ...req.headers, host: '127.0.0.1:' + PGRST };
    const proxied = http.request(
      { host: '127.0.0.1', port: PGRST, method: req.method, path: url.pathname.slice('/rest/v1'.length) + url.search, headers },
      (up) => {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
      }
    );
    proxied.on('error', () => { res.writeHead(502); res.end('postgrest down'); });
    req.pipe(proxied);
    return;
  }
  if (url.pathname.startsWith('/storage/v1/object/sign/')) {
    const payload = JSON.parse((await body(req)).toString() || '{}');
    const bucket = url.pathname.split('/')[5];
    const list = (payload.paths || []).map((path) => ({ path, error: null, signedURL: `/object/public/${bucket}/${path}` }));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload.paths ? list : { signedURL: `/object/public/${bucket}/x` }));
    return;
  }
  if (url.pathname.startsWith('/storage/v1/object/public/')) {
    const key = url.pathname.replace('/storage/v1/object/public/', '');
    res.writeHead(200, { 'content-type': 'image/jpeg' });
    res.end(files.get(key) || PIXEL);
    return;
  }
  if (url.pathname.startsWith('/storage/v1/object/')) {
    const key = url.pathname.replace('/storage/v1/object/', '');
    if (req.method === 'DELETE') {
      const payload = JSON.parse((await body(req)).toString() || '{}');
      for (const p of payload.prefixes || []) files.delete(key + '/' + p);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('[]');
      return;
    }
    files.set(key, await body(req));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ Key: key }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{"message":"non simulé par la passerelle de test"}');
});
server.on('upgrade', (_req, socket) => socket.destroy());
server.listen(PORT, () => console.log('passerelle de test sur http://localhost:' + PORT));
