import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Dialog } from '../../components/Dialog';
import { RootState } from '../../store/store';
import { closeNewLocationWindow } from '../../store/modalSlice';
import { useCreateLocationMutation } from '../../api/locationApi/locationApi';
import { useGetMySpacesQuery } from '../../api/spaces/spacesApi';
import { useGetUsersQuery } from '../../api/userMenu/userMenuApi';

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    borderRadius: '12px',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
    '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.8)' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
};

const selectSx = {
  color: 'white',
  borderRadius: '12px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.6)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
};

export function NewLocationWindow() {
  const dispatch = useDispatch();
  const { isOpen, position, floorId } = useSelector(
    (state: RootState) => state.modal.newLocationWindowModal
  );
  const { data: spaces } = useGetMySpacesQuery();
  const spaceId = spaces?.[0]?.space_id ?? null;
  const [createLocation, { isLoading }] = useCreateLocationMutation();
  const { data: usersData } = useGetUsersQuery();

  const [tagType, setTagType] = useState<'object' | 'room'>('object');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setName('');
    setDescription('');
    setResponsibleUserId('');
    setError(null);
    setTagType('object');
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
      const result = await createLocation({
        location_name: name.trim(),
        description: description.trim() || undefined,
        x: position.x,
        y: position.y,
        z: position.z,
        floorId: floorId || undefined,
        spaceId: spaceId,
        tag_type: tagType,
        responsible_user_id: tagType === 'room' && responsibleUserId !== '' ? responsibleUserId : null,
      }).unwrap();

      if (result.error) {
        setError('Could not save tag. Please try again.');
        return;
      }

      // Tag injection is handled by Matterport.tsx re-injection effect,
      // which runs automatically when getAllLocations refetches after cache invalidation.
      // This ensures the sid→location mapping is built correctly for the detail window.

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

      {/* Type toggle */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'rgba(0, 0, 0, 0.15)',
          p: '4px',
          borderRadius: '100px',
          display: 'flex',
          alignItems: 'center',
          mx: 1,
        }}
      >
        <Tabs
          value={tagType === 'object' ? 0 : 1}
          onChange={(_, v) => setTagType(v === 0 ? 'object' : 'room')}
          variant="fullWidth"
          sx={{
            width: '100%',
            minHeight: 'unset',
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTabs-flexContainer': { gap: '6px', height: '36px' },
            '& .MuiTab-root': {
              height: '36px',
              borderRadius: '20px',
              textTransform: 'none',
              fontWeight: 600,
              color: '#FFFFFF',
              fontSize: '14px',
              padding: 0,
              minHeight: 'unset',
              transition: 'background-color 0.2s',
              '&.Mui-selected': {
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
              },
              '&:not(.Mui-selected):hover': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
              },
            },
          }}
        >
          <Tab label="Object" />
          <Tab label="Room" />
        </Tabs>
      </Paper>

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
          sx={textFieldSx}
        />

        <TextField
          label="Notes (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={3}
          size="small"
          sx={textFieldSx}
        />

        {tagType === 'room' && (
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: 'rgba(255,255,255,0.6)', '&.Mui-focused': { color: 'white' } }}>
              Responsible (optional)
            </InputLabel>
            <Select
              value={responsibleUserId}
              onChange={e => setResponsibleUserId(e.target.value as number | '')}
              label="Responsible (optional)"
              sx={selectSx}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: 'rgba(46, 46, 46, 0.95)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '12px',
                    '& .MuiMenuItem-root': {
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                      '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.15)' },
                    },
                  },
                },
              }}
            >
              <MenuItem value="">
                <em style={{ color: 'rgba(255,255,255,0.5)' }}>None</em>
              </MenuItem>
              {usersData?.users?.map(user => (
                <MenuItem key={user.user_id} value={user.user_id}>
                  {user.first_name} {user.last_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

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
