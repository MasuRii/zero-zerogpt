# Word Document (.docx) Library Research for Zero-ZeroGPT

## Executive Summary
This research identifies the optimal JavaScript libraries for adding .docx support to the Zero-ZeroGPT application. For **reading/parsing**, **Mammoth.js** is the recommended choice due to its focus on clean text extraction and semantic HTML conversion, which aligns with the app's need to extract text for transformation. For **writing/generating**, the **docx** npm package is the industry standard for client-side .docx generation, offering robust support for "Office Open XML" features including the `xml:space="preserve"` attribute critical for maintaining the special Unicode space characters used by Zero-ZeroGPT. A key finding is that while Word supports Unicode, standard whitespace behavior in .docx files often collapses spaces unless explicitly told otherwise, requiring precise handling of the `w:t` element's properties.

## 1. Requirement Analysis
Based on `CODEBASE_ANALYSIS.md`, the integration needs:
- **Reader Hook**: `useDocxHandler` needs to extract text (and ideally structural data) similar to `pdfjs-dist`.
- **Generator Hook**: `useDocxGenerator` needs to reconstruct the document with transformed text, preserving the "invisible" Unicode spaces.
- **Unicode Support**: Critical. The app's core value is replacing standard spaces (U+0020) with alternatives like Thin Space (U+2009) or Zero Width Space (U+200B).

## 2. Library Recommendations

### A. Reading/Parsing: Mammoth.js
*Best for extracting clean text and html from .docx files.*

*   **Package**: `mammoth`
*   **GitHub Stars**: ~3.5k
*   **License**: BSD-2-Clause
*   **Bundle Size**: ~180KB (minified)
*   **Browser Support**: Excellent (IE10+, Chrome, Firefox, Safari)

**Key Features:**
*   **Philosophy**: Converts .docx to HTML/Markdown by mapping semantic constructs (paragraphs, headings) rather than visual layout.
*   **Text Extraction**: `mammoth.extractRawText()` provides a straightforward way to get plain text, perfect for the `inputText` state in Zero-ZeroGPT.
*   **Unicode Support**: Handles UTF-8 correctly.
*   **Formatting**: Focuses on semantic structure, which is ideal for the "reading" phase where we want the content, not necessarily the exact pixel-perfect positions (unlike PDF).

**Code Example (Reading):**
```javascript
import mammoth from 'mammoth';

const parseDocx = async (arrayBuffer) => {
  try {
    // Extract raw text for the editor
    const textResult = await mammoth.extractRawText({ arrayBuffer });
    const rawText = textResult.value;

    // Optional: Convert to HTML for a visual preview
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const previewHtml = htmlResult.value;

    return { rawText, previewHtml };
  } catch (error) {
    console.error("Error parsing DOCX:", error);
  }
};
```

**Pros:**
*   Simple API.
*   High fidelity for text content.
*   Lightweight compared to full rendering engines.
*   Reliable text extraction (ignores images/complex formatting if asked).

**Cons:**
*   Does not preserve "page layout" coordinates (x, y) like `pdfjs-dist`. Recreating the *exact* visual layout of the original Word doc is impossible with just Mammoth. The "Generator" phase will likely create a *new* document rather than overlaying text on the old one.

**Source**: [Mammoth.js GitHub](https://github.com/mwilliamson/mammoth.js)

---

### B. Writing/Generating: docx (npm)
*The de-facto standard for generating .docx files in the browser.*

*   **Package**: `docx`
*   **GitHub Stars**: ~4.5k
*   **License**: MIT
*   **Bundle Size**: ~300KB (Tree-shakable)
*   **Browser Support**: Modern Browsers

**Key Features:**
*   **Object-Oriented**: Construct documents using classes (`new Document()`, `new Paragraph()`).
*   **Unicode/Space Handling**: This is the **critical** feature for Zero-ZeroGPT. The library allows setting `xml:space="preserve"` on text runs. Without this, Word treats multiple spaces or certain special spaces as a single whitespace.
*   **Styling**: Full control over fonts, sizes, and layout.

**Code Example (Generating with Unicode Spaces):**
```javascript
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

const generateDocx = async (textWithSpecialSpaces) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: textWithSpecialSpaces,
              // CRITICAL: This ensures Word respects the exact unicode characters
              // and doesn't collapse them.
              xmlSpace: "preserve", 
              font: "Arial" // Standard font that usually supports basic Unicode spaces
            }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "zero-zerogpt-output.docx");
};
```

**Pros:**
*   Comprehensive support for the Office Open XML spec.
*   Explicit control over text runs (splitting text into chunks if needed).
*   Can embed fonts (though complex) if a specific font is needed for rare Unicode characters.
*   Runs entirely in the browser (no server needed).

**Cons:**
*   Verbose API (lots of boilerplate to create simple documents).
*   Cannot "edit" an existing docx file; it creates a new one from scratch.

**Source**: [docx JS Library](https://docx.js.org/)

---

### C. Alternative Options (Commercial/Other)
1.  **Syncfusion React Word Processor**:
    *   **Pros**: Full WYSIWYG editor, "native" feel.
    *   **Cons**: Commercial license required (community license available but restrictive), very heavy bundle.
    *   **Verdict**: Overkill for this specific transformation task.
2.  **html-to-docx**:
    *   **Pros**: Easier if you just want to dump the HTML from the editor.
    *   **Cons**: Less granular control over individual text runs and `xml:space` attributes, which might be risky for the specific "evasion" characters.

## 3. Technical Considerations for Unicode Spaces
Word documents (Office Open XML) store text in `<w:t>` elements. By default, XML parsers (and Word) trim whitespace.

*   **The Problem**: If you insert `Hello[U+2009]World`, Word might render it, but if you have a sequence of spaces or specific non-breaking spaces, Word's layout engine might normalize them.
*   **The Solution**: The `xml:space="preserve"` attribute on the `<w:t>` tag is mandatory.
    *   Example XML output: `<w:t xml:space="preserve">H e l l o</w:t>`
*   **Font Support**: Unlike PDF, where you must embed the font binary, Word relies on system fonts. Most standard fonts (Arial, Calibri, Times New Roman) support common zero-width spaces (U+200B) and thin spaces (U+2009). If a user uses an obscure font, the character might show as a "box" (tofu). The `docx` library allows specifying the font family to ensure a safe default (e.g., Arial) is used.

## 4. Recommendation Matrix

| Feature | Mammoth.js | docx (npm) | Syncfusion | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Role** | Reader | Writer | Both | **Combine Mammoth + docx** |
| **Text Extraction** | Excellent (Raw text) | N/A | Excellent | **Use Mammoth** |
| **Layout Preservation** | Low (Semantic only) | High (Reconstruction) | High | **Accept "Text Flow" layout** |
| **Unicode Control** | High (UTF-8) | High (`xmlSpace`) | Medium | **Use `docx` for precision** |
| **Cost/License** | Free (BSD) | Free (MIT) | Paid | **Free Stack** |

## 5. Proposed Implementation Plan
1.  **Install**: `npm install mammoth docx file-saver`
2.  **Reader**: Implement `useDocxHandler` using `mammoth.extractRawText` to get the string for the main text area.
3.  **Writer**: Implement `useDocxGenerator` using `docx`.
    *   It should take the modified string from `inputText`.
    *   Split the string by newlines to create paragraphs.
    *   Create `TextRun`s with `xmlSpace: 'preserve'`.
    *   Download the blob.

This approach avoids the complexity of editing the *original* binary .docx file (which is a zip of XMLs) and instead treats the Word document as a data source and data sink, with the React app as the transformation layer.