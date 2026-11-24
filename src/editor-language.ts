export const JAVA_FENCE = 'java-o';

interface LegacyModeInfo {
	name: string;
	alias?: string[];
}

interface LegacyCodeMirror {
	findModeByName(name: string): LegacyModeInfo | undefined;
}

export function registerJavaAlias(): () => void {
	// Obsidian's Markdown editor resolves fence languages through its legacy mode table.
	const codeMirror = (window as Window & { CodeMirror?: Partial<LegacyCodeMirror> }).CodeMirror;
	if (typeof codeMirror?.findModeByName !== 'function') {
		return () => {};
	}

	const java = codeMirror.findModeByName('java');
	if (!java || codeMirror.findModeByName(JAVA_FENCE)) {
		return () => {};
	}

	const aliases = java.alias ??= [];
	aliases.push(JAVA_FENCE);
	return () => {
		const index = aliases.indexOf(JAVA_FENCE);
		if (index >= 0) {
			aliases.splice(index, 1);
		}
	};
}
