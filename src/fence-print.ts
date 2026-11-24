export function snapshotPrintBlock(
	host: HTMLElement, source: string, lineNumbers: boolean | 'function', lineNumberStart: number, highlightedLines: number[],
): HTMLElement {
	const document = host.ownerDocument;
	const window = document.defaultView!;
	const editor = host.querySelector<HTMLElement>('.cm-editor');
	const content = host.querySelector<HTMLElement>('.cm-content');
	const lines = Array.from(content?.querySelectorAll<HTMLElement>('.cm-line') ?? []);
	const sourceLines = source.split('\n');
	const canUseViewerLines = lines.length === sourceLines.length;
	const canvas = host.querySelector<HTMLCanvasElement>('canvas.code-structure-view');
	const canvasBounds = canvas?.getBoundingClientRect();
	const editorBounds = editor?.getBoundingClientRect();
	const highlights = new Set(highlightedLines);
	const strip = document.createElement('canvas');
	const context = strip.getContext('2d');
	const block = document.createElement('div');
	block.className = 'opticm-fence-print-code';
	if (content) {
		const { fontFamily, fontSize, lineHeight, tabSize } = window.getComputedStyle(content);
		Object.assign(block.style, { fontFamily, fontSize, lineHeight, tabSize });
	}
	const gutter = host.querySelector('.cm-gutters');
	const gutterStyle = gutter ? window.getComputedStyle(gutter) : undefined;
	const gutterEdge = lineNumbers === true && gutter
		? window.getComputedStyle(gutter, '::after')
		: undefined;
	const numberWidth = gutter?.getBoundingClientRect().width || 30;
	const padding = lines[0] ? window.getComputedStyle(lines[0]).paddingLeft : '4px';
	// CodeMirror places an invisible width spacer before the rendered gutter rows.
	const functionNumbers = lineNumbers === 'function'
		? Array.from(host.querySelectorAll('.cm-sectionNumbers > .cm-gutterElement')).slice(1)
		: [];
	const highlightedLine = content?.querySelector('.cm-opticm-highlighted-line');
	const highlightedNumber = gutter?.querySelector('.cm-opticm-highlighted-line-number');
	const lineHighlightStyle = highlightedLine ? window.getComputedStyle(highlightedLine) : undefined;
	const numberHighlightStyle = highlightedNumber ? window.getComputedStyle(highlightedNumber) : undefined;

	for (const [index, sourceLine] of sourceLines.entries()) {
		const row = block.appendChild(document.createElement('div'));
		row.className = 'opticm-fence-print-row';
		const highlighted = highlights.has(index);
		if (highlighted && lineHighlightStyle) {
			const highlight = row.appendChild(document.createElement('span'));
			highlight.className = 'opticm-fence-print-highlight';
			highlight.style.left = lineNumbers ? numberWidth + 'px' : '0';
			highlight.style.backgroundColor = lineHighlightStyle.backgroundColor;
			highlight.style.backgroundImage = lineHighlightStyle.backgroundImage;
		}
		if (lineNumbers) {
			const number = row.appendChild(document.createElement('span'));
			number.className = 'opticm-fence-print-number';
			number.style.width = numberWidth + 'px';
			if (gutterStyle) {
				number.style.backgroundColor = gutterStyle.backgroundColor;
				number.style.color = gutterStyle.color;
			}
			if (gutterEdge && gutterEdge.content !== 'none' && gutterEdge.width !== 'auto') {
				number.style.borderRight = `${gutterEdge.width} solid ${gutterEdge.backgroundColor}`;
			}
			const marker = functionNumbers[index];
			number.textContent = marker?.textContent ?? String(lineNumberStart + index);
			if (marker) {
				const alternate = window.getComputedStyle(marker, '::before');
				if (alternate.content !== 'none' && alternate.content !== 'normal') {
					const color = alternate.backgroundColor;
					number.style.backgroundImage = `linear-gradient(${color}, ${color})`;
				}
			}
			if (highlighted && numberHighlightStyle) {
				const { backgroundColor, backgroundImage } = numberHighlightStyle;
				number.style.backgroundColor = backgroundColor;
				if (backgroundImage !== 'none') {
					number.style.backgroundImage = backgroundImage;
				}
			}
		}
		const text = row.appendChild(document.createElement('span'));
		text.className = 'opticm-fence-print-text';
		text.style.paddingLeft = padding;
		const line = canUseViewerLines ? lines[index] : undefined;
		if (!line || line.textContent !== sourceLine) {
			text.textContent = sourceLine || '\u00a0';
		} else {
			for (const node of Array.from(line.childNodes)) {
				const child = text.appendChild(node.cloneNode(true));
				if (node instanceof window.HTMLElement && child instanceof window.HTMLElement) {
					const { color, fontWeight, fontStyle } = window.getComputedStyle(node);
					Object.assign(child.style, { color, fontWeight, fontStyle });
				}
			}
		}
		if (!line || !canvas || !canvasBounds?.width || !canvasBounds.height || !context || !editorBounds) {
			continue;
		}

		const lineBounds = line.getBoundingClientRect();
		const scale = canvas.height / canvasBounds.height;
		const start = Math.round((lineBounds.top - canvasBounds.top) * scale);
		const end = Math.round((lineBounds.bottom - canvasBounds.top) * scale);
		if (start < 0 || end > canvas.height || start >= end) {
			continue;
		}
		strip.width = canvas.width;
		strip.height = end - start;
		context.drawImage(canvas, 0, start, strip.width, strip.height, 0, 0, strip.width, strip.height);
		const image = row.appendChild(document.createElement('img'));
		image.className = 'opticm-fence-print-guide';
		image.alt = '';
		image.style.left = (canvasBounds.left - editorBounds.left) + 'px';
		image.style.width = canvasBounds.width + 'px';
		image.style.height = lineBounds.height + 'px';
		image.src = strip.toDataURL();
	}
	return block;
}
