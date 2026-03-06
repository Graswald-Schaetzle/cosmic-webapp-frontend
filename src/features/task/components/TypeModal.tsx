import { Menu, MenuItem } from '@mui/material';

interface TypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
  currentType: string;
  anchorEl: HTMLElement | null;
  marginTop?: string;
  marginLeft?: string;
}

const typeOptions = [
  { id: 1, name: 'Vacuum' },
  { id: 2, name: 'Clean' },
  { id: 3, name: 'Repair' },
  { id: 4, name: 'Wipe' },
  { id: 5, name: 'Empty' },
];

export const TypeModal = ({
  isOpen,
  onClose,
  onSelect,
  currentType,
  anchorEl,
  marginTop,
  marginLeft,
}: TypeModalProps) => {
  return (
    <Menu
      anchorEl={anchorEl}
      open={isOpen}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        sx: {
          mt: marginTop || '-50px',
          ml: marginLeft || '-112px',
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
      {typeOptions.map(type => (
        <MenuItem
          key={type.id}
          onClick={() => {
            onSelect(type.name);
            onClose();
          }}
          sx={{
            opacity: type.name === currentType ? 0.5 : 1,
          }}
        >
          {type.name}
        </MenuItem>
      ))}
    </Menu>
  );
};
