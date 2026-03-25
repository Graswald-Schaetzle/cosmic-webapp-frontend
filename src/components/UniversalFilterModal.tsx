import { Menu, MenuItem, TextField, Box, Typography, CircularProgress } from '@mui/material';
import { useState, useMemo } from 'react';
import { useGetUsersQuery } from '../api/userMenu/userMenuApi';
import { useLocations } from '../hooks/useLocations';
import { useGetFloorsQuery, useGetRoomsQuery } from '../api/locationApi/locationApi';
import { useGetTasksQuery } from '../api/tasks/taskApi';

export type FilterType =
  | 'Status'
  | 'Object'
  | 'Floor'
  | 'Room'
  | 'Task'
  | 'Due date'
  | 'Assignee'
  | 'Task type';

interface UniversalFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (filterType: FilterType, value: string) => void;
  currentFilters: Array<{ type: FilterType; value: string }>;
  anchorEl: HTMLElement | null;
  availableFilterTypes?: FilterType[];
  secondPanelPosition?: 'right' | 'bottom';
}

// Static options for different filter types
const statusOptions = ['To Do', 'In Progress', 'Done', 'Overdue'];
const taskTypeOptions = [
  { id: 1, name: 'Vacuum' },
  { id: 2, name: 'Clean' },
  { id: 3, name: 'Repair' },
  { id: 4, name: 'Wipe' },
  { id: 5, name: 'Empty' },
];
const dueDateOptions = ['Today', 'This Week', 'Next Week', 'This Month', 'Next Month'];

