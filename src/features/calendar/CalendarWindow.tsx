import { Dialog } from '../../components/Dialog';
import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store.ts';
import { closeCalendarWindow, openNewTaskWindow, openTaskWindow } from '../../store/modalSlice.ts';
import { UniversalFilterModal, FilterType } from '../../components/UniversalFilterModal';
import { DesignedCalendar } from '../../components/DesignedCalendar';
import { useGetTasksQuery } from '../../api/tasks/taskApi';
import { useGetFloorsQuery, useGetRoomsQuery } from '../../api/locationApi/locationApi';
import { useLocations } from '../../hooks/useLocations';
import { MonthYearPickerModal } from './components/MonthYearPickerModal';

export function CalendarWindow() {
  const dispatch = useDispatch();
  const { isOpen, selectedDate: modalSelectedDate } = useSelector(
    (state: RootState) => state.modal.calendarWindowModal
  );
  const [filters, setFilters] = useState<Array<{ type: FilterType; value: string }>>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [isMonthYearPickerOpen, setIsMonthYearPickerOpen] = useState(false);
  const [monthYearPickerAnchorEl, setMonthYearPickerAnchorEl] = useState<HTMLElement | null>(null);
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [currentDate, setCurrentDate] = useState(today);

  // Fetch tasks from API
  const { data: tasksResponse, isLoading: tasksLoading, refetch } = useGetTasksQuery();

  // Refetch tasks every time the modal opens
  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  // Fetch floors and rooms for filter display
  const { data: floorsData } = useGetFloorsQuery();
  const { data: roomsData } = useGetRoomsQuery();

  const floors = floorsData?.data || [];
  const rooms = roomsData?.data || [];

  // Fetch locations for Object filter
  const { locations } = useLocations();

  // Function to get display value for filters
  const getFilterDisplayValue = (filter: { type: FilterType; value: string }) => {
    switch (filter.type) {
      case 'Floor':
        const floor = floors.find(f => f.floor_id.toString() === filter.value);
        return floor ? `Floor: ${floor.name}` : filter.value;
      case 'Room':
        const room = rooms.find(r => r.room_id.toString() === filter.value);
        return room ? `Room: ${room.name}` : filter.value;
      case 'Object':
        // Find the location by location_id in the locations data
        const location = locations?.find(loc => loc.location_id.toString() === filter.value);
        return location ? `Object: ${location.location_name}` : `Object: ${filter.value}`;
      default:
        return filter.value;
    }
  };

  useEffect(() => {
    // Use modal selected date if available, otherwise use today
    if (modalSelectedDate) {
      setSelectedDate(modalSelectedDate);
      setCurrentDate(modalSelectedDate);
    } else if (!isOpen) {
      // Only reset to today when the modal is not open
      setSelectedDate(today);
      setCurrentDate(today);
    }
  }, [modalSelectedDate, isOpen]);

  // Process tasks for calendar display
  const processTasksForCalendar = () => {
    if (!tasksResponse?.data) return [];

    const datesWithTasks: Array<{
      date: Date;
      tasks: Array<{ id: number; name: string; dueDate: string | null }>;
    }> = [];

    // Get due date filter if exists
    filters.find(filter => filter.type === 'Due date');

    const filteredTasks = tasksResponse.data.filter(task => {
      if (filters.length === 0) return true;

      return filters.every(filter => {
        switch (filter.type) {
          case 'Status':
            return task.status === filter.value;
          case 'Task type':
            return task.activity?.name === filter.value;
          case 'Assignee':
            return (
              (task.assignee?.first_name + ' ' + task.assignee?.last_name).trim() === filter.value
            );
          case 'Object':
            return task.locations?.location_id?.toString() === filter.value;
          case 'Floor':
            return task.locations?.floor_id?.toString() === filter.value;
          case 'Room':
            return task.locations?.room_id?.toString() === filter.value;
          case 'Due date':
            // Handle due date filtering based on the specific value
            if (!task.dueDate) return false;
            const taskDate = new Date(task.dueDate);
            const today = new Date();

            switch (filter.value) {
              case 'Today':
                return (
                  taskDate.getDate() === today.getDate() &&
                  taskDate.getMonth() === today.getMonth() &&
                  taskDate.getFullYear() === today.getFullYear()
                );
              case 'This week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                return taskDate >= weekStart && taskDate <= weekEnd;
              case 'Next week':
                const nextWeekStart = new Date(today);
                nextWeekStart.setDate(today.getDate() - today.getDay() + 7);
                const nextWeekEnd = new Date(nextWeekStart);
                nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
                return taskDate >= nextWeekStart && taskDate <= nextWeekEnd;
              case 'This month':
                return (
                  taskDate.getMonth() === today.getMonth() &&
                  taskDate.getFullYear() === today.getFullYear()
                );
              case 'Next month':
                const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1);
                return (
                  taskDate.getMonth() === nextMonth.getMonth() &&
                  taskDate.getFullYear() === nextMonth.getFullYear()
                );
              default:
                return true;
            }
          default:
            return true;
        }
      });
    });

    filteredTasks.forEach(task => {
      if (task.dueDate) {
        const taskDate = new Date(task.dueDate);
        const existingDateIndex = datesWithTasks.findIndex(
          dateWithTasks =>
            dateWithTasks.date.getDate() === taskDate.getDate() &&
            dateWithTasks.date.getMonth() === taskDate.getMonth() &&
            dateWithTasks.date.getFullYear() === taskDate.getFullYear()
        );

        if (existingDateIndex >= 0) {
          datesWithTasks[existingDateIndex].tasks.push({
            id: task.task_id,
            name: task.title,
            dueDate: task.dueDate,
          });
        } else {
          datesWithTasks.push({
            date: taskDate,
            tasks: [
              {
                id: task.task_id,
                name: task.title,
                dueDate: task.dueDate,
              },
            ],
          });
        }
      }
    });

    return datesWithTasks;
  };

  const datesWithTasks = processTasksForCalendar();

  const handleFilterSelect = (filterType: FilterType, value: string) => {
    // If it's a due date filter, remove any existing due date filter first
    if (filterType === 'Due date') {
      setFilters(prev => prev.filter(filter => filter.type !== 'Due date'));

      // Handle specific due date filter options
      switch (value) {
        case 'Today':
          setSelectedDate(today);
          break;
        case 'This Week':
        case 'Next Week':
        case 'This Month':
        case 'Next Month':
          // Keep the current selected date for these range filters
          // The getDateRangeDisplay function will handle the display
          break;
      }
    }
    setFilters(prev => [...prev, { type: filterType, value }]);
  };

  const handleRemoveFilter = (filterToRemove: { type: FilterType; value: string }) => {
    setFilters(prev =>
      prev.filter(
        filter => !(filter.type === filterToRemove.type && filter.value === filterToRemove.value)
      )
    );
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
    setIsFilterOpen(true);
  };

  const handleClose = () => {
    setFilters([]); // Reset filters
    setSelectedDate(today);
    setCurrentDate(today);
    setIsFilterOpen(false); // Close filter modal
    setFilterAnchorEl(null); // Reset filter anchor
    dispatch(closeCalendarWindow());
  };

  const handleNewTaskClick = () => {
    handleClose();

    // Format the selected date to DD.MM.YYYY format
    const formatDateForTask = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const selectedDateFormatted = selectedDate
      ? formatDateForTask(selectedDate)
      : formatDateForTask(today);

    dispatch(
      openNewTaskWindow({
        preSelectedDate: selectedDateFormatted,
        redirectBack: {
          type: 'calendar',
        },
      })
    );
  };

  const handleTaskClick = (taskId: number) => {
    handleClose();
    dispatch(openTaskWindow({ taskId, source: 'calendar' }));
  };

  // Handle date selection - clear due date filter if exists
  const handleDateSelect = (date: Date) => {
    // Remove any due date filters when a specific date is selected
    setFilters(prev => prev.filter(filter => filter.type !== 'Due date'));
    setSelectedDate(date);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDateRangeDisplay = () => {
    const dueDateFilter = filters.find(filter => filter.type === 'Due date');
    if (!dueDateFilter) {
      return selectedDate ? formatDate(selectedDate) : 'No date selected';
    }

    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (dueDateFilter.value) {
      case 'Today':
        return formatDate(today);
      case 'This Week':
        startDate = new Date(today);
        // Get Monday of current week (if today is Sunday, get last Monday)
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so we need 6 days back
        startDate.setDate(today.getDate() - daysToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // End of week (Sunday)
        break;
      case 'Next Week':
        startDate = new Date(today);
        // Get Monday of next week
        const currentDayOfWeek = today.getDay();
        const daysToNextMonday = currentDayOfWeek === 0 ? 7 : 8 - currentDayOfWeek; // Days until next Monday
        startDate.setDate(today.getDate() + daysToNextMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // End of week (Sunday)
        break;
      case 'This Month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1); // First day of current month
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
        break;
      case 'Next Month':
        startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1); // First day of next month
        endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0); // Last day of next month
        break;
      default:
        return selectedDate ? formatDate(selectedDate) : 'No date selected';
    }

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getFilteredDateRange = () => {
    const dueDateFilter = filters.find(filter => filter.type === 'Due date');
    if (!dueDateFilter) {
      return null;
    }

    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (dueDateFilter.value) {
      case 'Today':
        return { startDate: today, endDate: today };
      case 'This Week':
        startDate = new Date(today);
        // Get Monday of current week (if today is Sunday, get last Monday)
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so we need 6 days back
        startDate.setDate(today.getDate() - daysToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // End of week (Sunday)
        return { startDate, endDate };
      case 'Next Week':
        startDate = new Date(today);
        // Get Monday of next week
        const currentDayOfWeek = today.getDay();
        const daysToNextMonday = currentDayOfWeek === 0 ? 7 : 8 - currentDayOfWeek; // Days until next Monday
        startDate.setDate(today.getDate() + daysToNextMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // End of week (Sunday)
        return { startDate, endDate };
      case 'This Month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1); // First day of current month
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
        return { startDate, endDate };
      case 'Next Month':
        startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1); // First day of next month
        endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0); // Last day of next month
        return { startDate, endDate };
      default:
        return null;
    }
  };

  const getTasksForSelectedDate = () => {
    const dueDateFilter = filters.find(filter => filter.type === 'Due date');

    // If there's a due date filter, return all tasks for the filtered range
    if (dueDateFilter) {
      return datesWithTasks.flatMap(dateWithTasks => dateWithTasks.tasks);
    }

    // Otherwise, return tasks for the selected date
    if (!selectedDate) return [];
    return (
      datesWithTasks.find(
        dateWithTasks =>
          dateWithTasks.date.getDate() === selectedDate.getDate() &&
          dateWithTasks.date.getMonth() === selectedDate.getMonth() &&
          dateWithTasks.date.getFullYear() === selectedDate.getFullYear()
      )?.tasks || []
    );
  };

  const selectedDateTasks = getTasksForSelectedDate();

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleMonthYearPickerClick = (event: React.MouseEvent<HTMLElement>) => {
    setMonthYearPickerAnchorEl(event.currentTarget);
    setIsMonthYearPickerOpen(true);
  };

  const handleMonthYearSelect = (month: number, year: number) => {
    setCurrentDate(new Date(year, month, 1));
    setIsMonthYearPickerOpen(false);
    setMonthYearPickerAnchorEl(null);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[756px] h-[440px]"
      PaperProps={{
        sx: {
          borderRadius: '32px',
          overflow: 'hidden',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          padding: '20px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          height: 'auto',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'start',
          justifyContent: 'space-between',
          height: '40px',
          position: 'relative',
          pl: 2,
        }}
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              m: 0,
              fontWeight: 700,
              fontSize: '20px',
              lineHeight: '32px',
              color: '#FFFFFF',
              textAlign: 'center',
            }}
          >
            Calendar
          </Typography>
        </Box>
        <Button
          onClick={handleFilterClick}
          endIcon={
            <img
              src={
                isFilterOpen
                  ? '/icons/mattertag/short-arrow-left.svg'
                  : '/icons/mattertag/short-arrow-right.svg'
              }
              alt="arrow"
              style={{ width: 24, height: 24 }}
            />
          }
          sx={{
            width: 140,
            height: 40,
            borderRadius: '500px',
            padding: '8px 10px 8px 18px',
            gap: 0,
            background: '#5E5E5E2E',
            backgroundColor: '#00000033',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            textTransform: 'none',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.25)',
              '& .cross-icon': {
                display: 'flex',
                opacity: 1,
              },
              '& .filter-text': {
                opacity: 0.1,
              },
            },
            '&:disabled': {
              opacity: 0.5,
              bgcolor: 'transparent',
              color: '#fff',
            },
          }}
        >
          Filter
        </Button>
        <UniversalFilterModal
          isOpen={isFilterOpen}
          onClose={() => {
            setIsFilterOpen(false);
            setFilterAnchorEl(null);
          }}
          onSelect={handleFilterSelect}
          currentFilters={filters}
          anchorEl={filterAnchorEl}
          availableFilterTypes={[
            'Status',
            'Object',
            'Floor',
            'Room',
            'Due date',
            'Assignee',
            'Task type',
          ]}
          secondPanelPosition="bottom"
        />
      </Box>

      {/* Content */}
      <Box sx={{ display: 'flex', gap: '20px', flex: 1 }}>
        {/* Left side */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          {/* Month selector */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box
              onClick={handleMonthYearPickerClick}
              sx={{
                height: '40px',
                borderRadius: '500px',
                padding: '8px 8px 8px 18px',
                background: '#00000026',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '14px',
                  lineHeight: '22px',
                  color: '#FFFFFF',
                }}
              >
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Typography>
              <img src="/icons/mattertag/short-arrow-right.svg" alt="arrow" />
            </Box>
            <Box sx={{ display: 'flex', gap: '8px' }}>
              <Button
                onClick={handlePrevMonth}
                sx={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '500px',
                  padding: '8px',
                  gap: '8px',
                  background: '#00000026',
                  minWidth: '40px',
                }}
              >
                <img
                  src="/icons/mattertag/arrow-right.svg"
                  alt="Previous month"
                  style={{ transform: 'rotate(180deg)' }}
                />
              </Button>
              <Button
                onClick={handleNextMonth}
                sx={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '500px',
                  padding: '8px',
                  gap: '8px',
                  background: '#00000026',
                  minWidth: '40px',
                }}
              >
                <img src="/icons/mattertag/arrow-right.svg" alt="Next month" />
              </Button>
            </Box>
          </Box>

          {/* Calendar */}
          <Box sx={{ flex: 1 }}>
            {tasksLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  bgcolor: 'rgba(0, 0, 0, 0.15)',
                  borderRadius: '16px',
                }}
              >
                <CircularProgress sx={{ color: '#FFFFFF' }} />
              </Box>
            ) : (
              <DesignedCalendar
                onDateSelect={handleDateSelect}
                selectedDate={selectedDate}
                datesWithTasks={datesWithTasks}
                currentDate={currentDate}
                filteredDateRange={getFilteredDateRange()}
              />
            )}
          </Box>
        </Box>

        {/* Right side */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          {/* Selected date */}
          <Box
            sx={{
              height: '40px',
              borderRadius: '20px',
              padding: '0 18px',
              gap: '16px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography
              sx={{
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '22px',
                color: '#FFFFFF',
              }}
            >
              {getDateRangeDisplay()}
            </Typography>
          </Box>

          {/* Filters section */}
          {filters.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Box
                sx={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                }}
              >
                {filters.map(item => (
                  <Box
                    key={`${item.type}:${item.value}`}
                    onClick={() => handleRemoveFilter(item)}
                    sx={{
                      height: '40px',
                      borderRadius: '500px',
                      bgcolor: 'rgba(0, 0, 0, 0.15)',
                      color: '#FFFFFF',
                      padding: '8px 18px',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.25)',
                        '& .cross-icon': {
                          display: 'flex',
                          opacity: 1,
                        },
                        '& .filter-text': {
                          opacity: 0.1,
                        },
                      },
                    }}
                  >
                    <Typography
                      className="filter-text"
                      sx={{
                        fontWeight: 600,
                        fontSize: '14px',
                        lineHeight: '22px',
                        letterSpacing: 0,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        transition: 'opacity 0.2s ease-in-out',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getFilterDisplayValue(item)}
                    </Typography>
                    <Box
                      className="cross-icon"
                      sx={{
                        display: 'none',
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img src="/icons/mattertag/cross.svg" alt="Remove" />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* New Task Button */}
          <Button
            variant="outlined"
            onClick={handleNewTaskClick}
            startIcon={<img src="/icons/mattertag/plus.svg" alt="Add" />}
            fullWidth
            sx={{
              justifyContent: 'flex-start',
              height: '48px',
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
            New Task
          </Button>

          {/* Filter Applied Indicator */}
          {filters.length > 0 && (
            <Box
              sx={{
                height: '40px',
                borderRadius: '20px',
                padding: '0 18px',
                gap: '16px',
                marginTop: '10px',
                marginBottom: '-10px',
                opacity: 0.5,
                backgroundColor: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
              }}
            >
              <img src="/icons/mattertag/re-schedule-all.svg" alt="Filter" />
              <Typography
                sx={{
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '22px',
                  color: '#FFFFFF',
                }}
              >
                Filter applied
              </Typography>
            </Box>
          )}

          {/* Tasks List */}
          <Paper
            sx={{
              flex: 1,
              maxHeight:
                filters.length > 0
                  ? selectedDateTasks.length <= 3
                    ? `${selectedDateTasks.length * 48}px`
                    : '144px' // 48px per task, max 3 tasks when filters are present
                  : selectedDateTasks.length <= 4
                    ? `${selectedDateTasks.length * 48}px`
                    : '192px', // 48px per task, max 4 tasks when no filters
              overflowY: 'auto',
              bgcolor: selectedDateTasks.length === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.15)',
              borderRadius: '20px',
              boxShadow: 'none',
              '&::-webkit-scrollbar': {
                display: 'none',
              },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {tasksLoading ? (
              <Box
                sx={{
                  height: '48px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress size={20} sx={{ color: '#FFFFFF' }} />
              </Box>
            ) : selectedDateTasks.length === 0 ? (
              <Box
                sx={{
                  height: '48px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '14px',
                    lineHeight: '22px',
                    color: '#FFFFFF',
                  }}
                >
                  {filters.find(f => f.type === 'Due date')
                    ? 'No tasks in selected period'
                    : 'No tasks'}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {selectedDateTasks.map(task => (
                  <ListItem
                    key={task.id}
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
                      onClick={() => handleTaskClick(task.id)}
                      sx={{
                        bgcolor: 'transparent',
                        height: '48px',
                        px: 2.25,
                        position: 'relative',
                        '&:hover': {
                          bgcolor: '#FFFFFF26',
                          '& .arrow-icon': {
                            display: 'block',
                          },
                        },
                      }}
                    >
                      <ListItemText
                        primary={task.name}
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
            )}
          </Paper>
        </Box>
      </Box>

      {/* Month Year Picker Modal */}
      <MonthYearPickerModal
        isOpen={isMonthYearPickerOpen}
        onClose={() => {
          setIsMonthYearPickerOpen(false);
          setMonthYearPickerAnchorEl(null);
        }}
        onSelect={handleMonthYearSelect}
        currentMonth={currentDate.getMonth()}
        currentYear={currentDate.getFullYear()}
        anchorEl={monthYearPickerAnchorEl}
      />
    </Dialog>
  );
}
