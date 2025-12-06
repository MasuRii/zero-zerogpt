import React, { useCallback, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Edit as EditIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { usePdfGenerator } from '../hooks/usePdfGenerator';

/**
 * PdfDownloader Component
 * 
 * A Material UI styled component for generating and downloading PDFs from text.
 * Supports customizable filenames and displays loading/error states.
 * 
 * @param {Object} props - Component props
 * @param {string} props.text - The text content to generate PDF from
 * @param {string} props.defaultFilename - Default filename for the PDF (optional)
 * @param {Function} props.onDownloadComplete - Callback when download completes (optional)
 * @param {Function} props.onError - Callback when an error occurs (optional)
 * @param {Object} props.theme - MUI theme object for styling (optional)
 * @param {boolean} props.disabled - Whether the download button is disabled (optional)
 * @param {string} props.buttonText - Custom text for the download button (optional)
 * @param {string} props.variant - Button variant: 'button', 'iconButton', or 'fullWidth' (optional)
 * @param {string} props.size - Button size: 'small', 'medium', or 'large' (optional)
 * @param {Object} props.pdfOptions - Custom PDF generation options (optional)
 */
const PdfDownloader = ({
  text,
  defaultFilename = 'transformed.pdf',
  onDownloadComplete,
  onError,
  theme,
  disabled = false,
  buttonText = 'Download PDF',
  variant = 'button',
  size = 'medium',
  pdfOptions = {}
}) => {
  const [filenameDialogOpen, setFilenameDialogOpen] = useState(false);
  const [customFilename, setCustomFilename] = useState(defaultFilename);
  const [showError, setShowError] = useState(false);
  
  const {
    isGenerating,
    generationError,
    generateAndDownloadPdf,
    clearError
  } = usePdfGenerator();

  /**
   * Handles the download process
   */
  const handleDownload = useCallback(async (filename = customFilename) => {
    try {
      setShowError(false);
      clearError();
      
      // Ensure filename ends with .pdf
      let safeFilename = filename;
      if (!safeFilename.toLowerCase().endsWith('.pdf')) {
        safeFilename += '.pdf';
      }
      
      await generateAndDownloadPdf(text, safeFilename, pdfOptions);
      
      if (onDownloadComplete) {
        onDownloadComplete(safeFilename);
      }
      
      setFilenameDialogOpen(false);
    } catch (err) {
      setShowError(true);
      if (onError) {
        onError(err);
      }
    }
  }, [text, customFilename, pdfOptions, generateAndDownloadPdf, clearError, onDownloadComplete, onError]);

  /**
   * Opens the filename customization dialog
   */
  const handleOpenFilenameDialog = useCallback(() => {
    setCustomFilename(defaultFilename);
    setFilenameDialogOpen(true);
    setShowError(false);
  }, [defaultFilename]);

  /**
   * Closes the filename customization dialog
   */
  const handleCloseFilenameDialog = useCallback(() => {
    setFilenameDialogOpen(false);
    setShowError(false);
    clearError();
  }, [clearError]);

  /**
   * Handles Enter key in filename input
   */
  const handleFilenameKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !isGenerating && text) {
      handleDownload(customFilename);
    }
  }, [customFilename, isGenerating, text, handleDownload]);

  /**
   * Dismisses the error alert
   */
  const handleDismissError = useCallback(() => {
    setShowError(false);
    clearError();
  }, [clearError]);

  // Determine if download should be disabled
  const isDisabled = disabled || !text || text.trim().length === 0 || isGenerating;

  // Render icon button variant
  if (variant === 'iconButton') {
    return (
      <>
        <Tooltip title={isDisabled ? 'No text available' : buttonText}>
          <span>
            <IconButton
              onClick={() => handleDownload(defaultFilename)}
              disabled={isDisabled}
              color="primary"
              size={size}
              sx={{
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)'
                },
                '&:active': {
                  transform: 'scale(0.95)'
                }
              }}
            >
              {isGenerating ? (
                <CircularProgress size={size === 'small' ? 16 : 24} />
              ) : (
                <DownloadIcon fontSize={size} />
              )}
            </IconButton>
          </span>
        </Tooltip>
        
        {showError && generationError && (
          <Alert 
            severity="error" 
            sx={{ mt: 1 }}
            onClose={handleDismissError}
          >
            {generationError}
          </Alert>
        )}
      </>
    );
  }

  // Render full-width button variant with filename dialog
  if (variant === 'fullWidth') {
    return (
      <Box sx={{ width: '100%' }}>
        {showError && generationError && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            onClose={handleDismissError}
          >
            {generationError}
          </Alert>
        )}
        
        <Button
          variant="contained"
          color="primary"
          startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : <PdfIcon />}
          endIcon={<EditIcon fontSize="small" />}
          onClick={handleOpenFilenameDialog}
          disabled={isDisabled}
          fullWidth
          size={size}
          sx={{
            py: 1.5,
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: 3
            }
          }}
        >
          {isGenerating ? 'Generating...' : buttonText}
        </Button>

        {/* Filename Customization Dialog */}
        <Dialog 
          open={filenameDialogOpen} 
          onClose={handleCloseFilenameDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PdfIcon color="error" />
              <Typography variant="h6">Download PDF</Typography>
            </Box>
            <IconButton onClick={handleCloseFilenameDialog} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Customize the filename for your PDF download.
            </Typography>
            
            <TextField
              autoFocus
              fullWidth
              label="Filename"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              onKeyPress={handleFilenameKeyPress}
              placeholder="Enter filename"
              helperText=".pdf extension will be added automatically if not included"
              disabled={isGenerating}
              InputProps={{
                endAdornment: (
                  <Typography variant="body2" color="textSecondary">
                    {!customFilename.toLowerCase().endsWith('.pdf') && '.pdf'}
                  </Typography>
                )
              }}
            />
            
            {showError && generationError && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={handleDismissError}>
                {generationError}
              </Alert>
            )}
          </DialogContent>
          
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleCloseFilenameDialog} disabled={isGenerating}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              onClick={() => handleDownload(customFilename)}
              disabled={!customFilename.trim() || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Download'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Default button variant
  return (
    <Box>
      {showError && generationError && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={handleDismissError}
        >
          {generationError}
        </Alert>
      )}
      
      <Button
        variant="contained"
        color="primary"
        startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
        onClick={() => handleDownload(defaultFilename)}
        disabled={isDisabled}
        size={size}
        sx={{
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 3
          },
          '&:active': {
            transform: 'translateY(0)'
          }
        }}
      >
        {isGenerating ? 'Generating...' : buttonText}
      </Button>
    </Box>
  );
};

export default PdfDownloader;