import { useState, useCallback, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fontManager from '../utils/fontManager';

// Cache for the fetched font bytes - disabled for now since external fonts are unreliable
// let cachedUnicodeFontBytes = null;

/**
 * Placeholder for future Unicode font loading.
 * Currently returns null to use StandardFonts with sanitization.
 * TODO: Bundle a TTF font with the application for reliable Unicode support.
 * @returns {Promise<Uint8Array|null>} Font bytes or null
 */
const fetchUnicodeFont = async () => {
  // External font loading is disabled due to:
  // 1. WOFF/WOFF2 fonts don't work reliably with pdf-lib (needs TTF/OTF)
  // 2. CDN fonts may not be accessible in all environments
  // 3. Font loading adds latency to PDF generation
  //
  // For now, we use StandardFonts with sanitization to ensure compatibility.
  // Unicode characters like special spaces will be replaced with regular spaces.
  //
  // To enable full Unicode support, bundle a TTF font file (like Noto Sans)
  // as a static asset and load it from there.
  
  return null;
};

/**
 * Sanitize text for WinAnsi encoding by replacing unsupported Unicode characters
 * with their closest ASCII equivalents (fallback only)
 * @param {string} text - Input text with potential Unicode characters
 * @returns {string} Sanitized text safe for WinAnsi encoding
 */
const sanitizeForWinAnsi = (text) => {
  if (!text) return '';
  
  // Map of Unicode characters to their WinAnsi-safe replacements
  const replacements = {
    // Unicode spaces -> regular space
    '\u200a': ' ',  // Hair Space
    '\u200b': '',   // Zero Width Space (remove)
    '\u2009': ' ',  // Thin Space
    '\u2003': ' ',  // Em Space
    '\u2002': ' ',  // En Space
    '\u2004': ' ',  // Three-Per-Em Space
    '\u2005': ' ',  // Four-Per-Em Space
    '\u2006': ' ',  // Six-Per-Em Space
    '\u2007': ' ',  // Figure Space
    '\u2008': ' ',  // Punctuation Space
    '\u205f': ' ',  // Medium Mathematical Space
    '\u00a0': ' ',  // Non-breaking space
    '\u3000': ' ',  // Ideographic Space
    '\ufeff': '',   // Zero Width No-Break Space (BOM)
    // Special characters
    '\u25aa': '*',  // Black Small Square -> asterisk
    '\u25ab': '*',  // White Small Square
    '\u2022': '*',  // Bullet
    '\u2023': '>',  // Triangular Bullet
    '\u2043': '-',  // Hyphen Bullet
    '\u25e6': 'o',  // White Bullet
    // Turkish characters (common issue)
    '\u0130': 'I',  // Latin Capital Letter I With Dot Above
    '\u0131': 'i',  // Latin Small Letter Dotless I
    // Other common problematic characters
    '\u2013': '-',  // En Dash
    '\u2014': '-',  // Em Dash
    '\u2018': "'",  // Left Single Quote
    '\u2019': "'",  // Right Single Quote
    '\u201c': '"',  // Left Double Quote
    '\u201d': '"',  // Right Double Quote
    '\u2026': '...', // Ellipsis
    '\u00b7': '.',  // Middle Dot
  };
  
  let result = text;
  for (const [unicode, replacement] of Object.entries(replacements)) {
    result = result.split(unicode).join(replacement);
  }
  
  // Remove any remaining non-WinAnsi characters (keep only printable ASCII + Latin-1 Supplement)
  // WinAnsi supports: 0x20-0x7E (ASCII printable) and 0xA0-0xFF (Latin-1 Supplement)
  result = result.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '');
  
  return result;
};

/**
 * Custom hook for generating and downloading PDF files from text
 * Uses jsPDF for simple text-based PDF generation and pdf-lib for layout-preserved generation
 *
 * @returns {Object} PDF generator state and functions
 */
