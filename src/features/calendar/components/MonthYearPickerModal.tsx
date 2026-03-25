import { Menu, Box, Typography } from '@mui/material';
import { useState, useEffect, useRef } from 'react';

interface MonthYearPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (month: number, year: number) => void;
  currentMonth: number;
  currentYear: number;
  anchorEl: HTMLElement | null;
}

export const MonthYearPickerModal = ({
  isOpen,
  onClose,
  onSelect,
  currentMonth,
  currentYear,
  anchorEl,
}: MonthYearPickerModalProps) => {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const monthListRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);

  // Initialize state when modal opens or current values change
  useEffect(() => {
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);
  }, [currentMonth, currentYear, isOpen]);

  // Scroll to selected items when modal opens
  useEffect(() => {
    if (isOpen) {
      // Add a small delay to ensure DOM elements are rendered
      const timer = setTimeout(() => {
        // Scroll to selected month
        if (monthListRef.current) {
          const monthElement = monthListRef.current.children[currentMonth] as HTMLElement;
          if (monthElement) {
            monthElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }

        // Scroll to selected year
        if (yearListRef.current) {
          const yearElement = yearListRef.current.children[currentYear - 1990] as HTMLElement;
          if (yearElement) {
            yearElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isOpen, currentMonth, currentYear]);

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Generate years from 2020 to 2030
  const years = Array.from({ length: 60 }, (_, i) => 1990 + i);

  const handleMonthSelect = (month: number) => {
    setSelectedMonth(month);
    onSelect(month, selectedYear);
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    onSelect(selectedMonth, year);
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
      <Box sx={{ display: 'flex', gap: '8px', width: '200px' }}>
        {/* Months */}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#fff', fontSize: 14, mb: 1, textAlign: 'center' }}>
            Month
          </Typography>
          <Box
            ref={monthListRef}
            sx={{
              maxHeight: '200px',
              overflowY: 'auto',
              '::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {months.map((month, index) => (
              <Box
                key={index}
                onClick={() => handleMonthSelect(index)}
                sx={{
                  padding: '8px 12px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  backgroundColor: selectedMonth === index ? '#FFFFFF' : 'transparent',
                  color: selectedMonth === index ? '#000000' : '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: 'center',
                  '&:hover': {
                    backgroundColor: selectedMonth === index ? '#FFFFFF' : '#FFFFFF40',
                  },
                }}
              >
                {month}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Years */}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#fff', fontSize: 14, mb: 1, textAlign: 'center' }}>
            Year
          </Typography>
          <Box
            ref={yearListRef}
            sx={{
              maxHeight: '200px',
              overflowY: 'auto',
              '::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {years.map(year => (
              <Box
                key={year}
                onClick={() => handleYearSelect(year)}
                sx={{
                  padding: '8px 12px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  backgroundColor: selectedYear === year ? '#FFFFFF' : 'transparent',
                  color: selectedYear === year ? '#000000' : '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: 'center',
                  '&:hover': {
                    backgroundColor: selectedYear === year ? '#FFFFFF' : '#FFFFFF40',
                  },
                }}
              >
                {year}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Menu>
  );
};
