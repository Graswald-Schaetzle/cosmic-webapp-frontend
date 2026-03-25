import { Box, Typography } from '@mui/material';

interface Task {
  id: number;
  name: string;
}

interface DateWithTasks {
  date: Date;
  tasks: Task[];
}

interface DesignedCalendarProps {
  onDateSelect: (date: Date) => void;
  selectedDate?: Date | null;
  datesWithTasks?: DateWithTasks[];
  currentDate: Date;
  filteredDateRange?: { startDate: Date; endDate: Date } | null;
}

export function DesignedCalendar({
  onDateSelect,
  selectedDate = new Date(),
  datesWithTasks = [],
  currentDate,
  filteredDateRange = null,
}: DesignedCalendarProps) {
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyCells = Array.from({ length: adjustedFirstDay }, (_, i) => i);

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    onDateSelect(newDate);
  };

  const isSelectedDate = (day: number) => {
    const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

    // If there's a filtered date range, check if the day is within that range
    if (filteredDateRange) {
      // Normalize dates to compare only the date part (remove time)
      const normalizedCurrentDay = new Date(
        currentDayDate.getFullYear(),
        currentDayDate.getMonth(),
        currentDayDate.getDate()
      );
      const normalizedStartDate = new Date(
        filteredDateRange.startDate.getFullYear(),
        filteredDateRange.startDate.getMonth(),
        filteredDateRange.startDate.getDate()
      );
      const normalizedEndDate = new Date(
        filteredDateRange.endDate.getFullYear(),
        filteredDateRange.endDate.getMonth(),
        filteredDateRange.endDate.getDate()
      );

      const isInRange =
        normalizedCurrentDay >= normalizedStartDate && normalizedCurrentDay <= normalizedEndDate;

      return isInRange;
    }

    // Otherwise, check if it's the specifically selected date
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      currentDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const hasTasks = (day: number) => {
    return datesWithTasks.some(
      dateWithTasks =>
        dateWithTasks.date.getDate() === day &&
        dateWithTasks.date.getMonth() === currentDate.getMonth() &&
        dateWithTasks.date.getFullYear() === currentDate.getFullYear()
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Week days header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {weekDays.map(day => (
          <Typography
            key={day}
            sx={{
              textAlign: 'center',
              fontWeight: 500,
              fontSize: '14px',
              lineHeight: '22px',
              color: '#FFFFFF',
            }}
          >
            {day}
          </Typography>
        ))}
      </Box>

      {/* Calendar grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {emptyCells.map(index => (
          <Box key={`empty-${index}`} />
        ))}
        {days.map(day => (
          <Box
            key={day}
            onClick={() => handleDateClick(day)}
            sx={{
              height: '35px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: '10px',
              backgroundColor: isSelectedDate(day) ? '#FFFFFF' : 'transparent',
              color: isSelectedDate(day) ? '#000000' : '#FFFFFF',
              position: 'relative',
              '&:hover': {
                backgroundColor: isSelectedDate(day) ? '#FFFFFF' : '#FFFFFF1A',
              },
            }}
          >
            <Typography
              sx={{
                fontWeight: 400,
                fontSize: '16px',
              }}
            >
              {day}
            </Typography>
            {hasTasks(day) && (
              <Box
                sx={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#2AA1EB',
                  borderRadius: '50%',
                }}
              />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