export const usePdfGenerator = () => {
  // State for loading indicator during generation
  const [isGenerating, setIsGenerating] = useState(false);
  
  // State for any generation errors
  const [generationError, setGenerationError] = useState(null);

  /**
   * Default PDF generation options - memoized for stable reference
   */
  const defaultOptions = useMemo(() => ({
    fontSize: 12,
    margin: 20,
    lineSpacing: 1.5,
    pageFormat: 'a4',
    orientation: 'portrait'
  }), []);

  /**
   * Generates a PDF from the provided text
   * Handles line wrapping and multi-page support automatically
   * 
   * @param {string} text - The text content to include in the PDF
   * @param {Object} options - PDF generation options
   * @returns {jsPDF} The generated PDF document
   */
  const generatePdf = useCallback((text, options = {}) => {
    const {
      fontSize = defaultOptions.fontSize,
      margin = defaultOptions.margin,
      lineSpacing = defaultOptions.lineSpacing,
      pageFormat = defaultOptions.pageFormat,
      orientation = defaultOptions.orientation
    } = options;

    // Create new PDF document
    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: pageFormat,
    });

    // Get page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const textWidth = pageWidth - (margin * 2);
    
    // Set font size
    doc.setFontSize(fontSize);
    
    // Split text into lines that fit the page width
    // jsPDF's splitTextToSize handles Unicode characters
    const lines = doc.splitTextToSize(text, textWidth);
    
    // Calculate line height (pt to mm conversion with spacing)
    const lineHeight = fontSize * 0.352778 * lineSpacing;
    
    // Starting Y position
    let y = margin;

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      // Check if we need a new page
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      
      // Add the line to the PDF
      doc.text(lines[i], margin, y);
      y += lineHeight;
    }

    return doc;
  }, [defaultOptions]);

  /**
   * Downloads a PDF with the provided text
   * 
   * @param {string} text - The text content to include in the PDF
   * @param {string} filename - The name for the downloaded file
   * @param {Object} options - PDF generation options
   */
  const downloadPdf = useCallback((text, filename = 'document.pdf', options = {}) => {
    // Ensure filename ends with .pdf
    let safeFilename = filename;
    if (!safeFilename.toLowerCase().endsWith('.pdf')) {
      safeFilename += '.pdf';
    }

    const doc = generatePdf(text, options);
    doc.save(safeFilename);
  }, [generatePdf]);

  /**
   * Generates and downloads a PDF with full error handling
   * This is the main function to use for PDF download
   * 
   * @param {string} text - The text content to include in the PDF
   * @param {string} filename - The name for the downloaded file (optional)
   * @param {Object} options - PDF generation options (optional)
   * @returns {Promise<boolean>} True if successful, throws error otherwise
   */
  const generateAndDownloadPdf = useCallback(async (text, filename = 'transformed.pdf', options = {}) => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      // Validate input
      if (!text || typeof text !== 'string') {
        throw new Error('No text provided for PDF generation');
      }

      if (text.trim().length === 0) {
        throw new Error('Cannot generate PDF from empty text');
      }

      // Ensure filename ends with .pdf
      let safeFilename = filename;
      if (!safeFilename.toLowerCase().endsWith('.pdf')) {
        safeFilename += '.pdf';
      }

      // Generate the PDF
      const doc = generatePdf(text, options);
      
      // Save/download the PDF
      doc.save(safeFilename);
      
      setIsGenerating(false);
      return true;
    } catch (err) {
      const errorMessage = err.message || 'Failed to generate PDF';
      setGenerationError(errorMessage);
      setIsGenerating(false);
      throw new Error(errorMessage);
    }
  }, [generatePdf]);

  /**
   * Clears any generation errors
   */
  const clearError = useCallback(() => {
    setGenerationError(null);
  }, []);

  /**
   * Resets the generator state
   */
  const reset = useCallback(() => {
    setIsGenerating(false);
    setGenerationError(null);
  }, []);

  /**
   * Map a font style to a pdf-lib StandardFonts enum value
   * @param {'normal'|'bold'|'italic'|'bolditalic'} style - Font style
   * @param {'helvetica'|'times'|'courier'} family - Font family
   * @returns {string} StandardFonts key
   */
  const getStandardFont = useCallback((style, family = 'helvetica') => {
    return fontManager.getStandardFontKey(style, family);
  }, []);

  /**
   * Embed fonts into a PDF document - tries Unicode font first, falls back to StandardFonts
   * @param {PDFDocument} pdfDoc - The PDF document
   * @param {Map<string, import('../utils/pdfTypes').FontInfo>} fonts - Map of font ID to FontInfo
   * @returns {Promise<{fonts: Map<string, import('pdf-lib').PDFFont>, hasUnicodeSupport: boolean}>} Map of font ID to embedded PDFFont
   */
  const embedStandardFonts = useCallback(async (pdfDoc, fonts) => {
    const embeddedFonts = new Map();
    let hasUnicodeSupport = false;
    
    // Try to fetch and embed a Unicode-capable font first
    let unicodeFont = null;
    try {
      const fontBytes = await fetchUnicodeFont();
      if (fontBytes) {
        unicodeFont = await pdfDoc.embedFont(fontBytes, { subset: false });
        hasUnicodeSupport = true;
        console.log('Successfully embedded Unicode font');
      }
    } catch (err) {
      console.warn('Failed to embed Unicode font, falling back to StandardFonts:', err.message);
    }
    
    // Set default font - prefer Unicode font if available
    if (unicodeFont) {
      embeddedFonts.set('__default__', unicodeFont);
      embeddedFonts.set('__unicode__', unicodeFont);
    } else {
      const defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      embeddedFonts.set('__default__', defaultFont);
    }
    
    // For source document fonts, use Unicode font if available, otherwise map to StandardFonts
    if (fonts && fonts.size > 0) {
      for (const [fontId, fontInfo] of fonts.entries()) {
        try {
          if (unicodeFont) {
            // Use Unicode font for all text to preserve transformations
            embeddedFonts.set(fontId, unicodeFont);
          } else {
            // Fallback to standard fonts
            const style = fontInfo.style || 'normal';
            const fontKey = getStandardFont(style, 'helvetica');
            const embeddedFont = await pdfDoc.embedFont(StandardFonts[fontKey]);
            embeddedFonts.set(fontId, embeddedFont);
          }
        } catch (err) {
          console.warn(`Failed to embed font ${fontId}, using default:`, err.message);
          embeddedFonts.set(fontId, embeddedFonts.get('__default__'));
        }
      }
    }
    
    return { fonts: embeddedFonts, hasUnicodeSupport };
  }, [getStandardFont]);

  /**
   * Get the embedded font for a text item, with fallback to default
   * @param {string} fontName - Font name/ID from text item
   * @param {Map<string, import('pdf-lib').PDFFont>} embeddedFonts - Map of embedded fonts
   * @returns {import('pdf-lib').PDFFont} The embedded font to use
   */
  const getFontForTextItem = useCallback((fontName, embeddedFonts) => {
    if (embeddedFonts.has(fontName)) {
      return embeddedFonts.get(fontName);
    }
    return embeddedFonts.get('__default__');
  }, []);

  /**
   * Transform Y coordinate from PDF.js coordinate system (bottom-left origin) to pdf-lib coordinate system
   * pdf-lib also uses bottom-left origin, but PDF.js gives us the baseline position
   * @param {number} y - Y position from PDF.js (from bottom)
   * @param {number} pageHeight - Page height in points
   * @returns {number} Transformed Y position for pdf-lib
   */
  const transformYCoordinate = useCallback((y, pageHeight) => {
    // PDF.js already provides Y from bottom, but we need to account for text placement
    // In pdf-lib, drawText uses Y as the baseline position from bottom
    // So we use the Y directly since both use bottom-left origin
    return y;
  }, []);

  /**
   * Generate a PDF with layout preservation using pdf-lib
   * Creates pages with original dimensions and positions text at exact coordinates
   *
   * @param {string} transformedText - The transformed text content (with Unicode spaces applied)
   * @param {import('../utils/pdfTypes').ExtractedPdfData} extractedPdfData - Extracted PDF data with layout info
   * @param {Object} options - Generation options
   * @param {string} [options.filename='document.pdf'] - Output filename
   * @param {boolean} [options.preserveLayout=true] - Whether to preserve layout
   * @returns {Promise<Uint8Array>} The generated PDF as bytes
   */
  const generatePdfWithLayout = useCallback(async (transformedText, extractedPdfData, options = {}) => {
    const { preserveLayout = true } = options;
    
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      // Validate inputs
      if (!extractedPdfData || !extractedPdfData.pageLayouts || extractedPdfData.pageLayouts.length === 0) {
        throw new Error('No page layout data available for PDF generation');
      }
      
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      
      // Register fontkit for custom font support
      pdfDoc.registerFontkit(fontkit);
      
      // Embed fonts - tries Unicode font first for full character support
      const { fonts: embeddedFonts, hasUnicodeSupport } = await embedStandardFonts(pdfDoc, extractedPdfData.fonts);
      
      // Group text items by page index for efficient processing
      const textItemsByPage = new Map();
      if (extractedPdfData.textItems && extractedPdfData.textItems.length > 0) {
        for (const item of extractedPdfData.textItems) {
          const pageIndex = item.pageIndex || 0;
          if (!textItemsByPage.has(pageIndex)) {
            textItemsByPage.set(pageIndex, []);
          }
          textItemsByPage.get(pageIndex).push(item);
        }
      }
      
      // The transformedText should correspond to the concatenated original text
      // We use character offsets stored in text items to map transformed text back to positions
      const transformedChars = [...transformedText];
      
      // Process each page
      for (let pageIndex = 0; pageIndex < extractedPdfData.pageLayouts.length; pageIndex++) {
        const pageLayout = extractedPdfData.pageLayouts[pageIndex];
        
        // Create page with original dimensions
        const page = pdfDoc.addPage([pageLayout.width, pageLayout.height]);
        const pageHeight = pageLayout.height;
        
        // Get text items for this page
        const pageTextItems = textItemsByPage.get(pageIndex) || [];
        
        if (preserveLayout && pageTextItems.length > 0) {
          // Render each text item at its original position
          for (const item of pageTextItems) {
            try {
              // Get the font for this text item
              const font = getFontForTextItem(item.fontName, embeddedFonts);
              
              // Get font size (default to 12 if not available)
              const fontSize = item.fontSize || 12;
              
              // Get the original text
              const originalText = item.text || '';
              const originalLength = originalText.length;
              
              // Use character offsets to extract the corresponding transformed text
              // This ensures each text item gets its correct portion of the transformed text
              let displayText = '';
              
              if (typeof item.charOffsetStart === 'number' && typeof item.charOffsetEnd === 'number') {
                // Use offset-based mapping for accurate character correspondence
                const start = item.charOffsetStart;
                const end = item.charOffsetEnd;
                
                // Extract the transformed text for this item's offset range
                for (let i = start; i < end && i < transformedChars.length; i++) {
                  displayText += transformedChars[i];
                }
                
                // If transformed text is shorter, pad with original characters
                while (displayText.length < originalLength) {
                  displayText += originalText[displayText.length] || ' ';
                }
              } else {
                // Fallback: use original text if no offset info
                displayText = originalText;
              }
              
              // Transform coordinates - PDF.js gives Y from bottom, pdf-lib also uses bottom
              // But we need to handle the coordinate properly
              const x = item.x || 0;
              const y = transformYCoordinate(item.y, pageHeight);
              
              // Get text color (default to black)
              const color = item.color || { r: 0, g: 0, b: 0 };
              
              // Use original text if Unicode font available, otherwise sanitize
              const textToRender = hasUnicodeSupport ? displayText : sanitizeForWinAnsi(displayText);
              
              // Only draw if there's text to render
              if (textToRender.length > 0) {
                // Draw text at the exact position
                page.drawText(textToRender, {
                  x: x,
                  y: y,
                  size: fontSize,
                  font: font,
                  color: rgb(color.r, color.g, color.b),
                });
              }
            } catch (itemErr) {
              console.warn(`Failed to render text item: ${itemErr.message}`);
              // Continue with next item
            }
          }
        } else {
          // Fallback: simple text rendering without layout preservation
          const defaultFont = embeddedFonts.get('__default__');
          const fontSize = 12;
          const margin = 72; // 1 inch margins
          const lineHeight = fontSize * 1.5;
          
          // Get portion of text for this page
          const textForPage = pageIndex === 0 ? transformedText : '';
          
          if (textForPage) {
            const lines = textForPage.split('\n');
            let y = pageHeight - margin;
            
            for (const line of lines) {
              if (y < margin) break;
              
              const lineToRender = hasUnicodeSupport ? line : sanitizeForWinAnsi(line);
              if (lineToRender.length > 0) {
                page.drawText(lineToRender, {
                  x: margin,
                  y: y,
                  size: fontSize,
                  font: defaultFont,
                  color: rgb(0, 0, 0),
                });
              }
              
              y -= lineHeight;
            }
          }
        }
      }
      
      // Save the PDF document
      const pdfBytes = await pdfDoc.save();
      
      setIsGenerating(false);
      return pdfBytes;
      
    } catch (err) {
      console.error('Failed to generate PDF with layout:', err);
      setGenerationError(err.message);
      setIsGenerating(false);
      
      // Attempt fallback to simple text-only PDF using pdf-lib
      try {
        console.log('Falling back to simple text PDF generation');
        const fallbackDoc = await PDFDocument.create();
        const page = fallbackDoc.addPage();
        const { height } = page.getSize();
        const font = await fallbackDoc.embedFont(StandardFonts.Helvetica);
        
        const fontSize = 12;
        const margin = 72;
        const lineHeight = fontSize * 1.5;
        
        const lines = (transformedText || '').split('\n');
        let y = height - margin;
        
        for (const line of lines) {
          if (y < margin) {
            // Add new page if needed
            const newPage = fallbackDoc.addPage();
            y = newPage.getSize().height - margin;
          }
          
          const safeLine = sanitizeForWinAnsi(line.substring(0, 100));
          if (safeLine.length > 0) {
            page.drawText(safeLine, { // Limit line length
              x: margin,
              y: y,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0),
            });
          }
          
          y -= lineHeight;
        }
        
        return await fallbackDoc.save();
      } catch (fallbackErr) {
        console.error('Fallback PDF generation also failed:', fallbackErr);
        throw new Error(`PDF generation failed: ${err.message}`);
      }
    }
  }, [embedStandardFonts, getFontForTextItem, transformYCoordinate]);

  /**
   * Generate PDF with layout and trigger download
   *
   * @param {string} transformedText - The transformed text content
   * @param {import('../utils/pdfTypes').ExtractedPdfData} extractedPdfData - Extracted PDF data with layout info
   * @param {Object} options - Generation options
   * @param {string} [options.filename='document.pdf'] - Output filename
   * @param {boolean} [options.preserveLayout=true] - Whether to preserve layout
   * @returns {Promise<boolean>} True if successful
   */
  const generateAndDownloadPdfWithLayout = useCallback(async (transformedText, extractedPdfData, options = {}) => {
    const { filename = 'document.pdf' } = options;
    
    try {
      // Generate the PDF bytes
      const pdfBytes = await generatePdfWithLayout(transformedText, extractedPdfData, options);
      
      // Create a blob and download
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Ensure filename ends with .pdf
      let safeFilename = filename;
      if (!safeFilename.toLowerCase().endsWith('.pdf')) {
        safeFilename += '.pdf';
      }
      
      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);
      
      return true;
    } catch (err) {
      console.error('Failed to download PDF with layout:', err);
      throw err;
    }
  }, [generatePdfWithLayout]);

  /**
   * Flag indicating that layout preservation is supported
   * @type {boolean}
   */
  const supportsLayoutPreservation = true;

  return {
    // State
    isGenerating,
    generationError,
    
    // Functions - Original jsPDF-based (for backward compatibility)
    generatePdf,
    downloadPdf,
    generateAndDownloadPdf,
    clearError,
    reset,
    
    // Functions - New pdf-lib-based (for layout preservation)
    generatePdfWithLayout,
    generateAndDownloadPdfWithLayout,
    
    // Feature flags
    supportsLayoutPreservation,
  };
};

export default usePdfGenerator;