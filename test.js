'use strict';
const fs = require('fs');
const Runner = require('./index');

const files = fs.readdirSync('/Users/gregg/src/webgl-fundamentals/out/webgl').filter(v => v.endsWith('.html'));

const options = {
  dir: '/Users/gregg/src/webgl-fundamentals/out',
  port: 8080,
  urls: files.map(v => `http://localhost:8080/webgl/${v}`),
};
const r = new Runner(options);
r.on('load', (e) => console.log('load:', e.url));
r.on('idle', (e) => console.log('done:', e.url));
r.on('error', (e) => console.log('error:', e.url, e.type, e.error));
r.on('finish', () => {
  console.log('---done---');
  process.exit(0);
});

