import { Dialog } from '../../components/Dialog';
import { Box, Typography, Tabs, Tab, Paper, Button } from '@mui/material';
import { TasksTab } from './components/TasksTab.tsx';
import { ListsTab } from './components/ListsTab.tsx';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store.ts';
import { closeTasksWindow } from '../../store/modalSlice.ts';
import { UniversalFilterModal, FilterType } from '../../components/UniversalFilterModal';
import { useGetTasksQuery } from '../../api/tasks/taskApi';
import { useSpace } from '../../contexts/SpaceContext';

export function TasksWindow() {
  const dispatch = useDispatch();
  const { activeSpaceId } = useSpace();
  const { isOpen, activeTab: initialActiveTab } = useSelector(
    (state: RootState) => state.modal.tasksWindowModal
  );
  const {
    data: tasksResponse,
    isLoading,
    error,
  } = useGetTasksQuery(
    activeSpaceId ? { space_id: activeSpaceId } : undefined,
    { skip: !isOpen }
  );

  const [filters, setFilters] = useState<Array<{ type: FilterType; value: string }>>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);

  const [activeTab, setActiveTab] = useState(initialActiveTab);

  useEffect(() => {
    setActiveTab(initialActiveTab);
  }, [initialActiveTab]);

  const handleFilterSelect = (filterType: FilterType, value: string) => {
    // If it's a due date filter, remove any existing due date filter first
    if (filterType === 'Due date') {
      setFilters(prev => prev.filter(filter => filter.type !== 'Due date'));
    }

    // For Object filters, check if the same object is already filtered
    if (filterType === 'Object') {
      const existingObjectFilter = filters.find(
        filter => filter.type === 'Object' && filter.value === value
      );
      if (existingObjectFilter) {
        // Don't add duplicate Object filter
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

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleClose = () => {
    setFilters([]);
    setIsFilterOpen(false);
    setFilterAnchorEl(null);
    dispatch(closeTasksWindow());
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[380px] max-w-full"
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
          maxHeight: '66vh',
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
              fontFamily:
                '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            {activeTab === 1 ? 'Lists' : 'All Tasks'}
          </Typography>
        </Box>
        <Button
          onClick={handleFilterClick}
          disabled={activeTab === 1}
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
              bgcolor: '#FFFFFF1A',
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
          availableFilterTypes={
            activeTab === 0
              ? ['Status', 'Object', 'Floor', 'Room', 'Due date', 'Assignee', 'Task type']
              : []
          }
        />
      </Box>

      {/* Tabs */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Paper
          elevation={0}
          sx={{
            width: { xs: '100%', sm: '356px' },
            maxWidth: '100%',
            height: '44px',
            bgcolor: 'rgba(0, 0, 0, 0.15)',
            p: '4px',
            borderRadius: '100px',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              width: '100%',
              minHeight: 'unset',
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTabs-flexContainer': {
                gap: '6px',
                padding: '0',
                height: '36px',
              },
              '& .MuiTab-root': {
                width: { xs: '50%', sm: '172px' },
                flex: { xs: 1, sm: 'none' },
                height: '36px',
                borderRadius: '20px',
                textTransform: 'none',
                fontWeight: '600',
                color: '#FFFFFF',
                fontSize: '14px',
                padding: 0,
                minHeight: 'unset',
                transition: 'background-color 0.2s',
                '&.Mui-selected': {
                  bgcolor: 'rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                },
                '&:not(.Mui-selected)': {
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                  },
                },
                '&.Mui-disabled': {
                  color: 'rgba(255, 255, 255, 0.3)',
                },
              },
            }}
          >
            <Tab label="Tasks" />
            <Tab label="Lists" />
          </Tabs>
        </Paper>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 ? (
        <TasksTab
          tasks={tasksResponse?.data}
          loading={isLoading}
          error={error ? 'Failed to load tasks' : null}
          filters={filters}
          handleRemoveFilter={handleRemoveFilter}
          handleClose={handleClose}
        />
      ) : (
        <ListsTab handleClose={handleClose} />
      )}
    </Dialog>
  );
}
