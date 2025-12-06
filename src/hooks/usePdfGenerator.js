import { useState, useCallback, useMemo } from 'react';
import { jsPDF } from 'jspdf';

/**
 * Custom hook for generating and downloading PDF files from text
 * Uses jsPDF for reliable PDF creation with Unicode support
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

  return {
    // State
    isGenerating,
    generationError,
    
    // Functions
    generatePdf,
    downloadPdf,
    generateAndDownloadPdf,
    clearError,
    reset,
  };
};

export default usePdfGenerator;