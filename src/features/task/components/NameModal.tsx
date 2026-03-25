import { Menu, MenuItem, TextField, Box, CircularProgress } from '@mui/material';
import { useState, useMemo } from 'react';
import { useLocations } from '../../../hooks/useLocations';
import { LocationItem } from '../../../api/locationApi/locationApi';

interface NameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (name: string, locationId: string, matterportTagId: string) => void;
  currentName: string;
  anchorEl: HTMLElement | null;
  marginTop?: string;
  marginLeft?: string;
}

export const NameModal = ({
  isOpen,
  onClose,
  onSelect,
  currentName,
  anchorEl,
  marginTop,
  marginLeft,
}: NameModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Use Redux locations state
  const { locations, isLoading, error } = useLocations();

  const filteredOptions = useMemo(() => {
    if (!locations) return [];

    // Make locations unique by location_id
    const uniqueLocations = locations.reduce((acc, current) => {
      const existingLocation = acc.find(item => item.location_id === current.location_id);
      if (!existingLocation) {
        acc.push(current);
      }
      return acc;
    }, [] as LocationItem[]);

    if (!searchQuery) return uniqueLocations;

    return uniqueLocations.filter(
      item =>
        item.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [locations, searchQuery]);

  return (
    <Menu
      anchorEl={anchorEl}
      open={isOpen}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      PaperProps={{
        sx: {
          mt: marginTop || '-50px',
          ml: marginLeft || '112px',
          borderRadius: '20px',
          padding: '0 8px',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '400px',
          overflow: 'hidden',
        },
      }}
    >
      <TextField
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search locations"
        variant="outlined"
        size="small"
        fullWidth
        sx={{
          '& .MuiOutlinedInput-root': {
            height: '42px',
            borderRadius: '14px',
            background: '#D6D6D673',
            backgroundColor: '#00000014',
            backgroundBlendMode: 'luminosity',
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          mt: '8px',
          overflowY: 'auto',
          maxHeight: 'calc(400px - 60px)',
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '2px',
          },
        }}
      >
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={2}>
            <CircularProgress size={20} sx={{ color: '#fff' }} />
          </Box>
        ) : error ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={2}>
            <Box sx={{ color: '#fff', fontSize: '12px' }}>Error loading locations</Box>
          </Box>
        ) : filteredOptions.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={2}>
            <Box sx={{ color: '#fff', fontSize: '12px' }}>No locations found</Box>
          </Box>
        ) : (
          filteredOptions.map((item: LocationItem) => (
            <MenuItem
              key={item.location_id}
              onClick={() => {
                onSelect(item.location_name, item.location_id, item.location_id);
                onClose();
              }}
              sx={{
                color: '#fff',
                padding: '2px 10px',
                borderRadius: '14px',
                height: '54px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                opacity: item.location_name === currentName ? 0.5 : 1,
                '&:hover': {
                  backgroundColor: '#FFFFFF40',
                },
              }}
            >
              <Box
                sx={{
                  fontWeight: 600,
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: '#FFFFFF',
                }}
              >
                {item.location_name}
              </Box>
              <Box
                sx={{
                  fontWeight: 500,
                  fontSize: '10px',
                  lineHeight: '16px',
                  color: '#FFFFFF',
                }}
              >
                {`Floor: ${item.floor_name}, ${item.room_name}`}
              </Box>
            </MenuItem>
          ))
        )}
      </Box>
    </Menu>
  );
};
