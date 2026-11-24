declare module 'opticm/viewer' {
	export interface Viewer {
		setHighlightedLines(lines: number[]): void;
		refresh(): void;
		destroy(): void;
	}

	export function createViewer(container: HTMLElement, options: {
		value: string;
		codeLanguage: 'java';
		lineNumbers: boolean | 'function';
		lineNumberStart: number;
		javaAnalysis: {
			createWorker: () => Worker;
			treeSitterWasmURL: string;
			javaWasmURL: string;
		};
	}): Promise<Viewer>;
}

declare module 'opticm-fence-assets' {
	export const workerSource: string;
	export const css: string;
	export function viewerForWindow(window: Window, printListeners?: Set<(event: { type: string; matches: boolean }) => void>): typeof import('opticm/viewer').createViewer;
	export const runtimeWasm: string;
	export const javaWasm: string;
}
