import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Typography, IconButton, TextField, Button, CircularProgress } from '@mui/material';
import { Dialog } from '../../components/Dialog';
import { RootState } from '../../store/store';
import { closeNewLocationWindow } from '../../store/modalSlice';
import { useCreateLocationMutation } from '../../api/locationApi/locationApi';

export function NewLocationWindow() {
  const dispatch = useDispatch();
  const { isOpen, position, floorId } = useSelector(
    (state: RootState) => state.modal.newLocationWindowModal
  );
  const [createLocation, { isLoading }] = useCreateLocationMutation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setName('');
    setDescription('');
    setError(null);
    dispatch(closeNewLocationWindow());
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!position) return;

    setError(null);
    try {
      await createLocation({
        location_name: name.trim(),
        description: description.trim() || undefined,
        x: position.x,
        y: position.y,
        z: position.z,
        floorId: floorId || undefined,
      }).unwrap();

      handleClose();
    } catch {
      setError('Could not create tag. Please try again.');
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[360px]"
      PaperProps={{
        sx: {
          borderRadius: '32px',
          overflow: 'hidden',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          padding: '20px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
        <Typography
          sx={{ fontWeight: 700, fontSize: '16px', color: '#FFFFFF', flex: 1, textAlign: 'center' }}
        >
          Create new tag
        </Typography>
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{ color: 'white', opacity: 0.7, '&:hover': { opacity: 1 } }}
        >
          <img src="/icons/mattertag/cross.svg" alt="Close" width={16} height={16} />
        </IconButton>
      </Box>

      {/* Form */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', px: 1 }}>
        <TextField
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          fullWidth
          autoFocus
          size="small"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: 'white',
              borderRadius: '12px',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.8)' },
            },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
            '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
          }}
        />

        <TextField
          label="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={3}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              color: 'white',
              borderRadius: '12px',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.8)' },
            },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
            '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
          }}
        />

        {error && (
          <Typography sx={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>
            {error}
          </Typography>
        )}
      </Box>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isLoading || !name.trim()}
        fullWidth
        sx={{
          mx: 1,
          width: 'calc(100% - 16px)',
          height: 44,
          borderRadius: '22px',
          background: 'rgba(255, 255, 255, 0.15)',
          color: 'white',
          fontWeight: 600,
          fontSize: '14px',
          textTransform: 'none',
          '&:hover': { background: 'rgba(255, 255, 255, 0.25)' },
          '&:disabled': { color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)' },
        }}
      >
        {isLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Set tag'}
      </Button>
    </Dialog>
  );
}
