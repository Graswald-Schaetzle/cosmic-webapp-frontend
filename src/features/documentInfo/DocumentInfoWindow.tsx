import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store.ts';
import { Dialog } from '../../components/Dialog';
import {
  closeDocumentInfoWindow,
  openDocumentsWindow,
  openMatterTagWindow,
} from '../../store/modalSlice.ts';
import { Box, Typography, IconButton, TextField, CircularProgress, Button } from '@mui/material';
import { useState, useEffect } from 'react';
import {
  useGetDocumentByIdQuery,
  useDeleteDocumentMutation,
} from '../../api/documents/documentApi';
import { useCreateNotificationMutation } from '../../api/notifications/notificationApi';
import { createDocumentDeletedNotification } from '../../utils/notificationUtils';
import { ConfirmDeletionModal } from '../../components/ConfirmDeletionModal';

// Helper function to check if file is an image
const isImageFile = (fileUrl: string): boolean => {
  const fileExtension = fileUrl?.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension || '');
};

// Helper function to construct document URL
const constructDocumentUrl = (fileUrl: string, signedUrl?: string): string => {
  if (signedUrl) {
    return `${signedUrl}&t=${Date.now()}`;
  }

  const fullUrl = fileUrl.startsWith('http')
    ? fileUrl
    : `${import.meta.env.VITE_API_BASE_URL}/${fileUrl}`;
  return `${fullUrl}?t=${Date.now()}`;
};

