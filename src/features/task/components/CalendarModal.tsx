import { Menu } from '@mui/material';
import { Calendar } from '../../../components/Calendar';
import { format, parse, isValid } from 'date-fns';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  currentDate: string;
  anchorEl: HTMLElement | null;
}

export const CalendarModal = ({
  isOpen,
  onClose,
  onSelect,
  currentDate,
  anchorEl,
}: CalendarModalProps) => {
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      const formattedDate = format(date, 'dd.MM.yyyy');
      onSelect(formattedDate);
      onClose();
    }
  };

  // Parse the current date string into a Date object
  let parsedDate: Date | undefined;
  if (currentDate && currentDate !== '00.00.0000') {
    try {
      // Try different date formats
      let parsed: Date;

      if (currentDate.includes('/')) {
        // Format: MM/DD/YYYY
        parsed = parse(currentDate, 'MM/dd/yyyy', new Date());
      } else if (currentDate.includes('.')) {
        // Format: DD.MM.YYYY
        parsed = parse(currentDate, 'dd.MM.yyyy', new Date());
      } else {
        // Try ISO format
        parsed = new Date(currentDate);
      }

      if (isValid(parsed)) {
        parsedDate = parsed;
      }
    } catch (error) {
      console.warn('Failed to parse date:', currentDate, error);
    }
  }

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
          mt: '-60px',
          ml: '-80px',
          borderRadius: '32px',
          padding: '4px 12px',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        },
      }}
    >
      <Calendar width="100%" date={parsedDate} onDateChange={handleDateChange} />
    </Menu>
  );
};
