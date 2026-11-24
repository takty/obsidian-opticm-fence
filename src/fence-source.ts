import { getFrontMatterInfo } from 'obsidian';
import type { MarkdownPostProcessorContext, Plugin } from 'obsidian';
import { JAVA_FENCE } from './editor-language';

export async function getOpeningLines(
	plugin: Plugin,
	element: HTMLElement,
	context: MarkdownPostProcessorContext,
	codeBlocks: HTMLElement[],
): Promise<string[]> {
	const section = context.getSectionInfo(element);
	if (section) {
		const lines = section.text.split(/\r?\n/);
		return codeBlocks.map(code => lines[section.lineStart + Number(code.dataset.line ?? 0)] ?? '');
	}

	// The desktop PDF renderer supplies the note path but omits section positions.
	const file = plugin.app.vault.getFileByPath(context.sourcePath);
	if (!file) {
		return [];
	}

	const sources = codeBlocks.map(code => code.textContent?.replace(/\r\n/g, '\n').replace(/\n$/, ''));
	try {
		const [markdown, { default: MarkdownIt }] = await Promise.all([
			plugin.app.vault.cachedRead(file),
			import('markdown-it'),
		]);
		const { contentStart } = getFrontMatterInfo(markdown);
		const fences = new MarkdownIt('commonmark')
			.parse(markdown.slice(contentStart), {})
			.filter(token => token.type === 'fence' && token.info.trim().split(/\s+/, 1)[0] === JAVA_FENCE);
		let next = 0;
		return sources.map(source => {
			const index = fences.findIndex((fence, i) => i >= next && fence.content.replace(/\n$/, '') === source);
			const fence = fences[index];
			if (fence) {
				next = index + 1;
				return '~~~' + fence.info.trim();
			}
			return '';
		});
	} catch (error) {
		console.error('Opticm Fence could not read fence options.', error);
		return [];
	}
}
