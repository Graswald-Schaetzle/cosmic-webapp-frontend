import { Menu, MenuItem } from '@mui/material';
import { Box } from '@mui/material';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recurring: string) => void;
  currentRecurring: string;
  anchorEl: HTMLElement | null;
}

const recurringOptions = [
  { name: 'No', id: 1 },
  { name: 'Daily', id: 2 },
  { name: 'Semiweekly', id: 3 },
  { name: 'Weekly', id: 4 },
  { name: 'Monthly', id: 5 },
  { name: 'Quarterly', id: 6 },
  { name: 'Semiyearly', id: 7 },
  { name: 'Yearly', id: 8 },
];

export const RecurringModal = ({
  isOpen,
  onClose,
  onSelect,
  currentRecurring,
  anchorEl,
}: RecurringModalProps) => {
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
          mt: '-50px',
          ml: '20px',
          borderRadius: '20px',
          padding: '8px',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          overflowY: 'auto',
          maxHeight: '300px',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE and Edge
        }}
      >
        {recurringOptions.map(option => (
          <MenuItem
            key={option.id}
            onClick={() => {
              onSelect(option.name);
              onClose();
            }}
            sx={{
              color: '#fff',
              padding: '2px 10px',
              borderRadius: '14px',
              height: '54px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              opacity: option.name === currentRecurring ? 0.5 : 1,
              '&:hover': {
                backgroundColor: '#FFFFFF40',
              },
              mb: 0.5,
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
              {option.name}
            </Box>
          </MenuItem>
        ))}
      </Box>
    </Menu>
  );
};
