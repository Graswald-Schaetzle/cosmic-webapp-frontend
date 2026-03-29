import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store.ts';
import { Dialog } from '../../components/Dialog';
import {
  closeAddDocumentWindow,
  openDocumentsWindow,
  openMatterTagWindow,
} from '../../store/modalSlice.ts';
import { Box, Typography, IconButton, Button, TextField } from '@mui/material';
import { useCallback, useState, useRef, useEffect } from 'react';
import { ObjectModal } from './components/ObjectModal';
import { useUploadDocumentMutation, DocumentUploadPayload } from '../../api/documents/documentApi';
import { useCreateNotificationMutation } from '../../api/notifications/notificationApi';
import { createDocumentAddedNotification } from '../../utils/notificationUtils';

export const AddDocumentWindow = () => {
  const dispatch = useDispatch();
  const { isOpen, preSelectedLocation, redirectBack } = useSelector(
    (state: RootState) => state.modal.addDocumentWindowModal
  );
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<{
    name: string;
    id: string;
    room_id?: number;
  } | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const objectButtonRef = useRef<HTMLDivElement>(null);

  // API mutation for uploading documents
  const [uploadDocument, { isLoading: isUploading }] = useUploadDocumentMutation();
  const [createNotification] = useCreateNotificationMutation();

  // Set pre-selected location when modal opens
  useEffect(() => {
    if (isOpen && preSelectedLocation) {
      const newSelectedObject = {
        name: preSelectedLocation.name,
        id: preSelectedLocation.id,
        room_id: preSelectedLocation.room_id,
      };
      setSelectedObject(newSelectedObject);
    }
  }, [isOpen, preSelectedLocation]);

  const handleClose = useCallback(() => {
    dispatch(closeAddDocumentWindow());
  }, [dispatch]);

  const handleBack = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setSelectedObject(null);
    setDocumentName('');
    setError(null);
    setIsObjectModalOpen(false);
    handleClose();

    // Handle redirect back based on redirectBack info
    if (redirectBack?.type === 'mattertag' && redirectBack.tagData) {
      // Open MatterTagWindow with Documents tab active
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

  const validateFile = (file: File): string | null => {
    // Check file type
    if (file.type !== 'application/pdf') {
      return 'Please select a PDF file';
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
    setDocumentName(file.name.replace('.pdf', ''));

    // Simulate upload progress for file processing
    setUploadProgress(0);
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 100); // Update every 100ms for smooth progress
  }, []);

  const handleBrowseClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    };
    input.click();
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleObjectSelect = useCallback(
    (object: { name: string; id: string; room_id?: number }) => {
      setSelectedObject(object);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!selectedFile || !selectedObject || !documentName.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setError(null);

      // Reset progress for actual upload
      setUploadProgress(0);

      // Create upload data object
      const uploadData: DocumentUploadPayload = {
        file: selectedFile,
        name: documentName.trim(),
      };

      // Add location_id if available
      if (selectedObject.id) {
        uploadData.location_id = selectedObject.id;
      }

      // Add room_id if available
      if (selectedObject.room_id) {
        uploadData.room_id = selectedObject.room_id;
      }

      // Simulate upload progress during actual upload
      const uploadProgressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(uploadProgressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 200);

      // Upload document
      const result = await uploadDocument(uploadData).unwrap();

      // Complete the progress
      clearInterval(uploadProgressInterval);
      setUploadProgress(100);

      if (result.error) {
        throw new Error(result.error);
      }

      // Create notification for document upload
      if (result.data && result.data.length > 0) {
        const uploadedDocument = result.data[0];
        await createDocumentAddedNotification(
          createNotification,
          documentName.trim(),
          selectedObject?.name || 'Unknown Location',
          uploadedDocument.document_id,
          selectedObject?.id
        );
      }

      // Success - close modal and reset state
      handleClose();

      // Handle redirect back based on redirectBack info
      if (redirectBack?.type === 'mattertag' && redirectBack.tagData) {
        // Open MatterTagWindow with Documents tab active
        dispatch(
          openMatterTagWindow({
            tag: redirectBack.tagData,
            activeTab: 1, // Documents tab
          })
        );
      } else {
        dispatch(openDocumentsWindow());
      }
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      setError('Failed to add document');
    }
  }, [
    createNotification,
    dispatch,
    documentName,
    handleClose,
    redirectBack,
    selectedFile,
    selectedObject,
    uploadDocument,
  ]);

  const handleCancel = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(0);
    setSelectedObject(null);
    setDocumentName('');
    setError(null);
  }, []);

  const isFormValid = selectedFile && selectedObject && documentName.trim() && !isUploading;

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[380px] max-h-[600px]"
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
          height: 'auto',
          maxHeight: '600px',
        },
      }}
    >
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} className="px-[18px]">
        <IconButton
          onClick={handleBack}
          size="small"
          aria-label="Back"
          sx={{
            position: 'absolute',
            left: '18px',
            width: '40px',
            height: '40px',
            padding: 0,
            borderRadius: '100px',
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <img
            src="/icons/mattertag/arrow-left.svg"
            alt="Back"
            style={{ width: '40px', height: '40px' }}
          />
        </IconButton>
        <Box display="flex" alignItems="center" flex={1} justifyContent="center">
          <Typography
            sx={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#FFFFFF',
            }}
          >
            Add a Document
          </Typography>
        </Box>
      </Box>

      {/* Error message */}
      {error && (
        <Box
          sx={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 107, 107, 0.2)',
            border: '1px solid rgba(255, 107, 107, 0.5)',
          }}
        >
          <Typography
            sx={{
              color: '#FF6B6B',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {error}
          </Typography>
        </Box>
      )}

      {/* Content */}
      {!selectedFile ? (
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          sx={{
            width: '356px',
            height: '180px',
            borderRadius: '20px',
            padding: '40px 18px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            border: '2px dashed #FFFFFF80',
            background: isDragging ? '#2E2E2E80' : '#2E2E2E59',
            backgroundBlendMode: 'luminosity',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            '&:hover': {
              background: '#2E2E2E80',
            },
          }}
        >
          <Typography
            sx={{
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: '22px',
              textAlign: 'center',
            }}
          >
            Drag and Drop a .pdf document here
          </Typography>

          <Typography
            sx={{
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: '22px',
              textAlign: 'center',
            }}
          >
            or
          </Typography>

          <Box
            sx={{
              width: '124px',
              height: '40px',
              borderRadius: '500px',
              padding: '8px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#00000026',
              '&:hover': {
                backgroundColor: '#00000040',
              },
            }}
          >
            <Typography
              sx={{
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '14px',
                lineHeight: '22px',
              }}
            >
              Browse Files
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* File upload progress */}
          <Box
            sx={{
              width: '100%',
              height: '48px',
              borderRadius: '20px',
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#00000026',
            }}
          >
            <Typography
              sx={{
                color: '#FFFFFF',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '22px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '200px',
              }}
            >
              {selectedFile.name}
            </Typography>
            <Typography
              sx={{
                color: '#FFFFFF',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '22px',
              }}
            >
              {isUploading
                ? `${uploadProgress}%`
                : uploadProgress > 0
                  ? `${uploadProgress}%`
                  : 'Ready'}
            </Typography>
          </Box>

          {/* Document name input */}
          <TextField
            value={documentName}
            onChange={e => setDocumentName(e.target.value)}
            placeholder="Document name"
            variant="outlined"
            size="small"
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                height: '48px',
                borderRadius: '20px',
                background: '#00000026',
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
                  color: '#fff',
                  '&::placeholder': {
                    color: '#fff',
                    opacity: 0.7,
                  },
                },
              },
            }}
          />

          {/* Object selection */}
          <Box height="42px" display="flex" alignItems="center" justifyContent="space-between">
            {/* Left side */}
            <Box
              sx={{
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <Typography color="#fff" sx={{ fontSize: 16, fontWeight: 500 }}>
                Object
              </Typography>
            </Box>
            {/* Right side */}
            <Box
              ref={objectButtonRef}
              onClick={preSelectedLocation ? undefined : () => setIsObjectModalOpen(true)}
              sx={{
                maxWidth: 200,
                height: 40,
                borderRadius: '500px',
                padding: '8px 10px 8px 18px',
                gap: '12px',
                background: preSelectedLocation ? '#5E5E5E2E' : '#5E5E5E2E',
                backgroundColor: preSelectedLocation ? '#00000026' : '#00000033',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: preSelectedLocation ? '#FFFFFF80' : '#fff',
                fontWeight: 600,
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: preSelectedLocation ? 'not-allowed' : 'pointer',
                opacity: preSelectedLocation ? 0.6 : 1,
                '&:hover': {
                  bgcolor: preSelectedLocation ? '#00000026' : '#FFFFFF1A',
                },
              }}
            >
              {selectedObject ? `${selectedObject.name}` : 'Select Object'}
              <Box component="span" ml={1} display="flex" alignItems="center">
                {preSelectedLocation ? (
                  <Typography
                    sx={{
                      color: '#FFFFFF80',
                      fontSize: '10px',
                      fontWeight: 500,
                    }}
                  >
                    LOCKED
                  </Typography>
                ) : (
                  <img
                    src={
                      isObjectModalOpen
                        ? '/icons/mattertag/short-arrow-left.svg'
                        : '/icons/mattertag/short-arrow-right.svg'
                    }
                    alt="arrow"
                    style={{ width: 24, height: 24 }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: '8px', padding: '0', justifyContent: 'center' }}>
            <Button
              onClick={handleCancel}
              disabled={isUploading}
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
                '&.Mui-disabled': {
                  opacity: 0.5,
                  color: '#FFFFFF',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isFormValid}
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
                '&.Mui-disabled': {
                  opacity: 0.5,
                  color: '#FFFFFF',
                },
              }}
            >
              {isUploading ? 'Uploading...' : 'Save'}
            </Button>
          </Box>
        </Box>
      )}

      <ObjectModal
        isOpen={isObjectModalOpen}
        onClose={() => setIsObjectModalOpen(false)}
        onSelect={handleObjectSelect}
        currentObject={selectedObject}
        anchorEl={objectButtonRef.current}
      />
    </Dialog>
  );
};
