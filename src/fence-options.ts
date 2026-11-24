import { JAVA_FENCE } from './editor-language';

export interface FenceOptions {
	title?: string;
	lineNumbers: boolean | 'function';
	lineNumberStart: number;
	highlightedLines: number[];
}

const OPENING_FENCE = /^[ \t>]*(?:(?:[-+*]|\d+[.)])[ \t]+[ \t>]*)*(?:`{3,}|~{3,})[ \t]*([^ \t]+)(.*)$/;

export function parseFenceOptions(openingLine: string, lineCount: number): FenceOptions {
	const options: FenceOptions = { lineNumbers: true, lineNumberStart: 1, highlightedLines: [] };
	const fence = OPENING_FENCE.exec(openingLine);
	if (fence?.[1] !== JAVA_FENCE) {
		return options;
	}

	const lines = new Set<number>();
	const tokens = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
	for (const [token] of (fence[2] ?? '').matchAll(tokens)) {
		const option = /^([a-z]+)[:=](.*)$/i.exec(token);
		const value = option?.[2]?.replace(/^(["'])(.*)\1$/, '$2') ?? '';
		switch (option?.[1]?.toLowerCase()) {
			case 'title':
				options.title = value;
				break;
			case 'ln': {
				const start = Number(value);
				if (value === 'false' || value === 'true' || value === 'function') {
					options.lineNumbers = value === 'function' ? value : value === 'true';
					options.lineNumberStart = 1;
				} else if (/^\d+$/.test(value) && Number.isSafeInteger(start) && start > 0
					&& Number.isSafeInteger(start + (lineCount - 1))) {
					options.lineNumbers = true;
					options.lineNumberStart = start;
				}
				break;
			}
			case 'hl':
				for (const part of value.split(',')) {
					const range = /^(\d+)(?:-(\d+))?$/.exec(part);
					if (!range) {
						continue;
					}
					const first = Number(range[1]);
					const last = Math.min(Number(range[2] ?? range[1]), lineCount);
					for (let line = first; line >= 1 && line <= last; line += 1) {
						lines.add(line - 1);
					}
				}
				break;
		}
	}
	options.highlightedLines = [...lines];
	return options;
}
