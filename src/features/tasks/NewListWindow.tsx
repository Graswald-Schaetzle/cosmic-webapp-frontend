import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store.ts';
import { Dialog } from '../../components/Dialog';
import { closeNewListWindow, openTasksWindow } from '../../store/modalSlice.ts';
import { useCreateListMutation } from '../../api/lists/listsApi';
import { useCreateNotificationMutation } from '../../api/notifications/notificationApi';
import { createListCreatedNotification } from '../../utils/notificationUtils';

import { Box, Typography, IconButton, TextField } from '@mui/material';

export const NewListWindow = () => {
  const dispatch = useDispatch();
  const { isOpen } = useSelector((state: RootState) => state.modal.newListWindowModal);
  const [createList] = useCreateListMutation();
  const [createNotification] = useCreateNotificationMutation();

  const [listName, setListName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setListName('');
    setIsSubmitting(false);
    dispatch(closeNewListWindow());
    dispatch(openTasksWindow({ activeTab: 1 }));
  };

  const handleSave = async () => {
    if (!listName.trim()) return;

    setIsSubmitting(true);
    try {
      await createList({
        name: listName.trim(),
        task_ids: [],
      }).unwrap();

      // Create notification for list creation
      await createListCreatedNotification(createNotification, listName.trim());

      handleClose();
    } catch (error) {
      console.error('Failed to create list:', error);
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[380px] max-w-full max-h-[644px]"
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
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              m: 0,
              fontWeight: 700,
              fontSize: '20px',
              lineHeight: '32px',
              color: '#FFFFFF',
              textAlign: 'center',
            }}
          >
            New List
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="Close"
          sx={{
            position: 'absolute',
            right: '18px',
          }}
        >
          <img src="/icons/mattertag/cross.svg" alt="Close" />
        </IconButton>
      </Box>

      <TextField
        multiline
        value={listName}
        onChange={e => setListName(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="List name"
        variant="outlined"
        fullWidth
        disabled={isSubmitting}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '20px',
            background: '#00000026',
            backgroundColor: '#00000026',
            color: '#fff',
            padding: '0 8px',
            minHeight: '42px',
            '& fieldset': {
              border: 'none',
            },
            '&:hover fieldset': {
              border: 'none',
            },
            '&.Mui-focused fieldset': {
              border: 'none',
            },
            '& textarea': {
              color: '#fff',
              fontWeight: 500,
              fontSize: 14,
              padding: '12px 18px',
              '&::placeholder': {
                color: '#fff',
                opacity: 0.5,
              },
            },
          },
        }}
      />

      <Box
        component="button"
        type="button"
        onClick={handleSave}
        disabled={!listName.trim() || isSubmitting}
        sx={{
          width: '100%',
          height: '48px',
          padding: '0 18px',
          background: listName.trim() && !isSubmitting ? '#00000026' : 'rgba(0, 0, 0, 0.1)',
          border: 'none',
          borderRadius: '500px',
          color: listName.trim() && !isSubmitting ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)',
          fontWeight: 600,
          fontSize: '14px',
          lineHeight: '22px',
          cursor: listName.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s',
          '&:hover': {
            background: listName.trim() && !isSubmitting ? '#FFFFFF26' : 'rgba(0, 0, 0, 0.1)',
            backgroundColor: listName.trim() && !isSubmitting ? '#4E4E4E33' : 'rgba(0, 0, 0, 0.1)',
            backgroundBlendMode: 'color-dodge',
          },
        }}
      >
        {isSubmitting ? 'Creating...' : 'Save'}
      </Box>
    </Dialog>
  );
};
