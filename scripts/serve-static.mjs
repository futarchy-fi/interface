#!/usr/bin/env node

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';

const options = parseOptions(process.argv.slice(2));
const rootDir = path.resolve(process.cwd(), options.dir);
const normalizedRoot = rootDir;
const rootWithSep = normalizedRoot.endsWith(path.sep)
  ? normalizedRoot
  : `${normalizedRoot}${path.sep}`;

await ensureOutputDirectory();

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400).end('Bad Request');
      return;
    }

    if (!['GET', 'HEAD'].includes((req.method || 'GET').toUpperCase())) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method Not Allowed');
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const descriptor = await resolveFile(url.pathname);

    if (!descriptor) {
      const notFound = await load404File();
      if (notFound) {
        await sendFile(res, notFound, 404, req.method === 'HEAD');
        return;
      }

      res.writeHead(404).end('Not Found');
      return;
    }

    await sendFile(res, descriptor, 200, req.method === 'HEAD');
  } catch (error) {
    console.error('[static-serve] Unexpected error:', error);
    if (!res.headersSent) {
      res.writeHead(500).end('Internal Server Error');
      return;
    }
    res.end();
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${options.port} is already in use. Use --port to pick a different port.`);
  } else {
    console.error('Failed to start static server:', error);
  }
  process.exit(1);
});

server.listen(options.port, () => {
  console.log(`Serving static Next.js export from ${rootDir}`);
  console.log(`➡  http://localhost:${options.port}`);
  console.log('Press Ctrl+C to stop.');
});

function parseOptions(argv) {
  const parsed = {
    dir: 'out',
    port: Number(process.env.PORT) || 3000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--dir' || arg === '-d') {
      if (argv[i + 1]) {
        parsed.dir = argv[i + 1];
        i += 1;
      }
      continue;
    }

    if (arg?.startsWith('--dir=')) {
      parsed.dir = arg.slice(6);
      continue;
    }

    if (arg === '--port' || arg === '-p') {
      if (argv[i + 1]) {
        const nextValue = Number(argv[i + 1]);
        if (!Number.isNaN(nextValue)) {
          parsed.port = nextValue;
        }
        i += 1;
      }
      continue;
    }

    if (arg?.startsWith('--port=')) {
      const numericValue = Number(arg.slice(7));
      if (!Number.isNaN(numericValue)) {
        parsed.port = numericValue;
      }
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    console.warn(`Ignoring unknown option "${arg}".`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/serve-static.mjs [options]

Options:
  -d, --dir <path>   Directory that contains the exported site (default: out)
  -p, --port <port>  Port to bind on (default: 3000 or $PORT)
  -h, --help         Show this help message
`);
}

async function ensureOutputDirectory() {
  try {
    const stats = await stat(rootDir);
    if (!stats.isDirectory()) {
      console.error(`Expected ${rootDir} to be a directory. Run "npm run build" first.`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Static output directory (${rootDir}) is missing. Run "npm run build" before serving.`);
    process.exit(1);
  }
}

async function resolveFile(urlPath) {
  const sanitized = sanitizePath(urlPath);
  const candidates = buildCandidates(sanitized, urlPath.endsWith('/'));

  for (const relative of candidates) {
    const absolute = resolveWithinRoot(relative);
    if (!absolute) {
      continue;
    }

    try {
      const stats = await stat(absolute);
      if (stats.isFile()) {
        return { absolute, stats };
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`[static-serve] Skipping ${relative}:`, error.message);
      }
    }
  }

  return null;
}

function sanitizePath(pathname) {
  if (!pathname) {
    return '';
  }

  let clean = pathname.replace(/\\/g, '/');
  if (clean.startsWith('/')) {
    clean = clean.slice(1);
  }

  clean = clean.split('?')[0].split('#')[0];

  try {
    clean = decodeURIComponent(clean);
  } catch (error) {
    console.warn(`[static-serve] Failed to decode URI component "${clean}":`, error.message);
  }

  clean = path.posix.normalize(clean);
  if (clean === '.' || clean === './') {
    return '';
  }

  while (clean.startsWith('../')) {
    clean = clean.slice(3);
  }

  return clean;
}

function buildCandidates(relativePath, endsWithSlash) {
  const candidates = new Set();

  if (!relativePath) {
    candidates.add('index.html');
    return [...candidates];
  }

  if (endsWithSlash) {
    candidates.add(path.posix.join(relativePath, 'index.html'));
  } else {
    candidates.add(relativePath);
  }

  if (!path.posix.extname(relativePath)) {
    candidates.add(`${relativePath}.html`);
    candidates.add(path.posix.join(relativePath, 'index.html'));
  }

  return [...candidates];
}

function resolveWithinRoot(relativePath) {
  const absolute = path.resolve(rootDir, relativePath);
  if (absolute === normalizedRoot || absolute.startsWith(rootWithSep)) {
    return absolute;
  }
  return null;
}

let cached404 = undefined;

async function load404File() {
  if (cached404 !== undefined) {
    return cached404;
  }

  cached404 = await resolveFile('/404.html');
  return cached404;
}

async function sendFile(res, descriptor, statusCode, headOnly) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', getContentType(descriptor.absolute));
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('Accept-Ranges', 'bytes');

  if (descriptor.stats?.size !== undefined) {
    res.setHeader('Content-Length', descriptor.stats.size);
  }

  if (headOnly) {
    res.end();
    return;
  }

  try {
    await pipeline(createReadStream(descriptor.absolute), res);
  } catch (error) {
    console.error('[static-serve] Failed to stream file:', error);
    if (!res.headersSent) {
      res.writeHead(500).end('Internal Server Error');
    } else {
      res.end();
    }
  }
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return (
    MIME_TYPES[extension] || 'application/octet-stream'
  );
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/vnd.microsoft.icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
};
