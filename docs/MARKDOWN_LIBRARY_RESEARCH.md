# Markdown Library Research for Zero-ZeroGPT

## 1. Executive Summary
This research analyzed 5 major JavaScript/TypeScript Markdown libraries (`remark`, `markdown-it`, `marked`, `showdown`, `turndown`) for integrating Markdown support into Zero-ZeroGPT. **`remark` (unified ecosystem)** is strongly recommended as the primary choice due to its superior Abstract Syntax Tree (AST) capabilities, which are essential for the surgical manipulation of text nodes required to insert Unicode space characters without breaking Markdown syntax. While `markdown-it` is a faster alternative for simple rendering, it lacks the AST transformation depth of `remark`. For the specific requirement of reading, modifying (inserting Unicode spaces), and exporting Markdown, a combination of `remark-parse`, `remark-stringify`, and standard browser File API for reading/writing UTF-8 text is the optimal architectural fit.

## 2. Library Analysis

### 2.1 remark (Recommended)
*   **Package**: `remark` (core), `remark-parse`, `remark-stringify`
*   **GitHub**: [https://github.com/remarkjs/remark](https://github.com/remarkjs/remark) (~15k stars)
*   **License**: MIT
*   **Key Features**:
    *   **True AST**: Powered by `mdast` (Markdown Abstract Syntax Tree). Allows traversing the tree and modifying specific text nodes while leaving structure (headers, lists, code blocks) untouched.
    *   **Ecosystem**: Part of the `unified` collective. Huge plugin ecosystem.
    *   **Unicode Support**: Excellent. AST nodes are fully Unicode-aware strings.
    *   **Whitespace**: `remark-stringify` has strict control over output formatting, ensuring structural integrity is maintained while text content is modified.
*   **Relevance**: Perfect for "Read -> Parse to AST -> Visit Text Nodes -> Replace Spaces -> Stringify" pipeline.
*   **Cons**: Steeper learning curve than `marked`. Larger bundle size if not tree-shaken carefully.

### 2.2 markdown-it
*   **Package**: `markdown-it`
*   **GitHub**: [https://github.com/markdown-it/markdown-it](https://github.com/markdown-it/markdown-it) (~18k stars)
*   **License**: MIT
*   **Key Features**:
    *   **Fast**: Claims to be one of the fastest CommonMark parsers.
    *   **Extensible**: Good plugin system, but token-stream based, not full AST.
    *   **HTML Generation**: Primary focus is converting MD to HTML, not MD to MD.
*   **Relevance**: Great for *previewing* the result in the browser, but less ideal for the *transformation* step compared to `remark` because reconstructing Markdown source from `markdown-it` tokens is non-trivial (requires 3rd party plugins).
*   **Cons**: Harder to output back to Markdown source.

### 2.3 marked
*   **Package**: `marked`
*   **GitHub**: [https://github.com/markedjs/marked](https://github.com/markedjs/marked) (~32k stars)
*   **License**: MIT
*   **Key Features**:
    *   **Lightweight**: Small bundle, very fast.
    *   **Simple**: "Just works" for parsing to HTML.
*   **Relevance**: Low. It is a one-way street (MD -> HTML). No built-in mechanism to parse to AST, modify, and write back to Markdown.

### 2.4 showdown
*   **Package**: `showdown`
*   **GitHub**: [https://github.com/showdownjs/showdown](https://github.com/showdownjs/showdown) (~13k stars)
*   **License**: MIT
*   **Key Features**:
    *   **Bidirectional**: Can convert HTML to Markdown and vice versa.
*   **Relevance**: Useful if we were treating the document as HTML primarily, but for preserving original Markdown formatting (custom syntax, spacing), `remark` is safer.

### 2.5 turndown
*   **Package**: `turndown`
*   **GitHub**: [https://github.com/mixmark-io/turndown](https://github.com/mixmark-io/turndown) (~7k stars)
*   **License**: MIT
*   **Key Features**:
    *   **HTML to MD**: Specialized in converting HTML back to Markdown.
*   **Relevance**: useful only if we rendered everything to HTML first and then tried to save back to Markdown, but this is "lossy". Direct AST manipulation (remark) is lossless.

## 3. Technical Implementation Strategy

### 3.1 Architecture for Zero-ZeroGPT
Unlike PDF (binary) or Word (XML-in-Zip), Markdown is plain text. However, simple string replacement is dangerous because it might break syntax (e.g., breaking a link `[text](url)` by modifying the URL, or breaking a code block).

**The Proposed Pipeline:**
1.  **Read**: Browser `FileReader` API (read as text/utf-8).
2.  **Parse**: `unified().use(remarkParse).parse(fileContent)` -> Produces MDAST.
3.  **Transform**: Create a custom `unist-util-visit` visitor.
    *   Target only `text` nodes.
    *   Ignore `code`, `link` (url part), `image` (url part), and `html` nodes.
    *   Apply Unicode space substitution logic from `App.js` to the `node.value`.
4.  **Generate**: `unified().use(remarkStringify).stringify(ast)` -> Produces Markdown string.
5.  **Write**: Create `Blob([content], {type: 'text/markdown;charset=utf-8'})` and download.

### 3.2 Unicode & Whitespace Considerations
*   **UTF-8**: Markdown files must be read/written as UTF-8. The BOM (Byte Order Mark) issue is rare in modern web apps but worth handling by stripping `\uFEFF` if present.
*   **Space Characters**:
    *   Markdown treats standard spaces (U+0020) significantly in indentation (lists, code blocks).
    *   **Unicode Spaces** (e.g., U+200B Zero Width Space) are generally treated as non-whitespace characters by Markdown parsers. This is **GOOD** for our use case. It means they won't trigger code blocks or list indentation. They will simply exist as "content".
    *   *Caution*: Some renderers might display tofu (boxes) if the font doesn't support the character, but the *data* remains valid.

### 3.3 Code Example: AST Transformation with Remark

```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';

// The Core Transformation Logic
const transformMarkdown = async (markdownText, unicodeSpaceChar) => {
  const processor = unified()
    .use(remarkParse)
    .use(() => (tree) => {
      visit(tree, 'text', (node) => {
        // Safe replacement: only affects text content, not syntax
        node.value = node.value.split(' ').join(unicodeSpaceChar);
      });
    })
    .use(remarkStringify);

  const file = await processor.process(markdownText);
  return String(file);
};
```

## 4. Comparison Matrix

| Feature | remark | markdown-it | marked | showdown |
| :--- | :--- | :--- | :--- | :--- |
| **Parsing Type** | Full AST (MDAST) | Token Stream | Lexer/Parser | Regex/Parser |
| **Transformation** | Excellent (Tree Traversal) | Good (Token manipulation) | Poor (String manipulation) | Poor |
| **Output** | MD -> AST -> MD | MD -> HTML | MD -> HTML | MD <-> HTML |
| **Safety** | High (Context aware) | Medium | Low | Medium |
| **Bundle Size** | Medium (Modular) | Medium | Small | Medium |
| **Recommendation** | **Primary Choice** | Preview Only | Not Recommended | Not Recommended |

## 5. Recommendation
**Adopt `remark` (unified)**.
It is the only library that treats Markdown transformation as a first-class citizen (Parse -> Transform -> Stringify) rather than just a rendering step (Parse -> HTML). This aligns perfectly with the Zero-ZeroGPT goal of "modifying content while preserving layout/structure".

*   **Reading**: Native `FileReader` (Text).
*   **Processing**: `remark` + `unist-util-visit`.
*   **Writing**: Native `Blob` download.
*   **Preview**: Can use `react-markdown` (which uses remark under the hood) for consistency, or just `markdown-it` for speed.