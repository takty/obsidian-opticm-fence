import { Plugin } from 'obsidian';
import { registerJavaAlias } from './editor-language';
import { registerFenceRenderer } from './fence-renderer';

export default class OpticmFencePlugin extends Plugin {
	onload(): void {
		this.register(registerJavaAlias());
		registerFenceRenderer(this);
	}
}
