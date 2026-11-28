import { loadPrism, MarkdownRenderChild } from 'obsidian';
import type { MarkdownPostProcessorContext, Plugin } from 'obsidian';
import type { createViewer, Viewer } from 'opticm/viewer';
import { css, javaWasm, runtimeWasm, viewerForWindow, workerSource } from 'opticm-fence-assets';
import { JAVA_FENCE } from './editor-language';
import { parseFenceOptions } from './fence-options';
import { snapshotPrintBlock } from './fence-print';
import { getOpeningLines } from './fence-source';

function wasmURL(base64: string): string {
	const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
	return URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
}

const viewerFactories = new WeakMap<Document, typeof createViewer>();
type PrintListeners = NonNullable<Parameters<typeof viewerForWindow>[1]>;
const printFactories = new WeakMap<Document, { create: typeof createViewer; listeners: PrintListeners }>();
const styles = new WeakMap<Document, { element: HTMLStyleElement; users: number }>();

function retainStyles(document: Document): () => void {
	let style = styles.get(document);
	if (!style) {
		const element = document.createElement('style');
		element.textContent = css;
		document.head.appendChild(element);
		style = { element, users: 0 };
		styles.set(document, style);
	}
	style.users += 1;
	return () => {
		style.users -= 1;
		if (style.users === 0) {
			style.element.remove();
			styles.delete(document);
		}
	};
}

class FenceRenderChild extends MarkdownRenderChild {
	private readonly abort = new AbortController();
	private viewer?: Viewer;

	constructor(container: HTMLElement, private readonly original: HTMLElement, private readonly code: HTMLElement) {
		super(container);
		container.classList.add('opticm-fence-block');
		// Code Styler pairs the note's fences with <pre> elements in document order.
		// Preserve the fence language so Obsidian cannot recycle it as an ordinary Java block.
		original.hidden = true;
		original.classList.add('opticm-fence-source');
		container.appendChild(original);
	}

	onunload(): void {
		this.abort.abort();
		this.viewer?.destroy();
		this.viewer = undefined;
		this.original.hidden = false;
		this.original.classList.remove('opticm-fence-source');
		this.containerEl.replaceWith(this.original);
	}