export const UniversalFilterModal = ({
  isOpen,
  onClose,
  onSelect,
  currentFilters,
  anchorEl,
  availableFilterTypes = [
    'Status',
    'Object',
    'Floor',
    'Room',
    'Task',
    'Due date',
    'Assignee',
    'Task type',
  ],
  secondPanelPosition = 'right',
}: UniversalFilterModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterType, setSelectedFilterType] = useState<FilterType | null>(null);

  // API hooks
  const { data: usersData, isLoading: usersLoading } = useGetUsersQuery();
  const { locations, isLoading: locationsLoading } = useLocations();
  const { data: floorsData, isLoading: floorsLoading } = useGetFloorsQuery();
  const { data: roomsData, isLoading: roomsLoading } = useGetRoomsQuery();
  const { data: tasksData, isLoading: tasksLoading } = useGetTasksQuery();

  const users = usersData?.users || [];
  const floors = floorsData?.data || [];
  const rooms = roomsData?.data || [];
  const tasks = tasksData?.data || [];

  // Get current filter values for the selected type
  const getCurrentFilterValues = (filterType: FilterType) => {
    const filterValues = currentFilters
      .filter(filter => filter.type === filterType)
      .map(filter => filter.value);

    // For floors, rooms, tasks, and objects, convert IDs back to names for display
    if (filterType === 'Floor') {
      return filterValues.map(id => {
        const floor = floors.find(f => f.floor_id.toString() === id);
        return floor ? floor.name : id;
      });
    }

    if (filterType === 'Room') {
      return filterValues.map(id => {
        const room = rooms.find(r => r.room_id.toString() === id);
        return room ? room.name : id;
      });
    }

    if (filterType === 'Task') {
      return filterValues.map(id => {
        const task = tasks.find(t => t.task_id.toString() === id);
        return task ? task.title : id;
      });
    }

    if (filterType === 'Object') {
      return filterValues.map(id => {
        const location = locations?.find(loc => loc.location_id.toString() === id);
        return location ? location.location_name : id;
      });
    }

    return filterValues;
  };

  // Get options for the selected filter type
  const getFilterOptions = (filterType: FilterType) => {
    switch (filterType) {
      case 'Status':
        return statusOptions;
      case 'Task type':
        return taskTypeOptions.map(option => option.name);
      case 'Due date':
        return dueDateOptions;
      case 'Assignee':
        return users.map(user => `${user.first_name} ${user.last_name}`);
      case 'Object':
        return (
          locations?.map(location => ({
            id: location.location_id,
            name: location.location_name,
            floor: location.floor_name,
            room: location.room_name,
          })) || []
        );
      case 'Floor':
        return (
          floors.map(floor => ({
            id: floor.floor_id,
            name: floor.name,
          })) || []
        );
      case 'Room':
        return (
          rooms.map(room => ({
            id: room.room_id,
            name: room.name,
          })) || []
        );
      case 'Task':
        return (
          tasks.map(task => ({
            id: task.task_id,
            name: task.title,
          })) || []
        );
      default:
        return [];
    }
  };

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!selectedFilterType) return availableFilterTypes;
    const options = getFilterOptions(selectedFilterType);
    if (!searchQuery) return options;
    return options.filter(option => {
      if (typeof option === 'string') {
        return option.toLowerCase().includes(searchQuery.toLowerCase());
      } else {
        return option.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
    });
  }, [
    selectedFilterType,
    searchQuery,
    availableFilterTypes,
    users,
    locations,
    floors,
    rooms,
    tasks,
  ]);

  const handleFilterTypeSelect = (filterType: FilterType) => {
    setSelectedFilterType(filterType);
    setSearchQuery('');
  };

  const handleValueSelect = (value: string | number) => {
    if (selectedFilterType) {
      // For floors, rooms, tasks, and objects, we need to find the object and use its ID
      if (
        selectedFilterType === 'Floor' ||
        selectedFilterType === 'Room' ||
        selectedFilterType === 'Task' ||
        selectedFilterType === 'Object'
      ) {
        const options = getFilterOptions(selectedFilterType);
        const selectedOption = options.find(
          option => typeof option === 'object' && option.name === value
        );
        if (selectedOption && typeof selectedOption === 'object') {
          onSelect(selectedFilterType, selectedOption.id.toString());
        }
      } else {
        onSelect(selectedFilterType, value.toString());
      }
      setSelectedFilterType(null);
      setSearchQuery('');
    }
  };

  const handleBack = () => {
    setSelectedFilterType(null);
    setSearchQuery('');
  };

  const isLoading =
    (selectedFilterType === 'Assignee' && usersLoading) ||
    (selectedFilterType === 'Object' && locationsLoading) ||
    (selectedFilterType === 'Floor' && floorsLoading) ||
    (selectedFilterType === 'Room' && roomsLoading) ||
    (selectedFilterType === 'Task' && tasksLoading);

  // --- Two-panel modal logic ---
  // Left: filter type selection (always open)
  // Right: value selection (open if selectedFilterType)

  return (
    <>
      {/* Left panel: filter type selection */}
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            mt: '-20px',
            ml: '25px',
            borderRadius: '20px',
            padding: '0 8px',
            backgroundColor: 'rgba(46, 46, 46, 0.35)',
            backdropFilter: 'blur(100px)',
            WebkitBackdropFilter: 'blur(100px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '400px',
            overflow: 'hidden',
            minWidth: '150px',
            maxWidth: '150px',
          },
        }}
      >
        {availableFilterTypes.map(filterType => (
          <MenuItem
            key={filterType}
            onClick={() => handleFilterTypeSelect(filterType)}
            sx={{
              color: '#fff',
              padding: '2px 10px',
              borderRadius: '14px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              '&:hover': {
                backgroundColor: '#FFFFFF40',
              },
            }}
          >
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '14px',
                lineHeight: '18px',
                color: '#FFFFFF',
                textAlign: 'left',
              }}
            >
              {filterType}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              {getCurrentFilterValues(filterType).length > 0 && (
                <Box
                  sx={{
                    backgroundColor: '#FFFFFF',
                    color: '#000',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {getCurrentFilterValues(filterType).length}
                </Box>
              )}
              <img
                src="/icons/mattertag/short-arrow-right.svg"
                alt="arrow"
                style={{ width: 16, height: 16 }}
              />
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* Right panel: value selection */}
      {selectedFilterType && (
        <Menu
          anchorEl={anchorEl}
          open={!!selectedFilterType}
          onClose={handleBack}
          anchorOrigin={
            secondPanelPosition === 'bottom'
              ? { vertical: 'bottom', horizontal: 'right' }
              : { vertical: 'top', horizontal: 'right' }
          }
          transformOrigin={
            secondPanelPosition === 'bottom'
              ? { vertical: 'top', horizontal: 'left' }
              : { vertical: 'top', horizontal: 'left' }
          }
          PaperProps={{
            sx: {
              mt: secondPanelPosition === 'bottom' ? '10px' : '-20px',
              ml: secondPanelPosition === 'bottom' ? '25px' : '185px', // 150px (left) + 35px gap
              borderRadius: '20px',
              padding: '0 8px',
              backgroundColor: 'rgba(46, 46, 46, 0.35)',
              backdropFilter: 'blur(100px)',
              WebkitBackdropFilter: 'blur(100px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '400px',
              overflow: 'hidden',
              minWidth: '200px',
            },
          }}
        >
          {/* Search field */}
          {selectedFilterType !== 'Due date' && (
            <TextField
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${selectedFilterType.toLowerCase()}...`}
              variant="outlined"
              size="small"
              fullWidth
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  height: '40px !important',
                  borderRadius: '14px',
                  background: '#D6D6D673',
                  backgroundColor: '#00000014',
                  backgroundBlendMode: 'luminosity',
                  '& fieldset': {
                    border: 'none',
                  },
                  '&:hover fieldset': {
                    border: 'none',
                  },
                  '&.Mui-focused fieldset': {
                    border: 'none',
                  },
                  '& input': {
                    color: '#fff',
                    '&::placeholder': {
                      color: '#fff',
                      opacity: 0.7,
                    },
                  },
                },
              }}
            />
          )}
          {/* Content */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
              maxHeight: 'calc(400px - 100px)',
              '&::-webkit-scrollbar': {
                width: '0px',
                display: 'none',
              },
              '&::-webkit-scrollbar-track': {
                display: 'none',
              },
              '&::-webkit-scrollbar-thumb': {
                display: 'none',
              },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}
          >
            {isLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={2}>
                <CircularProgress size={20} sx={{ color: '#fff' }} />
              </Box>
            ) : filteredOptions.length === 0 ? (
              <Box sx={{ padding: '10px', textAlign: 'center' }}>
                <Typography sx={{ color: '#FFFFFF80', fontSize: '14px' }}>
                  No {selectedFilterType.toLowerCase()} options found
                </Typography>
              </Box>
            ) : (
              filteredOptions.map(value => {
                const itemName = typeof value === 'string' ? value : value.name;

                // Check if this item is already selected
                let isSelected = false;
                if (
                  selectedFilterType === 'Object' ||
                  selectedFilterType === 'Floor' ||
                  selectedFilterType === 'Room' ||
                  selectedFilterType === 'Task'
                ) {
                  // For Object, Floor, Room, and Task filters, check by ID
                  const currentIds = currentFilters
                    .filter(filter => filter.type === selectedFilterType)
                    .map(filter => filter.value);
                  isSelected =
                    typeof value === 'object' && currentIds.includes(value.id.toString());
                } else {
                  // For other filters, check by display name
                  isSelected = getCurrentFilterValues(selectedFilterType).includes(itemName);
                }

                return (
                  <MenuItem
                    key={typeof value === 'string' ? value : value.id}
                    onClick={() => {
                      if (selectedFilterType === 'Object' && typeof value === 'object') {
                        // For Object filters, pass the location object directly
                        onSelect(selectedFilterType, value.id.toString());
                        setSelectedFilterType(null);
                        setSearchQuery('');
                      } else if (selectedFilterType === 'Floor' && typeof value === 'object') {
                        // For Floor filters, pass the floor ID directly
                        onSelect(selectedFilterType, value.id.toString());
                        setSelectedFilterType(null);
                        setSearchQuery('');
                      } else if (selectedFilterType === 'Room' && typeof value === 'object') {
                        // For Room filters, pass the room ID directly
                        onSelect(selectedFilterType, value.id.toString());
                        setSelectedFilterType(null);
                        setSearchQuery('');
                      } else if (selectedFilterType === 'Task' && typeof value === 'object') {
                        // For Task filters, pass the task ID directly
                        onSelect(selectedFilterType, value.id.toString());
                        setSelectedFilterType(null);
                        setSearchQuery('');
                      } else {
                        handleValueSelect(itemName);
                      }
                    }}
                    disabled={isSelected}
                    sx={{
                      color: '#fff',
                      padding: '2px 10px',
                      borderRadius: '14px',
                      height: '40px !important',
                      minHeight: '40px !important',
                      maxHeight: '40px !important',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      opacity: isSelected ? 0.5 : 1,
                      '&.Mui-disabled': {
                        opacity: 0.5,
                        color: '#fff',
                      },
                      '&:hover': {
                        backgroundColor: isSelected ? 'transparent' : '#FFFFFF40',
                      },
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
                      {itemName}
                    </Box>
                    {typeof value !== 'string' && 'floor' in value && (
                      <Typography
                        sx={{
                          fontSize: '12px',
                          color: '#FFFFFF80',
                          lineHeight: '16px',
                        }}
                      >
                        Floor: {value.floor}, Room: {value.room}
                      </Typography>
                    )}
                  </MenuItem>
                );
              })
            )}
          </Box>
        </Menu>
      )}
    </>
  );
};
