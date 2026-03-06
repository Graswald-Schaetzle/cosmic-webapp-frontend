import { Menu, MenuItem } from '@mui/material';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (status: string) => void;
  currentStatus: string;
  anchorEl: HTMLElement | null;
}

const statusOptions = ['To Do', 'In Progress', 'Done', 'Overdue'];

export const StatusModal = ({
  isOpen,
  onClose,
  onSelect,
  currentStatus,
  anchorEl,
}: StatusModalProps) => {
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
          mt: '-56px',
          ml: '24px',
          borderRadius: '20px',
          padding: '0px 8px',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          '& .MuiMenuItem-root': {
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            padding: '0px 8px',
            borderRadius: '14px',
            height: '42px',
            lineHeight: '22px',
            display: 'flex',
            alignItems: 'center',
            '&:hover': {
              backgroundColor: '#FFFFFF40',
            },
          },
        },
      }}
    >
      {statusOptions.map(status => (
        <MenuItem
          key={status}
          onClick={() => {
            onSelect(status);
            onClose();
          }}
          sx={{
            opacity: status === currentStatus ? 0.5 : 1,
          }}
        >
          {status}
        </MenuItem>
      ))}
    </Menu>
  );
};