	async render(source: string, openingLine: Promise<string>): Promise<void> {
		const header = await openingLine;
		const signal = this.abort.signal;
		if (signal.aborted) {
			return;
		}

		const container = this.containerEl;
		const options = parseFenceOptions(header, source.split('\n').length);
		if (options.title) {
			container.createDiv({ cls: 'opticm-fence-title', text: options.title });
		}
		const host = container.createDiv({ cls: 'opticm-fence-viewer' });
		host.setAttribute('tabindex', '-1');
		const urls: string[] = [];
		let staging: HTMLElement | undefined;
		try {
			const document = container.ownerDocument;
			const targetWindow = document.defaultView;
			if (!targetWindow) {
				throw new Error('The code block has no host window.');
			}
			const printing = container.closest('.print') !== null;
			let printFactory = printing ? printFactories.get(document) : undefined;
			if (printing && !printFactory) {
				const listeners: PrintListeners = new Set();
				printFactory = { create: viewerForWindow(targetWindow, listeners), listeners };
				printFactories.set(document, printFactory);
			}
			const viewerFactory = printFactory?.create ?? viewerFactories.get(document) ?? viewerForWindow(targetWindow);
			if (!printing) {
				viewerFactories.set(document, viewerFactory);
			}
			this.register(retainStyles(document));

			const workerURL = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
			urls.push(workerURL);
			const treeSitterWasmURL = wasmURL(runtimeWasm);
			urls.push(treeSitterWasmURL);
			const javaWasmURL = wasmURL(javaWasm);
			urls.push(javaWasmURL);

			// Reading view can detach a section while Opticm is awaiting Java analysis.
			// Keep the editor connected until its initial measurements are complete.
			if (!printing) {
				staging = document.createElement('div');
				staging.className = container.className;
				Object.assign(staging.style, { position: 'fixed', inset: '0', visibility: 'hidden', pointerEvents: 'none' });
				staging.setAttribute('aria-hidden', 'true');
				document.body.appendChild(staging);
				staging.appendChild(host);
			}
			const viewer = await viewerFactory(host, {
				value: source,
				codeLanguage: 'java',
				lineNumbers: options.lineNumbers,
				lineNumberStart: options.lineNumberStart,
				javaAnalysis: {
					createWorker: () => {
						const worker = new Worker(workerURL, { type: 'module' });
						// Let Opticm reject its pending work and terminate the worker on unload.
						signal.addEventListener('abort', () => {
							worker.dispatchEvent(new Event('messageerror'));
						}, { once: true });
						return worker;
					},
					treeSitterWasmURL,
					javaWasmURL,
				},
			});
			if (signal.aborted) {
				viewer.destroy();
				return;
			}
			this.viewer = viewer;
			viewer.setHighlightedLines(options.highlightedLines);
			if (staging) {
				// CodeMirror measures the analyzed document on the next frame.
				await new Promise<void>(resolve => {
					const finish = () => {
						targetWindow.cancelAnimationFrame(frame);
						signal.removeEventListener('abort', finish);
						resolve();
					};
					const frame = targetWindow.requestAnimationFrame(finish);
					signal.addEventListener('abort', finish, { once: true });
				});
				if (signal.aborted) {
					return;
				}
				container.appendChild(host);
			}
			if (host.isConnected) {
				viewer.refresh();
			}
			if (printFactory) {
				// Expand CodeMirror's viewport before reading the lines and Canvas.
				for (const listener of printFactory.listeners) {
					listener({ type: 'change', matches: true });
				}
				// Opticm queues Canvas painting in a microtask after CodeMirror measures.
				// Capture only after that paint, before destroying the live viewer.
				await Promise.resolve();
				if (signal.aborted) {
					return;
				}
				const block = snapshotPrintBlock(host, source, options.lineNumbers, options.lineNumberStart, options.highlightedLines);
				viewer.destroy();
				this.viewer = undefined;
				host.replaceWith(block);
				await Promise.allSettled(Array.from(block.querySelectorAll('img'), image => image.decode()));
			}
		} catch (error) {
			this.viewer?.destroy();
			this.viewer = undefined;
			if (!signal.aborted) {
				console.error('Opticm Fence could not render a Java block. Showing Obsidian Java highlighting.', error);
				host.remove();
				this.original.hidden = false;
				try {
					const prism = await loadPrism() as { highlightElement(element: HTMLElement): void };
					if (!signal.aborted) {
						const fallback = container.ownerDocument.createElement('code');
						fallback.className = 'language-java';
						fallback.textContent = source;
						prism.highlightElement(fallback);
						this.code.replaceChildren(...Array.from(fallback.childNodes));
					}
				} catch {
					// The original source remains readable without syntax highlighting.
				}
			}
		} finally {
			staging?.remove();
			for (const url of urls) {
				URL.revokeObjectURL(url);
			}
		}
	}
}

export function registerFenceRenderer(plugin: Plugin): void {
	const active = new Set<FenceRenderChild>();
	plugin.registerMarkdownPostProcessor((element, context) => {
		// Leave native code fences in the Markdown editor.
		if ((context as MarkdownPostProcessorContext & { displayMode?: boolean }).displayMode === false
			|| element.closest('.markdown-source-view')) {
			return;
		}
		const codeBlocks = Array.from(element.querySelectorAll<HTMLElement>(
			'pre:not(.opticm-fence-source) > code.language-' + JAVA_FENCE,
		));
		if (codeBlocks.length === 0) {
			return;
		}

		const headers = getOpeningLines(plugin, element, context, codeBlocks);
		return Promise.all(codeBlocks.map((code, blockIndex) => {
			const original = code.parentElement!;
			const source = (code.textContent ?? '').replace(/\n$/, '');
			const container = code.ownerDocument.createElement('div');
			container.className = 'block-language-' + JAVA_FENCE;
			original.replaceWith(container);
			const child = new FenceRenderChild(container, original, code);
			active.add(child);
			child.register(() => active.delete(child));
			context.addChild(child);
			return child.render(source, headers.then(lines => lines[blockIndex] ?? ''));
		})).then(() => undefined);
	}, -100);
	plugin.register(() => {
		for (const child of active) {
			child.unload();
		}
		active.clear();
	});
}
