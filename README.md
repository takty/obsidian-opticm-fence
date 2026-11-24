# Opticm Fence

Opticm Fence renders Java code blocks with the [Opticm Viewer](https://github.com/takty/opticm) in Obsidian's Reading view. In Source mode and Live Preview, the Markdown editor uses Obsidian's Java syntax highlighting and keeps the `java-o` fence identifier. Standard `java` fences keep their normal behavior.

## Install a local build

1. Run `yarn install` and `yarn build`.
2. Copy the generated `dist/opticm-fence/` folder into `<vault>/.obsidian/plugins/`. The resulting folder contains `main.js`, `manifest.json`, and `styles.css`.
3. Reload Obsidian and enable **Opticm Fence** under **Settings → Community plugins**.

The minimum Obsidian version is 1.15.1. The plugin bundles its Java analysis worker and both WebAssembly files. It can render code offline.

## Write a code fence

~~~~markdown
~~~java-o title:"Example program.java" ln:27 hl:2-3
void main() {
    int value = 10;
    System.out.println(value);
}
~~~
~~~~

| Option | Behavior |
| --- | --- |
| `title` | Displays a title. Use single or double quotes around a title with spaces. |
| `ln` | Shows line numbers by default. Use `ln:false` to hide them, `ln:true` to show them from 1, `ln:function` to number lines within each function, or a positive integer such as `ln:27` to set the first number. |
| `hl` | Highlights physical lines of the block, counting from 1 independently of the displayed line numbers. Separate individual lines and inclusive ranges with commas, as in `hl:1,3-5`. |

Options accept both `:` and `=`. The Viewer is read-only and supports selecting and copying text. It shows syntax and semantic highlighting, structure guides, variable declarations and references, and indentation guides. Code Styler's folding and text or regular-expression highlight matching are outside the supported option set.

## Use with Code Styler

Use `java-o` for Opticm and `java` for ordinary Java blocks. If Code Styler also styles `java-o` blocks in your configuration, add `java-o` to its **Excluded languages** list. This preserves Code Styler styling on your other fences.

## Export to PDF

On desktop, use Obsidian's **Export to PDF** command. The plugin uses the Viewer to prepare a static print layout. Code remains selectable, and each row carries an image of its structure guides so the block can span pages. Obsidian's own PDF export and simultaneous operation with Code Styler still need to be verified in the desktop app. Mobile PDF export has a separate rendering path and has not been verified.

## Develop

Use `yarn dev` to watch for changes and `yarn lint` to check the source. Rebuild and reload Obsidian after changing the plugin. The editor alias uses Obsidian's legacy CodeMirror language table, so verify Source mode and Live Preview when testing a new Obsidian version.
