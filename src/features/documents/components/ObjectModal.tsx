import { Menu, MenuItem, TextField, Box, CircularProgress } from '@mui/material';
import { useState, useMemo } from 'react';
import { useLocations } from '../../../hooks/useLocations';
import { LocationItem } from '../../../api/locationApi/locationApi';

interface ObjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (object: { name: string; room_id: number; id: string }) => void;
  currentObject: { name: string; id: string; room_id?: number } | null;
  anchorEl: HTMLElement | null;
  marginTop?: string;
  marginLeft?: string;
}

export const ObjectModal = ({
  isOpen,
  onClose,
  onSelect,
  currentObject,
  anchorEl,
  marginTop,
  marginLeft,
}: ObjectModalProps) => {
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
          ml: marginLeft || '20px',
          borderRadius: '20px',
          padding: '0 8px',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '300px',
          overflow: 'hidden',
        },
      }}
    >
      <TextField
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search"
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
          overflowY: 'auto',
          maxHeight: 'calc(300px - 50px)',
          '&::-webkit-scrollbar': {
            width: '0px',
            display: 'none',
          },
          '&::-webkit-scrollbar-track': {
            display: 'none',
          },
          '&::-webkit-scrollbar-thumb': {
            display: 'none',
          },
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
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
                onSelect({
                  name: item.location_name,
                  id: item.location_id,
                  room_id: item.room_id,
                });
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
                opacity: currentObject?.id === item.location_id ? 0.5 : 1,
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
