import { Menu, MenuItem, Box, CircularProgress, TextField } from '@mui/material';
import { useState, useMemo } from 'react';
import { useGetListsQuery } from '../../../api/lists/listsApi';
import { useSpace } from '../../../contexts/SpaceContext';

interface ListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (listName: string, listId: number) => void;
  currentLists?: Array<{ list_id: number; name: string }>;
  anchorEl: HTMLElement | null;
}

export const ListModal = ({
  isOpen,
  onClose,
  onSelect,
  currentLists = [],
  anchorEl,
}: ListModalProps) => {
  const { activeSpaceId } = useSpace();
  const { data: listsData, isLoading, error } = useGetListsQuery(
    activeSpaceId ? { space_id: activeSpaceId } : undefined
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Filter lists based on search query
  const filteredLists = useMemo(() => {
    const lists = listsData?.data ?? [];
    if (!searchQuery.trim()) return lists;

    return lists.filter(list => {
      return list.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [listsData?.data, searchQuery]);

  // Separate selected and unselected lists
  const selectedLists = filteredLists.filter(list =>
    currentLists.some(selectedList => selectedList.list_id === list.list_id)
  );
  const unselectedLists = filteredLists.filter(
    list => !currentLists.some(selectedList => selectedList.list_id === list.list_id)
  );

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
          width: 190,
          mt: '-56px',
          ml: '24px',
          borderRadius: '20px',
          padding: '8px',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          display: 'flex',
          flexDirection: 'column',
          '& .MuiMenuItem-root': {
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            padding: '6px 8px',
            borderRadius: '14px',
            height: 'auto',
            minHeight: '42px',
            lineHeight: '22px',
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            '&:hover': {
              backgroundColor: '#FFFFFF40',
            },
          },
        },
      }}
    >
      {/* Search Input */}
      <Box sx={{ mb: 1 }}>
        <TextField
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search lists"
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
      </Box>

      {/* Lists List with Invisible Scroll */}
      <Box
        sx={{
          overflowY: 'auto',
          maxHeight: '300px', // Fixed height for the scrollable area
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE and Edge
        }}
      >
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={2}>
            <CircularProgress size={20} sx={{ color: '#fff' }} />
          </Box>
        ) : error ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={2}>
            <Box sx={{ color: '#fff', fontSize: '12px' }}>Error loading lists</Box>
          </Box>
        ) : filteredLists.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={2}>
            <Box sx={{ color: '#fff', fontSize: '12px' }}>
              {searchQuery ? 'No lists found' : 'No lists available'}
            </Box>
          </Box>
        ) : (
          <>
            {/* Selected lists with check icons */}
            {selectedLists.map(list => (
              <MenuItem
                key={list.list_id}
                onClick={() => {
                  onSelect(list.name, list.list_id);
                }}
                sx={{
                  mb: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{list.name}</span>
                <img
                  src="/icons/mattertag/check-icon.svg"
                  alt="Selected"
                  style={{ width: 20, height: 20 }}
                />
              </MenuItem>
            ))}

            {/* Divider if there are both selected and unselected lists */}
            {selectedLists.length > 0 && unselectedLists.length > 0 && (
              <Box
                sx={{
                  height: '1px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  margin: '8px 0',
                }}
              />
            )}

            {/* Unselected lists */}
            {unselectedLists.map(list => (
              <MenuItem
                key={list.list_id}
                onClick={() => {
                  onSelect(list.name, list.list_id);
                }}
                sx={{
                  mb: 0.5,
                }}
              >
                {list.name}
              </MenuItem>
            ))}
          </>
        )}
      </Box>
    </Menu>
  );
};
