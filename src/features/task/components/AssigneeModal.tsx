import { Menu, MenuItem, Box, CircularProgress, TextField } from '@mui/material';
import { useState, useMemo } from 'react';
import { useGetUsersQuery } from '../../../api/userMenu/userMenuApi';

interface AssigneeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (assignee: string, userId: number) => void;
  currentAssignee: string;
  anchorEl: HTMLElement | null;
}

export const AssigneeModal = ({
  isOpen,
  onClose,
  onSelect,
  currentAssignee,
  anchorEl,
}: AssigneeModalProps) => {
  const { data: usersData, isLoading, error } = useGetUsersQuery();
  const [searchQuery, setSearchQuery] = useState('');

  const users = usersData?.users || [];

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    return users.filter(user => {
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });
  }, [users, searchQuery]);

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
          placeholder="Search users"
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

      {/* Users List with Invisible Scroll */}
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
            <Box sx={{ color: '#fff', fontSize: '12px' }}>Error loading users</Box>
          </Box>
        ) : filteredUsers.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={2}>
            <Box sx={{ color: '#fff', fontSize: '12px' }}>
              {searchQuery ? 'No users found' : 'No users available'}
            </Box>
          </Box>
        ) : (
          filteredUsers.map(user => {
            const fullName = `${user.first_name} ${user.last_name}`;
            return (
              <MenuItem
                key={user.user_id}
                onClick={() => {
                  onSelect(fullName, user.user_id);
                  onClose();
                }}
                sx={{
                  opacity: fullName === currentAssignee ? 0.5 : 1,
                  mb: 0.5,
                }}
              >
                {fullName}
              </MenuItem>
            );
          })
        )}
      </Box>
    </Menu>
  );
};
