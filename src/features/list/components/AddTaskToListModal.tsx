import { Dialog } from '../../../components/Dialog';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  TextField,
  IconButton,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useState, useMemo } from 'react';
import { useGetTasksQuery } from '../../../api/tasks/taskApi';
import { FilterType } from '../../../components/UniversalFilterModal';
import { useGetFloorsQuery, useGetRoomsQuery } from '../../../api/locationApi/locationApi';
import { useLocations } from '../../../hooks/useLocations';
import { UniversalFilterModal } from '../../../components/UniversalFilterModal';
import { useSpace } from '../../../contexts/SpaceContext';

interface AddTaskToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskSelect: (taskId: number) => void;
  existingTaskIds: number[];
}

export const AddTaskToListModal = ({
  isOpen,
  onClose,
  onTaskSelect,
  existingTaskIds,
}: AddTaskToListModalProps) => {
  const { activeSpaceId } = useSpace();
  const [filters, setFilters] = useState<Array<{ type: FilterType; value: string }>>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // API hooks
  const { data: tasksResponse, isLoading, error } = useGetTasksQuery(
    activeSpaceId ? { space_id: activeSpaceId } : undefined
  );
  const { data: floorsData } = useGetFloorsQuery();
  const { data: roomsData } = useGetRoomsQuery();
  const { locations } = useLocations();

  const floors = floorsData?.data || [];
  const rooms = roomsData?.data || [];

  // Filter out tasks that are already in the list
  const availableTasks = useMemo(() => {
    const tasks = tasksResponse?.data ?? [];
    return tasks.filter(task => !existingTaskIds.includes(task.task_id));
  }, [tasksResponse?.data, existingTaskIds]);

  // Function to get display name for filter
  const getFilterDisplayName = (filter: { type: FilterType; value: string }) => {
    switch (filter.type) {
      case 'Floor': {
        const floor = floors.find(f => f.floor_id.toString() === filter.value);
        return floor ? `Floor: ${floor.name}` : filter.value;
      }
      case 'Room': {
        const room = rooms.find(r => r.room_id.toString() === filter.value);
        return room ? `Room: ${room.name}` : filter.value;
      }
      case 'Object': {
        const location = locations?.find(loc => loc.location_id.toString() === filter.value);
        return location ? `Object: ${location.location_name}` : `Object: ${filter.value}`;
      }
      default:
        return filter.value;
    }
  };

  // Filtering logic
  const filteredTasks = availableTasks.filter(task => {
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
          return filterValues.some(value => task.task_type === value);
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
          if (!task.due_at) return false;
          {
            const taskDate = new Date(task.due_at);
            const today = new Date();

            return filterValues.some(filterValue => {
              switch (filterValue) {
                case 'Today':
                  return (
                    taskDate.getDate() === today.getDate() &&
                    taskDate.getMonth() === today.getMonth() &&
                    taskDate.getFullYear() === today.getFullYear()
                  );
                case 'This Week': {
                  const dayOfWeek = today.getDay();
                  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                  const weekStart = new Date(today);
                  weekStart.setDate(today.getDate() - daysToMonday);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekStart.getDate() + 6);
                  return taskDate >= weekStart && taskDate <= weekEnd;
                }
                case 'Next Week': {
                  const currentDayOfWeek = today.getDay();
                  const daysToNextMonday = currentDayOfWeek === 0 ? 7 : 8 - currentDayOfWeek;
                  const nextWeekStart = new Date(today);
                  nextWeekStart.setDate(today.getDate() + daysToNextMonday);
                  const nextWeekEnd = new Date(nextWeekStart);
                  nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
                  return taskDate >= nextWeekStart && taskDate <= nextWeekEnd;
                }
                case 'This Month':
                  return (
                    taskDate.getMonth() === today.getMonth() &&
                    taskDate.getFullYear() === today.getFullYear()
                  );
                case 'Next Month': {
                  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1);
                  return (
                    taskDate.getMonth() === nextMonth.getMonth() &&
                    taskDate.getFullYear() === nextMonth.getFullYear()
                  );
                }
                case 'Overdue':
                  return taskDate < today;
                default:
                  return true;
              }
            });
          }
        default:
          return true;
      }
    });
  });

  // Apply search filter
  const searchFilteredTasks = useMemo(() => {
    if (!searchQuery) return filteredTasks;
    return filteredTasks.filter(task =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [filteredTasks, searchQuery]);

  const handleFilterSelect = (filterType: FilterType, value: string) => {
    if (filterType === 'Due date') {
      setFilters(prev => prev.filter(filter => filter.type !== 'Due date'));
    }

    if (filterType === 'Object') {
      const existingObjectFilter = filters.find(
        filter => filter.type === 'Object' && filter.value === value
      );
      if (existingObjectFilter) {
        return;
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

  const handleTaskClick = (taskId: number) => {
    onTaskSelect(taskId);
    onClose();
  };

  const handleClose = () => {
    setFilters([]);
    setSearchQuery('');
    setIsFilterOpen(false);
    setFilterAnchorEl(null);
    onClose();
  };

  if (isLoading) {
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="w-[380px] max-w-full max-h-[600px]"
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
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: 'white' }} />
        </Box>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="w-[380px] max-w-full max-h-[600px]"
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
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography sx={{ color: 'white', textAlign: 'center' }}>Error loading tasks</Typography>
        </Box>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[380px] max-w-full max-h-[600px]"
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
        },
      }}
    >
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} className="px-[18px]">
        {/* Back Icon */}
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="Back"
          sx={{
            position: 'absolute',
            left: '18px',
            width: '40px',
            height: '40px',
            padding: 0,
            borderRadius: '100px',
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <img
            src="/icons/mattertag/arrow-left.svg"
            alt="Back"
            style={{ width: '40px', height: '40px' }}
          />
        </IconButton>
        {/* Title */}
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
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
            Add Task to List
          </Typography>
        </Box>
        {/* Filter Icon */}
        <IconButton
          onClick={handleFilterClick}
          size="small"
          aria-label="Filter"
          sx={{
            position: 'absolute',
            right: '18px',
            width: '40px',
            height: '40px',
            padding: 0,
            borderRadius: '100px',
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <img
            src={
              isFilterOpen
                ? '/icons/mattertag/short-arrow-left.svg'
                : '/icons/mattertag/short-arrow-right.svg'
            }
            alt="Filter"
            style={{ width: 24, height: 24 }}
          />
        </IconButton>
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
        />
      </Box>

      {/* Search */}
      <Box>
        <TextField
          fullWidth
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              backgroundColor: '#00000026',
              borderRadius: '20px',
              '& fieldset': {
                border: 'none',
              },
              '&:hover fieldset': {
                border: 'none',
              },
              '&.Mui-focused fieldset': {
                border: 'none',
              },
            },
            '& .MuiInputBase-input': {
              color: '#fff',
              '&::placeholder': {
                color: 'rgba(255, 255, 255, 0.7)',
                opacity: 1,
              },
            },
          }}
        />
      </Box>

      {/* Filters section */}
      {filters.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', px: '18px' }}>
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

      {/* Tasks List */}
      <Paper
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: searchFilteredTasks.length === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.15)',
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
        {searchFilteredTasks.length === 0 ? (
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
            {searchFilteredTasks.map(task => (
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
    </Dialog>
  );
};
