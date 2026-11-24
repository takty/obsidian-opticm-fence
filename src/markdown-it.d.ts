declare module 'markdown-it' {
	interface Token {
		type: string;
		info: string;
		content: string;
	}

	export default class MarkdownIt {
		constructor(preset: 'commonmark');
		parse(source: string, environment: object): Token[];
	}
}