export const DocumentInfoWindow = () => {
  const dispatch = useDispatch();
  const { isOpen, docId, redirectBack } = useSelector(
    (state: RootState) => state.modal.documentInfoWindowModal
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [isLoading, setIsLoading] = useState(true);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [documentName, setDocumentName] = useState('Document Name');
  const [tempDocumentName, setTempDocumentName] = useState('Document Name');
  const [isImage, setIsImage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // API mutation for deleting documents
  const [deleteDocument] = useDeleteDocumentMutation();
  const [createNotification] = useCreateNotificationMutation();

  // Fetch document information from API
  const {
    data: documentData,
    isLoading: isDocumentLoading,
    error: documentError,
  } = useGetDocumentByIdQuery(docId || '', {
    skip: !docId,
  });

  useEffect(() => {
    // Reset states when modal opens
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      setIsEditMode(false);
      setCurrentPage(1);
      setPageInput('1');
      setIsImage(false);
    }
  }, [isOpen]);

  useEffect(() => {
    // Update document information when API data is loaded
    if (documentData?.data) {
      const document = documentData.data;
      setDocumentName(document.name);
      setTempDocumentName(document.name);

      // Set the document URL from the API response
      if (document.file_signed_url || document.storage_path) {
        const url = constructDocumentUrl(
          document.storage_path || '',
          document.file_signed_url || undefined
        );
        setPdfUrl(url);
        setIsFileLoading(true); // Start file loading

        // Check if it's an image file
        const imageFile = isImageFile(document.storage_path || '');
        setIsImage(imageFile);

        // Reset page controls for images
        if (imageFile) {
          setTotalPages(1);
          setCurrentPage(1);
          setPageInput('1');
        }
      } else {
        setError('No file URL available for this document');
        setPdfUrl('');
      }

      setIsLoading(false);
    } else if (documentError) {
      setError('Failed to load document information');
      setIsLoading(false);
    }
  }, [documentData, documentError]);

  const handleClose = () => {
    dispatch(closeDocumentInfoWindow());
  };

  const handleBack = () => {
    handleClose();

    // Handle redirect back based on redirectBack info
    if (redirectBack?.type === 'mattertag' && redirectBack.tagData) {
      dispatch(
        openMatterTagWindow({
          tag: redirectBack.tagData,
          activeTab: 1, // Documents tab
        })
      );
    } else {
      dispatch(openDocumentsWindow());
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!docId || !documentData?.data) return;

    try {
      await deleteDocument(docId).unwrap();

      // Create notification for document deletion
      await createDocumentDeletedNotification(
        createNotification,
        documentData.data.name,
        'Unknown Location', // You might want to get location name from document data
        documentData.data.location_id || undefined
      );

      // Success - close modals and go back based on redirectBack info
      dispatch(closeDocumentInfoWindow());

      if (redirectBack?.type === 'mattertag' && redirectBack.tagData) {
        dispatch(
          openMatterTagWindow({
            tag: redirectBack.tagData,
            activeTab: 1, // Documents tab
          })
        );
      } else {
        dispatch(openDocumentsWindow());
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
      // Error handling is done in the ConfirmDeletionModal component
    }
  };

  const toggleEditMode = () => {
    setTempDocumentName(documentName);
    setIsEditMode(!isEditMode);
  };

  const handleSave = () => {
    setDocumentName(tempDocumentName);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    setTempDocumentName(documentName);
    setIsEditMode(false);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
      updateIframePage(newPage);
    }
  };

  const handlePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (/^\d*$/.test(value)) {
      setPageInput(value);
      const pageNum = parseInt(value);
      if (pageNum >= 1 && pageNum <= totalPages) {
        setCurrentPage(pageNum);
        updateIframePage(pageNum);
      }
    }
  };

  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInput);
    if (pageNum < 1) {
      setPageInput('1');
      setCurrentPage(1);
    } else if (pageNum > totalPages) {
      setPageInput(totalPages.toString());
      setCurrentPage(totalPages);
    }
  };

  const updateIframePage = (page: number) => {
    const iframe = document.getElementById('pdf-viewer') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = `${pdfUrl}#page=${page}&toolbar=0&navpanes=0&scrollbar=0`;
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setIsFileLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setIsFileLoading(false);
    setError('Failed to load document. Please try again.');
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = documentName || 'document.pdf';
    link.click();
  };

  // Show loading state while fetching document data
  if (isDocumentLoading) {
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="w-[590px] max-h-[90vh]"
        PaperProps={{
          sx: {
            borderRadius: '32px',
            overflow: 'hidden',
            backgroundColor: 'rgba(46, 46, 46, 0.35)',
            backdropFilter: 'blur(100px)',
            WebkitBackdropFilter: 'blur(100px)',
            padding: '20px 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            height: '90vh',
            maxHeight: '90vh',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <CircularProgress sx={{ color: '#FFFFFF' }} />
        </Box>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[590px] max-h-[90vh]"
      PaperProps={{
        sx: {
          borderRadius: '32px',
          overflow: 'hidden',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          padding: '20px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          height: '90vh',
          maxHeight: '90vh',
        },
      }}
    >
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} className="px-[18px]">
        <IconButton
          onClick={isEditMode ? handleDelete : handleBack}
          size="small"
          aria-label={isEditMode ? 'Delete' : 'Back'}
          sx={{
            position: 'absolute',
            left: '18px',
            width: '40px',
            height: '40px',
            padding: 0,
            borderRadius: '100px',
            backgroundColor: isEditMode ? '#FF474780' : 'transparent',
            '&:hover': {
              backgroundColor: isEditMode ? '#FF4747' : 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <img
            src={isEditMode ? '/icons/mattertag/delete.svg' : '/icons/mattertag/arrow-left.svg'}
            alt={isEditMode ? 'Delete' : 'Back'}
            style={{ width: isEditMode ? '24px' : '40px', height: isEditMode ? '24px' : '40px' }}
          />
        </IconButton>
        <Box display="flex" alignItems="center" flex={1} justifyContent="center">
          {isEditMode ? (
            <TextField
              value={tempDocumentName}
              onChange={e => setTempDocumentName(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#00000026',
                  height: '42px',
                  borderRadius: '14px',
                  '& fieldset': {
                    border: 'none',
                  },
                  '&:hover fieldset': {
                    border: 'none',
                  },
                  '&.Mui-focused fieldset': {
                    border: 'none',
                  },
                  '& input': {
                    color: '#FFFFFF',
                    textAlign: 'center',
                    fontSize: '20px',
                    fontWeight: 700,
                  },
                },
              }}
            />
          ) : (
            <Typography
              sx={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#FFFFFF',
              }}
            >
              {documentName}
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={toggleEditMode}
          size="small"
          aria-label="Edit tag"
          sx={{
            position: 'absolute',
            right: '18px',
            width: '40px',
            height: '40px',
            padding: 0,
            borderRadius: '100px',
            backgroundColor: isEditMode ? '#FFFFFF' : 'transparent',
            '&:hover': {
              backgroundColor: isEditMode ? '#FFFFFF' : 'rgba(255, 255, 255, 0.1)',
            },
            '& img': {
              width: '40px',
              height: '40px',
            },
          }}
        >
          <img
            src="/icons/mattertag/edit.svg"
            alt="Edit"
            style={{
              filter: isEditMode ? 'brightness(0)' : 'none',
            }}
          />
        </IconButton>
      </Box>

      {/* Content - Document Viewer */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {(isLoading || isFileLoading) && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1,
              borderRadius: '16px',
            }}
          >
            <CircularProgress sx={{ color: '#FFFFFF' }} />
          </Box>
        )}
        {error && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1,
              borderRadius: '16px',
            }}
          >
            <Typography sx={{ color: '#FFFFFF' }}>{error}</Typography>
          </Box>
        )}
        <Box
          sx={{
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            opacity: isEditMode ? 0.5 : 1,
          }}
        >
          {pdfUrl &&
            (isImage ? (
              // Render image
              <img
                src={pdfUrl}
                alt={documentName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '16px',
                }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            ) : (
              // Render PDF
              <iframe
                id="pdf-viewer"
                src={`${pdfUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0&view=FitH&pagemode=none`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: 'transparent',
                  transform: 'scale(1)',
                  transformOrigin: 'center center',
                  borderRadius: '16px',
                  objectFit: 'contain',
                  padding: 0,
                  margin: 0,
                }}
                scrolling="no"
                onLoad={e => {
                  handleIframeLoad();
                  // Try to get total pages from the iframe
                  try {
                    const iframe = e.target as HTMLIFrameElement;
                    if (iframe.contentWindow) {
                      // @ts-expect-error - PDF.js injects this property at runtime
                      const numPages = iframe.contentWindow.PDFViewerApplication?.pagesCount;
                      if (numPages) {
                        setTotalPages(numPages);
                      }
                    }
                  } catch (err) {
                    console.error('Error getting page count:', err);
                  }
                }}
                onError={handleIframeError}
              />
            ))}
        </Box>
      </Box>

      {/* Footer */}
      {isEditMode ? (
        <Box sx={{ display: 'flex', gap: '8px', padding: '0', justifyContent: 'center' }}>
          <Button
            onClick={handleCancel}
            sx={{
              width: '174px',
              height: '48px',
              borderRadius: '20px',
              padding: '0 18px',
              backgroundColor: 'transparent',
              color: '#FFFFFF',
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            sx={{
              width: '174px',
              height: '48px',
              borderRadius: '20px',
              padding: '0 18px',
              backgroundColor: '#00000026',
              color: '#FFFFFF',
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
              },
            }}
          >
            Save
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
            height: '48px',
            borderRadius: '16px',
          }}
        >
          <IconButton
            onClick={handleDownload}
            sx={{
              width: '24px',
              height: '24px',
              padding: 0,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <img src="/icons/icon-download.svg" alt="Download" />
          </IconButton>

          {/* Page controls - only show for PDFs */}
          {!isImage && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <IconButton
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isLoading || isFileLoading}
                sx={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '100px',
                  bgcolor: 'transparent',
                  '&:hover': {
                    bgcolor: '#FFFFFF26',
                  },
                  '&.Mui-disabled': {
                    opacity: 0.5,
                  },
                }}
              >
                <img src="/icons/mattertag/short-arrow-left.svg" alt="Previous" />
              </IconButton>

              <TextField
                value={pageInput}
                onChange={handlePageInputChange}
                onBlur={handlePageInputBlur}
                disabled={isLoading || isFileLoading}
                inputProps={{
                  style: {
                    width: '55px',
                    height: '40px',
                    padding: '8px 24px',
                    borderRadius: '500px',
                    color: '#FFFFFF',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 500,
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'transparent',
                    '& fieldset': {
                      border: 'none',
                    },
                    '&:hover fieldset': {
                      border: 'none',
                    },
                    '&.Mui-focused fieldset': {
                      border: 'none',
                    },
                  },
                }}
              />

              <IconButton
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || isLoading || isFileLoading}
                sx={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '100px',
                  bgcolor: 'transparent',
                  '&:hover': {
                    bgcolor: '#FFFFFF26',
                  },
                  '&.Mui-disabled': {
                    opacity: 0.5,
                  },
                }}
              >
                <img src="/icons/mattertag/short-arrow-right.svg" alt="Next" />
              </IconButton>
            </Box>
          )}

          {/* Spacer for alignment - adjust based on content */}
          <Box sx={{ width: isImage ? '24px' : '24px' }} />
        </Box>
      )}

      {/* Document Deletion Confirmation Modal */}
      <ConfirmDeletionModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Document"
        message="Do you want to delete this Document?"
        itemType="Document"
      />
    </Dialog>
  );
};
