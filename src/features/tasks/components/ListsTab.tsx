import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  CircularProgress,
} from '@mui/material';
import { openNewListWindow, openListWindow } from '../../../store/modalSlice.ts';
import { useDispatch } from 'react-redux';
import { useGetListsQuery } from '../../../api/lists/listsApi';
import { useSpace } from '../../../contexts/SpaceContext';

interface ListsTabProps {
  handleClose: () => void;
}

export const ListsTab = ({ handleClose }: ListsTabProps) => {
  const dispatch = useDispatch();
  const { activeSpaceId } = useSpace();

  // Fetch lists from API, scoped to active space
  const { data: listsData, isLoading, error } = useGetListsQuery(
    activeSpaceId ? { space_id: activeSpaceId } : undefined
  );

  const handleListClick = (listId: number) => {
    handleClose();
    dispatch(openListWindow(listId));
  };

  const handleNewListClick = () => {
    handleClose();
    dispatch(openNewListWindow());
  };

  // Show loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: 'white' }} />
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <Box sx={{ color: 'white', textAlign: 'center' }}>Error loading lists</Box>
      </Box>
    );
  }

  const lists = listsData?.data || [];

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', minHeight: 0 }}
    >
      {/* New List Button */}
      <Button
        variant="outlined"
        onClick={handleNewListClick}
        startIcon={<img src="/icons/mattertag/plus.svg" alt="Add" />}
        fullWidth
        sx={{
          justifyContent: 'flex-start',
          width: '356px',
          height: '48px',
          minHeight: '48px',
          maxHeight: '48px',
          textTransform: 'none',
          bgcolor: 'rgba(0, 0, 0, 0.15)',
          border: 'none',
          borderRadius: '20px',
          color: '#FFFFFF',
          padding: '0 8px 0 18px',
          gap: '16px',
          fontWeight: 600,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0px',
          verticalAlign: 'middle',
          '&:hover': {
            bgcolor: '#FFFFFF26',
            border: 'none',
          },
          '& .MuiButton-startIcon': {
            margin: 0,
          },
        }}
      >
        New List
      </Button>
      <Paper
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: 'rgba(0, 0, 0, 0.15)',
          borderRadius: '20px',
          boxShadow: 'none',
          minHeight: 0,
          '&::-webkit-scrollbar': {
            width: '0px',
            background: 'transparent',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'transparent',
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <List disablePadding>
          {lists.map(list => (
            <ListItem
              key={list.list_id}
              disablePadding
              sx={{
                mb: 0,
                borderWidth: '1px 0 1px 0',
                borderStyle: 'solid',
                borderColor: '#FFFFFF40',
                '&:first-of-type': {
                  borderTop: 'none',
                },
                '&:last-of-type': {
                  borderBottom: 'none',
                },
              }}
            >
              <ListItemButton
                onClick={() => handleListClick(list.list_id)}
                sx={{
                  bgcolor: 'transparent',
                  height: '48px',
                  px: 2.25,
                  '&:hover': {
                    bgcolor: '#FFFFFF26',
                    '& .arrow-icon': {
                      display: 'block',
                    },
                  },
                }}
              >
                <ListItemText
                  primary={list.name}
                  primaryTypographyProps={{
                    sx: {
                      fontSize: '14px',
                      fontWeight: 500,
                      lineHeight: '22px',
                      color: '#FFFFFF',
                    },
                  }}
                />
                <Box
                  className="arrow-icon"
                  sx={{
                    display: 'none',
                    position: 'absolute',
                    right: '18px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <img src="/icons/mattertag/arrow-right.svg" alt="Arrow right" />
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};
