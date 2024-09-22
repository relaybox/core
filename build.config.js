const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: 'build/server.js',
    external: ['uWebSockets.js', './*.node'],
    plugins: [],
    minify: true
  })
  .catch(() => process.exit(1));
