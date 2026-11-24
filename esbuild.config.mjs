import { copyFile, readFile, readdir } from 'node:fs/promises';
import { builtinModules, createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import process from 'node:process';
import esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const viewerEntry = require.resolve('opticm/viewer');
const opticmDist = dirname(viewerEntry);
const prod = process.argv[2] === 'production';
const outputDir = 'dist/opticm-fence';
const worker = join(opticmDist, 'analysis-worker-java.min.js');
const runtime = join(opticmDist, 'web-tree-sitter.wasm');
const grammar = join(opticmDist, 'tree-sitter-java.wasm');
const stylesheet = join(opticmDist, 'opticm.min.css');

const licensesDir = join(opticmDist, 'licenses');
const markdownPackage = require.resolve('markdown-it/package.json');
const resolveMarkdownDependency = createRequire(markdownPackage);
const licenses = [
	join(opticmDist, '..', 'LICENSE'),
	...(await readdir(licensesDir)).sort().map(name => join(licensesDir, name)),
	join(dirname(markdownPackage), 'LICENSE'),
	...Object.entries({
		entities: 'LICENSE',
		'linkify-it': 'LICENSE',
		mdurl: 'LICENSE',
		'punycode.js': 'LICENSE-MIT.txt',
		'uc.micro': 'LICENSE.txt',
	}).map(([name, license]) => {
		const entry = resolveMarkdownDependency.resolve(name);
		const packagePath = sep + join('node_modules', name) + sep;
		const root = entry.slice(0, entry.lastIndexOf(packagePath) + packagePath.length);
		return join(root, license);
	}),
];
const notices = (await Promise.all(licenses.map(path => readFile(path, 'utf8')))).join('\n\n');

const context = await esbuild.context({
	banner: {
		js: '/* Bundled Opticm and third-party license notices\n\n' + notices.replaceAll('*/', '* /') + '\n*/',
	},
	entryPoints: ['src/main.ts'],
	bundle: true,
	external: ['obsidian', ...builtinModules],
	format: 'cjs',
	target: 'es2021',
	logLevel: 'info',
	sourcemap: prod ? false : 'inline',
	outfile: join(outputDir, 'main.js'),
	minify: prod,
	plugins: [{
		name: 'opticm-fence-assets',
		setup(build) {
			build.onEnd(async result => {
				if (result.errors.length > 0) {
					return;
				}
				await Promise.all(['manifest.json', 'styles.css'].map(file => copyFile(file, join(outputDir, file))));
				console.log(`Built Obsidian plugin in ${outputDir}/`);
			});
			build.onResolve({ filter: /^opticm-fence-assets$/ }, () => ({
				path: 'opticm-fence-assets',
				namespace: 'opticm-fence-assets',
			}));
			build.onLoad({ filter: /.*/, namespace: 'opticm-fence-assets' }, async () => {
				const [workerSource, runtimeWasm, javaWasm, css, viewer] = await Promise.all([
					readFile(worker, 'utf8'),
					readFile(runtime, 'base64'),
					readFile(grammar, 'base64'),
					readFile(stylesheet, 'utf8'),
					esbuild.build({
						entryPoints: [viewerEntry],
						bundle: true,
						format: 'iife',
						globalName: 'opticmViewer',
						write: false,
						// Opticm resolves a default URL before calling the custom worker factory.
						define: {
							'import.meta.url': JSON.stringify('app://obsidian.md/'),
							'window.matchMedia': 'viewerMatchMedia',
						},
					}),
				]);
				// Electron workers can expose process even though WASM must load through browser URLs.
				const browserWorker = await esbuild.transform(workerSource, {
					define: { process: 'undefined', 'globalThis.process': 'undefined' },
					format: 'esm',
					minifySyntax: true,
				});
				return {
					contents: [
						'export const workerSource = ' + JSON.stringify(browserWorker.code),
						'export const runtimeWasm = ' + JSON.stringify(runtimeWasm),
						'export const javaWasm = ' + JSON.stringify(javaWasm),
						'export const css = ' + JSON.stringify(css),
						// Obsidian renders PDF exports in a separate document on desktop.
						'export function viewerForWindow(window, printListeners) { const document = window.document;\n'
							+ 'const viewerMatchMedia = query => printListeners && query === "print" ? {'
							+ 'addEventListener: (_, listener) => printListeners.add(listener),'
							+ 'removeEventListener: (_, listener) => printListeners.delete(listener)'
							+ '} : window.matchMedia(query);\n'
							+ viewer.outputFiles[0].text + '\nreturn opticmViewer.createViewer; }',
					].join(';\n'),
					watchFiles: [viewerEntry, worker, runtime, grammar, stylesheet],
				};
			});
		},
	}],
});

if (prod) {
	try {
		await context.rebuild();
	} finally {
		await context.dispose();
	}
} else {
	await context.watch();
}
