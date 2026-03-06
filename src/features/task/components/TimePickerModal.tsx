import { Menu, Box, Typography } from '@mui/material';
import { useState, useEffect } from 'react';

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  currentTime: string;
  anchorEl: HTMLElement | null;
}

export const TimePickerModal = ({
  isOpen,
  onClose,
  onSelect,
  currentTime,
  anchorEl,
}: TimePickerModalProps) => {
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedMinute, setSelectedMinute] = useState(0);

  // Initialize state when modal opens or currentTime changes
  useEffect(() => {
    if (currentTime) {
      const [hour, minute] = currentTime.split(':');
      setSelectedHour(parseInt(hour) || 0);
      setSelectedMinute(parseInt(minute) || 0);
    }
  }, [currentTime, isOpen]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    const formattedTime = `${hour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
    onSelect(formattedTime);
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    const formattedTime = `${selectedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onSelect(formattedTime);
  };

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
          mt: '-56px',
          ml: '-21px',
          borderRadius: '32px',
          padding: '0 8px',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        },
      }}
    >
      <Box sx={{ display: 'flex', gap: '8px', width: '120px' }}>
        {/* Hours */}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#fff', fontSize: 14, mb: 1, textAlign: 'center' }}>
            Hour
          </Typography>
          <Box
            sx={{
              maxHeight: '200px',
              overflowY: 'auto',
              '::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {hours.map(hour => (
              <Box
                key={hour}
                onClick={() => handleHourSelect(hour)}
                sx={{
                  padding: '8px 12px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  backgroundColor: selectedHour === hour ? '#FFFFFF' : 'transparent',
                  color: selectedHour === hour ? '#000000' : '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: 'center',
                  '&:hover': {
                    backgroundColor: selectedHour === hour ? '#FFFFFF' : '#FFFFFF40',
                  },
                }}
              >
                {hour.toString().padStart(2, '0')}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Separator */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>:</Typography>
        </Box>

        {/* Minutes */}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#fff', fontSize: 14, mb: 1, textAlign: 'center' }}>
            Minute
          </Typography>
          <Box
            sx={{
              maxHeight: '200px',
              overflowY: 'auto',
              '::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {minutes.map(minute => (
              <Box
                key={minute}
                onClick={() => handleMinuteSelect(minute)}
                sx={{
                  padding: '8px 12px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  backgroundColor: selectedMinute === minute ? '#FFFFFF' : 'transparent',
                  color: selectedMinute === minute ? '#000000' : '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: 'center',
                  '&:hover': {
                    backgroundColor: selectedMinute === minute ? '#FFFFFF' : '#FFFFFF40',
                  },
                }}
              >
                {minute.toString().padStart(2, '0')}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Menu>
  );
};
