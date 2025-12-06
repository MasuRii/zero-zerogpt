import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using unpkg CDN with proper HTTPS
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Maximum file size allowed (25MB)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Custom hook for handling PDF file upload and text extraction
 * Uses pdfjs-dist for reliable text extraction from PDF documents
 * 
 * @returns {Object} PDF handler state and functions
 */
export const usePdfHandler = () => {
  // State for the PDF file object
  const [pdfFile, setPdfFile] = useState(null);
  
  // State for the extracted text as a single string
  const [pdfText, setPdfText] = useState('');
  
  // State for extracted text organized by page
  const [extractedPages, setExtractedPages] = useState([]);
  
  // State for loading indicator during extraction
  const [isExtracting, setIsExtracting] = useState(false);
  
  // State for any extraction errors
  const [extractionError, setExtractionError] = useState(null);
  
  // Additional metadata state
  const [pageCount, setPageCount] = useState(0);
  const [progress, setProgress] = useState(0);

  /**
   * Validates the uploaded file
   * @param {File} file - The file to validate
   * @throws {Error} If validation fails
   */
  const validateFile = useCallback((file) => {
    if (!file) {
      throw new Error('No file provided');
    }
    
    // Check file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Please upload a PDF file. Only PDF format is supported.');
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
    }
    
    return true;
  }, []);

  /**
   * Extracts text from a PDF file
   * @param {File} file - The PDF file to extract text from
   * @returns {Promise<string>} The extracted text
   */
  const extractTextFromPdf = useCallback(async (file) => {
    setIsExtracting(true);
    setExtractionError(null);
    setProgress(0);
    setPdfText('');
    setExtractedPages([]);

    try {
      // Validate the file first
      validateFile(file);
      
      // Store the file reference
      setPdfFile(file);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const numPages = pdf.numPages;
      setPageCount(numPages);
      
      const pages = [];
      let fullText = '';

      // Extract text from each page
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Process text items and join them
        const pageText = textContent.items
          .filter(item => item.str) // Filter out empty items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        pages.push({
          pageNumber: i,
          text: pageText
        });
        
        // Add page break between pages
        if (pageText) {
          fullText += pageText + '\n\n';
        }
        
        // Update progress
        setProgress(Math.round((i / numPages) * 100));
      }

      const trimmedText = fullText.trim();
      
      // Check if any text was extracted
      if (trimmedText.length < 10) {
        throw new Error(
          'No text could be extracted from this PDF. ' +
          'This may be a scanned document or image-based PDF. ' +
          'Please use a PDF with selectable text.'
        );
      }

      setExtractedPages(pages);
      setPdfText(trimmedText);
      setIsExtracting(false);
      
      return trimmedText;
    } catch (err) {
      // Handle specific PDF.js errors
      let errorMessage = err.message;
      
      if (err.name === 'PasswordException') {
        errorMessage = 'This PDF is password protected. Please provide an unprotected PDF.';
      } else if (err.name === 'InvalidPDFException') {
        errorMessage = 'Invalid or corrupted PDF file. Please try a different file.';
      } else if (err.message.includes('fetch')) {
        errorMessage = 'Failed to load PDF. Please check your internet connection and try again.';
      }
      
      setExtractionError(errorMessage);
      setIsExtracting(false);
      setPdfFile(null);
      
      throw new Error(errorMessage);
    }
  }, [validateFile]);

  /**
   * Clears all PDF-related state
   */
  const clearPdf = useCallback(() => {
    setPdfFile(null);
    setPdfText('');
    setExtractedPages([]);
    setIsExtracting(false);
    setExtractionError(null);
    setPageCount(0);
    setProgress(0);
  }, []);

  /**
   * Gets a preview of the extracted text (first 500 characters)
   * @returns {string} Text preview with ellipsis if truncated
   */
  const getTextPreview = useCallback(() => {
    if (!pdfText) return '';
    const maxLength = 500;
    if (pdfText.length <= maxLength) return pdfText;
    return pdfText.substring(0, maxLength) + '...';
  }, [pdfText]);

  return {
    // State
    pdfFile,
    setPdfFile,
    pdfText,
    extractedPages,
    isExtracting,
    extractionError,
    pageCount,
    progress,
    
    // Functions
    extractTextFromPdf,
    clearPdf,
    getTextPreview,
  };
};

export default usePdfHandler;