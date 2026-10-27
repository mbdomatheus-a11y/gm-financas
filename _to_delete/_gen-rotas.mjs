import { Generator, getConfig } from '@tanstack/router-generator';
const config = getConfig({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts', target: 'react' }, process.cwd());
const g = new Generator({ config, root: process.cwd() });
await g.run();
console.log('ok');
