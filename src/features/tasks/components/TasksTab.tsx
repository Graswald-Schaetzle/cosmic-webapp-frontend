import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import { useDispatch } from 'react-redux';
import { openNewTaskWindow, openTaskWindow } from '../../../store/modalSlice';
import { TaskDetail } from '../../../api/tasks/taskApi';
import { FilterType } from '../../../components/UniversalFilterModal';
import { useGetFloorsQuery, useGetRoomsQuery } from '../../../api/locationApi/locationApi';
import { useLocations } from '../../../hooks/useLocations';

interface TasksTabProps {
  tasks: TaskDetail[] | undefined;
  loading: boolean;
  error: string | null;
  filters: Array<{ type: FilterType; value: string }>;
  handleRemoveFilter: (filter: { type: FilterType; value: string }) => void;
  handleClose: () => void;
}

export const TasksTab = ({
  tasks,
  loading,
  error,
  filters,
  handleRemoveFilter,
  handleClose,
}: TasksTabProps) => {
  const dispatch = useDispatch();

  // API hooks for floors and rooms
  const { data: floorsData } = useGetFloorsQuery();
  const { data: roomsData } = useGetRoomsQuery();

  const floors = floorsData?.data || [];
  const rooms = roomsData?.data || [];

  // Fetch locations for Object filter
  const { locations } = useLocations();

  // Ensure tasks is an array and handle undefined/null cases
  const tasksArray = Array.isArray(tasks) ? tasks : [];

  // Function to get display name for filter
  const getFilterDisplayName = (filter: { type: FilterType; value: string }) => {
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

  // Filtering logic for new filter structure
  const filteredTasks = tasksArray.filter(task => {
    if (filters.length === 0) return true;

    // Group filters by type
    const filtersByType = filters.reduce(
      (acc, filter) => {
        if (!acc[filter.type]) {
          acc[filter.type] = [];
        }
        acc[filter.type].push(filter.value);
        return acc;
      },
      {} as Record<string, string[]>
    );

    // Check each filter type
    return Object.entries(filtersByType).every(([filterType, filterValues]) => {
      switch (filterType) {
        case 'Status':
          return filterValues.some(value => task.status === value);
        case 'Task type':
          return filterValues.some(value => task.activity?.name === value);
        case 'Assignee':
          return filterValues.some(
            value => (task.assignee?.first_name + ' ' + task.assignee?.last_name).trim() === value
          );
        case 'Object':
          return filterValues.some(value => task.locations?.location_id?.toString() === value);
        case 'Floor':
          return filterValues.some(value => task.locations?.floor_id?.toString() === value);
        case 'Room':
          return filterValues.some(value => task.locations?.room_id?.toString() === value);
        case 'Due date':
          if (!task.dueDate) return false;
          const taskDate = new Date(task.dueDate);
          const today = new Date();

          return filterValues.some(filterValue => {
            switch (filterValue) {
              case 'Today':
                return (
                  taskDate.getDate() === today.getDate() &&
                  taskDate.getMonth() === today.getMonth() &&
                  taskDate.getFullYear() === today.getFullYear()
                );
              case 'This Week':
                // Get Monday of current week
                const dayOfWeek = today.getDay();
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so we need 6 days back
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - daysToMonday);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6); // End of week (Sunday)
                return taskDate >= weekStart && taskDate <= weekEnd;
              case 'Next Week':
                // Get Monday of next week
                const currentDayOfWeek = today.getDay();
                const daysToNextMonday = currentDayOfWeek === 0 ? 7 : 8 - currentDayOfWeek; // Days until next Monday
                const nextWeekStart = new Date(today);
                nextWeekStart.setDate(today.getDate() + daysToNextMonday);
                const nextWeekEnd = new Date(nextWeekStart);
                nextWeekEnd.setDate(nextWeekStart.getDate() + 6); // End of week (Sunday)
                return taskDate >= nextWeekStart && taskDate <= nextWeekEnd;
              case 'This Month':
                return (
                  taskDate.getMonth() === today.getMonth() &&
                  taskDate.getFullYear() === today.getFullYear()
                );
              case 'Next Month':
                const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1);
                return (
                  taskDate.getMonth() === nextMonth.getMonth() &&
                  taskDate.getFullYear() === nextMonth.getFullYear()
                );
              case 'Overdue':
                return taskDate < today;
              default:
                return true;
            }
          });
        default:
          return true;
      }
    });
  });

  const handleTaskClick = (taskId: number) => {
    handleClose();
    dispatch(openTaskWindow({ taskId, source: 'tasks' }));
  };

  const handleNewTaskClick = () => {
    handleClose();
    dispatch(openNewTaskWindow());
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress sx={{ color: '#fff' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <Typography sx={{ color: '#ff6b6b', textAlign: 'center' }}>
          Error loading tasks: {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', minHeight: 0 }}
    >
      {/* Filters section */}
      {filters.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {filters.map((item, index) => (
              <Box
                key={`${item.type}:${item.value}:${index}`}
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
                  }}
                >
                  {getFilterDisplayName(item)}
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
          width: '356px',
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
          minHeight: '48px',
          maxHeight: '48px',
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

      <Paper
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: filteredTasks.length === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.15)',
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
        {filteredTasks.length === 0 ? (
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
              No tasks found
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filteredTasks.map(task => (
              <ListItem
                key={task.task_id}
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
                  onClick={() => handleTaskClick(task.task_id)}
                  sx={{
                    bgcolor: 'transparent',
                    height: 'auto',
                    minHeight: '48px',
                    px: 2.25,
                    py: 1.5,
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
                    primary={task.title}
                    primaryTypographyProps={{
                      sx: {
                        fontSize: '14px',
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
  );
};
