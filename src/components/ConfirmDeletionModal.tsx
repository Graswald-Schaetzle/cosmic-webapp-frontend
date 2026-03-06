import { Dialog } from './Dialog';
import { Box, Typography, Button, IconButton, CircularProgress } from '@mui/material';
import { useState } from 'react';

interface ConfirmDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  itemType: string; // e.g., "Document", "Task", etc.
}

export const ConfirmDeletionModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemType,
}: ConfirmDeletionModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  const handleBack = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      setError(null);

      // Call the provided onConfirm function
      await onConfirm();

      // Success - close modal
      handleBack();
    } catch (error: any) {
      console.error(`Failed to delete ${itemType.toLowerCase()}:`, error);
      setError(`Failed to delete ${itemType.toLowerCase()}`);
    } finally {
      setIsDeleting(false);
    }
  };

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
        },
      }}
    >
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} className="px-[18px]">
        <IconButton
          onClick={handleBack}
          disabled={isDeleting}
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
            '&.Mui-disabled': {
              opacity: 0.5,
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
              fontWeight: 700,
              fontSize: '16px',
              lineHeight: '22px',
              color: '#FFFFFF',
            }}
          >
            {title}
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

      {/* Confirmation Text */}
      <Box
        sx={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 0',
        }}
      >
        <Typography
          sx={{
            fontWeight: 500,
            fontSize: '14px',
            lineHeight: '22px',
            color: '#FFFFFF',
            textAlign: 'center',
          }}
        >
          {message}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: '8px', padding: '0' }}>
        <Button
          onClick={handleBack}
          disabled={isDeleting}
          sx={{
            flex: 1,
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
          onClick={handleDelete}
          disabled={isDeleting}
          sx={{
            flex: 1,
            height: '48px',
            borderRadius: '20px',
            padding: '0 18px',
            backgroundColor: '#FF4747BF',
            color: '#FFFFFF',
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: 'rgba(255, 71, 71, 0.8)',
            },
            '&.Mui-disabled': {
              opacity: 0.5,
              color: '#FFFFFF',
            },
          }}
        >
          {isDeleting ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Delete'}
        </Button>
      </Box>
    </Dialog>
  );
};
