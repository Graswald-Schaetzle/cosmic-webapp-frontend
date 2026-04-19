import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store.ts';
import { Dialog } from '../../components/Dialog';
import {
  closeNewTaskWindow,
  openMatterTagWindow,
  openCalendarWindow,
} from '../../store/modalSlice.ts';
import { useCreateTaskMutation } from '../../api/tasks/taskApi.ts';
import { useCreateNotificationMutation } from '../../api/notifications/notificationApi';
import { createTaskCreatedNotification } from '../../utils/notificationUtils';

import { NameModal } from '../task/components/NameModal';
import { TypeModal } from '../task/components/TypeModal';
import { StatusModal } from '../task/components/StatusModal';
import { AssigneeModal } from '../task/components/AssigneeModal';
import { ListModal } from '../task/components/ListModal';
import { CalendarModal } from '../task/components/CalendarModal';
import { RecurringModal } from '../task/components/RecurringModal';
import { TimePickerModal } from '../task/components/TimePickerModal';
import { Box, Typography, IconButton, Chip, Stack, TextField, Tooltip } from '@mui/material';
import { useState, useEffect } from 'react';

export const NewTaskWindow = () => {
  const dispatch = useDispatch();
  const { isOpen, preSelectedLocation, preSelectedDate, redirectBack } = useSelector(
    (state: RootState) => state.modal.newTaskWindowModal
  );
  const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();
  const [createNotification] = useCreateNotificationMutation();

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [typeAnchorEl, setTypeAnchorEl] = useState<HTMLElement | null>(null);

  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [nameAnchorEl, setNameAnchorEl] = useState<HTMLElement | null>(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusAnchorEl, setStatusAnchorEl] = useState<HTMLElement | null>(null);

  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
  const [assigneeAnchorEl, setAssigneeAnchorEl] = useState<HTMLElement | null>(null);

  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listAnchorEl, setListAnchorEl] = useState<HTMLElement | null>(null);

  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [recurringAnchorEl, setRecurringAnchorEl] = useState<HTMLElement | null>(null);

  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarAnchorEl, setCalendarAnchorEl] = useState<HTMLElement | null>(null);

  const [isTimePickerModalOpen, setIsTimePickerModalOpen] = useState(false);
  const [timePickerAnchorEl, setTimePickerAnchorEl] = useState<HTMLElement | null>(null);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<{
    type?: string;
    name?: string;
    assignee?: string;
    dueDate?: string;
  }>({});

  // Task state with proper structure
  const defaultTaskState = {
    type: '',
    name: '',
    status: 'To Do',
    assignee: '',
    assigneeId: 0,
    list: 'None',
    listId: 0,
    dueTime: '00:00',
    dueDate: '00.00.0000',
    recurring: '',
    description: '',
    tags: [],
    locationId: '',
  };
  const [task, setTask] = useState(defaultTaskState);

  // If preSelectedLocation changes (modal opened from MatterTag), set name/location and disable name field
  const nameFieldDisabled = Boolean(preSelectedLocation);

  // Styled tooltip component
  const StyledTooltip = ({ children, title }: { children: React.ReactElement; title: string }) => (
    <Tooltip
      title={title}
      placement="top"
      arrow
      PopperProps={{
        sx: {
          '& .MuiTooltip-tooltip': {
            backgroundColor: 'rgba(46, 46, 46, 0.95)',
            backdropFilter: 'blur(100px)',
            WebkitBackdropFilter: 'blur(100px)',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 500,
            padding: '8px 12px',
            borderRadius: '12px',
            boxShadow: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxWidth: '200px',
            textAlign: 'center',
          },
          '& .MuiTooltip-arrow': {
            color: 'rgba(46, 46, 46, 0.95)',
          },
        },
      }}
    >
      {children}
    </Tooltip>
  );

  // Validation function
  const validateTask = () => {
    const errors: typeof validationErrors = {};

    if (!task.type) {
      errors.type = 'Action is required';
    }

    if (!task.name) {
      errors.name = 'Object is required';
    }

    if (!task.assignee) {
      errors.assignee = 'Assignee is required';
    }

    if (task.dueDate === '00.00.0000') {
      errors.dueDate = 'Due date is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Clear validation errors when fields are updated
  const clearValidationError = (field: keyof typeof validationErrors) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  useEffect(() => {
    if (isOpen && preSelectedLocation) {
      setTask({
        ...defaultTaskState,
        name: preSelectedLocation.name,
        locationId: preSelectedLocation.id,
      });
    } else if (isOpen && preSelectedDate) {
      setTask({
        ...defaultTaskState,
        dueDate: preSelectedDate,
      });
    } else if (isOpen && !preSelectedLocation && !preSelectedDate) {
      setTask(defaultTaskState);
    }
    // Clear validation errors when modal opens
    setValidationErrors({});
    // eslint-disable-next-line
  }, [isOpen, preSelectedLocation, preSelectedDate]);

  const handleClose = () => {
    dispatch(closeNewTaskWindow());
    // If redirectBack is set, reopen appropriate window
    if (redirectBack) {
      if (redirectBack.type === 'mattertag' && redirectBack.tagData) {
        dispatch(openMatterTagWindow({ tag: redirectBack.tagData }));
      } else if (redirectBack.type === 'calendar') {
        dispatch(openCalendarWindow());
      }
    }
    setTask(defaultTaskState);
    setValidationErrors({});
  };

  const handleTypeSelect = (newType: string) => {
    setTask(prev => ({ ...prev, type: newType }));
    clearValidationError('type');
  };

  const handleTypeClick = (event: React.MouseEvent<HTMLElement>) => {
    setTypeAnchorEl(event.currentTarget);
    setIsTypeModalOpen(true);
  };

  const handleNameSelect = (newName: string, locationId: string) => {
    setTask(prev => ({ ...prev, name: newName, locationId }));
    clearValidationError('name');
  };

  const handleNameClick = (event: React.MouseEvent<HTMLElement>) => {
    if (nameFieldDisabled) return; // Prevent opening modal if disabled
    const container = event.currentTarget.closest('.type-name-container');
    if (container instanceof HTMLElement) {
      setNameAnchorEl(container);
      setIsNameModalOpen(true);
    }
  };

  const handleStatusSelect = (newStatus: string) => {
    setTask(prev => ({ ...prev, status: newStatus }));
  };

  const handleStatusClick = (event: React.MouseEvent<HTMLElement>) => {
    setStatusAnchorEl(event.currentTarget);
    setIsStatusModalOpen(true);
  };

  const handleAssigneeSelect = (newAssignee: string, userId: number) => {
    setTask(prev => ({ ...prev, assignee: newAssignee, assigneeId: userId }));
    clearValidationError('assignee');
  };

  const handleAssigneeClick = (event: React.MouseEvent<HTMLElement>) => {
    setAssigneeAnchorEl(event.currentTarget);
    setIsAssigneeModalOpen(true);
  };

  const handleListSelect = (newList: string, listId: number) => {
    setTask(prev => ({ ...prev, list: newList, listId }));
  };

  const handleListClick = (event: React.MouseEvent<HTMLElement>) => {
    setListAnchorEl(event.currentTarget);
    setIsListModalOpen(true);
  };

  const handleRecurringSelect = (newRecurring: string) => {
    setTask(prev => ({ ...prev, recurring: newRecurring }));
  };

  const handleRecurringClick = (event: React.MouseEvent<HTMLElement>) => {
    setRecurringAnchorEl(event.currentTarget);
    setIsRecurringModalOpen(true);
  };

  const handleCalendarSelect = (newDate: string) => {
    setTask(prev => ({ ...prev, dueDate: newDate }));
    clearValidationError('dueDate');
  };

  const handleCalendarClick = (event: React.MouseEvent<HTMLElement>) => {
    setCalendarAnchorEl(event.currentTarget);
    setIsCalendarModalOpen(true);
  };

  const handleTimePickerSelect = (newTime: string) => {
    setTask(prev => ({ ...prev, dueTime: newTime }));
  };

  const handleTimePickerClick = (event: React.MouseEvent<HTMLElement>) => {
    setTimePickerAnchorEl(event.currentTarget);
    setIsTimePickerModalOpen(true);
  };

  const handleSave = async () => {
    // Validate before saving
    if (!validateTask()) {
      return;
    }

    try {
      // Create title without separator
      const title =
        task.type && task.name ? `${task.type} ${task.name}` : task.name || task.type || 'New Task';

      // Convert date and time to ISO format
      let dueDate: string | undefined = undefined;
      if (task.dueDate !== '00.00.0000') {
        const [day, month, year] = task.dueDate.split('.');
        const time = task.dueTime !== '00:00' ? task.dueTime : '00:00';
        dueDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00.000Z`;
      }

      const taskData = {
        title,
        description: task.description,
        status: task.status,
        due_at: dueDate,
        task_type: task.type || undefined,
        created_by_user_id: task.assigneeId || undefined,
        recurrence_rule: task.recurring || undefined,
        location_id: task.locationId || undefined,
        lists_id: task.listId || undefined,
      };

      const result = await createTask(taskData).unwrap();

      // Create notification for the new task
      if (result.data && result.data.task_id) {
        const createdTask = result.data;
        await createTaskCreatedNotification(
          createNotification,
          taskData.title,
          task.assignee || 'Unassigned',
          task.name || 'Unknown Location',
          createdTask.task_id,
          task.locationId
        );
      }

      // On save, close and redirect if needed
      dispatch(closeNewTaskWindow());
      if (redirectBack) {
        if (redirectBack.type === 'mattertag' && redirectBack.tagData) {
          dispatch(openMatterTagWindow({ tag: redirectBack.tagData }));
        } else if (redirectBack.type === 'calendar') {
          dispatch(openCalendarWindow());
        }
      }
      setTask(defaultTaskState);
      setValidationErrors({});
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[380px] max-w-full max-h-[66vh]"
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
            New Task
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="Edit tag"
          sx={{
            position: 'absolute',
            right: '18px',
          }}
        >
          <img src="/icons/mattertag/cross.svg" alt="Close" />
        </IconButton>
      </Box>
      {/* Scrollable content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          gap: '20px',
          minHeight: 0,
          overflowY: 'auto',
          // Hide scrollbar for Webkit browsers
          '::-webkit-scrollbar': { display: 'none' },
          // Hide scrollbar for Firefox
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Type, Name */}
        <Box className="type-name-container" display="flex" flexDirection="column" gap="4px">
          <Box display="flex" alignItems="center" flex={1} justifyContent="start" gap="1px">
            {/* Left part */}
            <Box
              onClick={handleTypeClick}
              sx={{
                height: 40,
                maxWidth: 200,
                padding: '8px 12px',
                gap: '16px',
                borderTopLeftRadius: '500px',
                borderBottomLeftRadius: '500px',
                bgcolor: isTypeModalOpen ? '#FFFFFF' : '#00000026',
                color: isTypeModalOpen ? '#222' : '#fff',
                fontWeight: 600,
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                border: validationErrors.type ? '1px solid #ff4444' : 'none',
                '&:hover': {
                  bgcolor: isTypeModalOpen ? '#FFFFFF' : '#FFFFFF1A',
                },
              }}
              title={task.type || 'Select Action'}
            >
              {task.type || 'Select Action'}
            </Box>
            {/* Right part */}
            <StyledTooltip
              title={
                nameFieldDisabled
                  ? 'Object is pre-selected from MatterTag and cannot be changed'
                  : task.name || 'Select Object'
              }
            >
              <Box
                onClick={handleNameClick}
                sx={{
                  height: 40,
                  maxWidth: 250,
                  padding: '8px 12px',
                  gap: '16px',
                  borderTopRightRadius: '500px',
                  borderBottomRightRadius: '500px',
                  bgcolor: isNameModalOpen ? '#FFFFFF' : '#00000026',
                  color: isNameModalOpen ? '#222' : '#fff',
                  fontWeight: 600,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  opacity: nameFieldDisabled ? 0.6 : 1,
                  border: validationErrors.name ? '1px solid #ff4444' : 'none',
                  '&:hover': {
                    bgcolor: isNameModalOpen ? '#FFFFFF' : '#FFFFFF1A',
                  },
                }}
              >
                {task.name || 'Select Object'}
              </Box>
            </StyledTooltip>
          </Box>

          <TypeModal
            isOpen={isTypeModalOpen}
            onClose={() => {
              setIsTypeModalOpen(false);
              setTypeAnchorEl(null);
            }}
            onSelect={handleTypeSelect}
            currentType={task.type}
            anchorEl={typeAnchorEl}
            marginTop="-70px"
            marginLeft="-20px"
          />
          <NameModal
            isOpen={isNameModalOpen}
            onClose={() => {
              setIsNameModalOpen(false);
              setNameAnchorEl(null);
            }}
            onSelect={handleNameSelect}
            currentName={task.name}
            anchorEl={nameAnchorEl}
            marginTop="-70px"
            marginLeft="20px"
          />
        </Box>
        {/* Status, Assignee, List */}
        <Stack spacing="20px">
          <Box>
            <Row
              label="Status"
              value={task.status}
              isOpen={isStatusModalOpen}
              onClick={handleStatusClick}
            />
            <StatusModal
              isOpen={isStatusModalOpen}
              onClose={() => {
                setIsStatusModalOpen(false);
                setStatusAnchorEl(null);
              }}
              onSelect={handleStatusSelect}
              currentStatus={task.status}
              anchorEl={statusAnchorEl}
            />
          </Box>
          <Box>
            <Row
              label="Assignee"
              value={task.assignee || 'Select'}
              isOpen={isAssigneeModalOpen}
              onClick={handleAssigneeClick}
              hasError={!!validationErrors.assignee}
            />

            <AssigneeModal
              isOpen={isAssigneeModalOpen}
              onClose={() => {
                setIsAssigneeModalOpen(false);
                setAssigneeAnchorEl(null);
              }}
              onSelect={handleAssigneeSelect}
              currentAssignee={task.assignee}
              anchorEl={assigneeAnchorEl}
            />
          </Box>
          <Box>
            <Row
              label="List"
              value={task.list || 'Select'}
              isOpen={isListModalOpen}
              onClick={handleListClick}
            />
            <ListModal
              isOpen={isListModalOpen}
              onClose={() => {
                setIsListModalOpen(false);
                setListAnchorEl(null);
              }}
              onSelect={handleListSelect}
              currentLists={task.listId ? [{ list_id: task.listId, name: task.list }] : []}
              anchorEl={listAnchorEl}
            />
          </Box>
        </Stack>
        {/* Due date & Recurring */}
        <Box display="flex" justifyContent="space-between" gap={2}>
          {/* Due date */}
          <Box display="flex" flexDirection="column" flex={1} alignItems="flex-start">
            <Box
              sx={{
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                height: '42px',
              }}
            >
              <Typography color="#fff" sx={{ fontSize: 16 }}>
                Due date
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" flex={1} justifyContent="center">
              {/* Left part */}
              <Box
                onClick={handleTimePickerClick}
                sx={{
                  height: 40,
                  maxWidth: 80,
                  padding: '8px 8px 8px 18px',
                  gap: '16px',
                  borderTopLeftRadius: '500px',
                  borderBottomLeftRadius: '500px',
                  background: '#5E5E5E2E',
                  backgroundColor: '#00000033',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    bgcolor: '#FFFFFF1A',
                  },
                }}
              >
                {task.dueTime}
              </Box>
              {/* Right part */}
              <Box
                onClick={handleCalendarClick}
                sx={{
                  height: 40,
                  padding: '8px 18px 8px 8px',
                  gap: '16px',
                  borderTopRightRadius: '500px',
                  borderBottomRightRadius: '500px',
                  background: '#5E5E5E2E',
                  backgroundColor: '#00000033',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  opacity: 1,
                  border: validationErrors.dueDate ? '1px solid #ff4444' : 'none',
                  '&:hover': {
                    bgcolor: '#FFFFFF1A',
                  },
                }}
              >
                {task.dueDate}
              </Box>
            </Box>

            <TimePickerModal
              isOpen={isTimePickerModalOpen}
              onClose={() => {
                setIsTimePickerModalOpen(false);
                setTimePickerAnchorEl(null);
              }}
              onSelect={handleTimePickerSelect}
              currentTime={task.dueTime}
              anchorEl={timePickerAnchorEl}
            />
            <CalendarModal
              isOpen={isCalendarModalOpen}
              onClose={() => {
                setIsCalendarModalOpen(false);
                setCalendarAnchorEl(null);
              }}
              onSelect={handleCalendarSelect}
              currentDate={task.dueDate}
              anchorEl={calendarAnchorEl}
            />
          </Box>
          {/* Recurring */}
          <Box display="flex" flexDirection="column" flex={1} alignItems="flex-end">
            <Box
              sx={{
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                height: '42px',
              }}
            >
              <Typography color="#fff" sx={{ fontSize: 16 }}>
                Recurring
              </Typography>
            </Box>
            <Box
              onClick={handleRecurringClick}
              sx={{
                maxWidth: 150,
                height: 40,
                borderRadius: '500px',
                padding: '8px 10px 8px 18px',
                gap: '12px',
                background: '#5E5E5E2E',
                backgroundColor: '#00000033',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                '&:hover': {
                  bgcolor: '#FFFFFF1A',
                },
              }}
            >
              {task.recurring || 'Select'}
              <Box component="span" ml={1} display="flex" alignItems="center">
                <img
                  src={
                    isRecurringModalOpen
                      ? '/icons/mattertag/short-arrow-left.svg'
                      : '/icons/mattertag/short-arrow-right.svg'
                  }
                  alt="arrow"
                  style={{ width: 24, height: 24 }}
                />
              </Box>
            </Box>
            <RecurringModal
              isOpen={isRecurringModalOpen}
              onClose={() => {
                setIsRecurringModalOpen(false);
                setRecurringAnchorEl(null);
              }}
              onSelect={handleRecurringSelect}
              currentRecurring={task.recurring}
              anchorEl={recurringAnchorEl}
            />
          </Box>
        </Box>
        {/* Description */}
        <Box>
          <Box
            sx={{
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              height: '42px',
            }}
          >
            <Typography color="#fff" sx={{ fontSize: 16 }}>
              Description
            </Typography>
          </Box>
          <TextField
            multiline
            value={task.description}
            onChange={e => setTask(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Add description"
            variant="outlined"
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '20px',
                background: '#00000026',
                backgroundColor: '#00000026',
                color: '#fff',
                padding: '0 8px',
                minHeight: '42px',
                '& fieldset': {
                  border: 'none',
                },
                '&:hover fieldset': {
                  border: 'none',
                },
                '&.Mui-focused fieldset': {
                  border: 'none',
                },
                '& textarea': {
                  color: '#fff',
                  fontWeight: 500,
                  fontSize: 14,
                  padding: '12px 18px',
                  '&::placeholder': {
                    color: '#fff',
                    opacity: 0.7,
                  },
                },
              },
            }}
          />
        </Box>
        {/* Tags */}
        <Box
          sx={{
            opacity: 0.15,
          }}
        >
          <Box
            sx={{
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              height: '42px',
            }}
          >
            <Typography color="#fff" sx={{ fontSize: 16 }}>
              Tags
            </Typography>
          </Box>
          <Stack direction="row" flexWrap="wrap" gap="12px">
            {task.tags.length > 0 ? (
              task.tags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: '#5E5E5E2E',
                    backgroundColor: '#00000033',
                    color: '#fff',
                    borderRadius: '20px',
                    padding: '8px 6px',
                    height: 40,
                    maxWidth: 300,
                    fontSize: 14,
                    lineHeight: '22px',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      bgcolor: '#FFFFFF1A',
                    },
                  }}
                />
              ))
            ) : (
              <Box
                component="button"
                type="button"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: '#5E5E5E2E',
                  backgroundColor: '#00000033',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '8px 18px',
                  height: 40,
                  minWidth: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  gap: '8px',
                  transition: 'background 0.2s',
                  '&:hover': {
                    bgcolor: '#FFFFFF1A',
                  },
                }}
              >
                Add Tags
                <img
                  src="/icons/mattertag/plus.svg"
                  alt="Add"
                  style={{ width: 24, height: 24, display: 'block' }}
                />
              </Box>
            )}
          </Stack>
        </Box>
      </Box>
      <Box
        component="button"
        type="button"
        onClick={handleSave}
        disabled={isCreating}
        sx={{
          width: '100%',
          height: '48px',
          minHeight: '48px',
          maxHeight: '48px',
          padding: '0 18px',
          background: '#00000026',
          border: 'none',
          borderRadius: '500px',
          color: '#FFFFFF',
          fontWeight: 600,
          fontSize: '14px',
          lineHeight: '22px',
          cursor: isCreating ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
          opacity: isCreating ? 0.5 : 1,
          '&:hover': {
            background: isCreating ? '#00000026' : '#FFFFFF26',
            backgroundColor: isCreating ? '#00000026' : '#4E4E4E33',
            backgroundBlendMode: 'color-dodge',
          },
        }}
      >
        {isCreating ? 'Creating...' : 'Save'}
      </Box>
    </Dialog>
  );
};

// Row component for label-value pairs with arrow
const Row = ({
  label,
  value,
  onClick,
  isOpen,
  disabled = false,
  hasError = false,
}: {
  label: string;
  value: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  isOpen?: boolean;
  disabled?: boolean;
  hasError?: boolean;
}) => (
  <Box
    height="42px"
    display="flex"
    alignItems="center"
    justifyContent="space-between"
    sx={{
      opacity: disabled ? 0.15 : 1,
    }}
  >
    {/* Left side */}
    <Box
      sx={{
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
      }}
    >
      <Typography color="#fff" sx={{ fontSize: 16, fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
    {/* Right side */}
    <Box
      onClick={disabled ? undefined : onClick}
      sx={{
        maxWidth: 200,
        height: 40,
        borderRadius: '500px',
        padding: '8px 10px 8px 18px',
        gap: '12px',
        background: '#5E5E5E2E',
        backgroundColor: '#00000033',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#fff',
        fontWeight: 600,
        fontSize: 14,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
        border: hasError ? '1px solid #ff4444' : 'none',
        '&:hover': {
          bgcolor: onClick ? '#FFFFFF1A' : 'transparent',
        },
      }}
    >
      {value}
      <Box component="span" ml={1} display="flex" alignItems="center">
        <img
          src={
            isOpen
              ? '/icons/mattertag/short-arrow-left.svg'
              : '/icons/mattertag/short-arrow-right.svg'
          }
          alt="arrow"
          style={{ width: 24, height: 24 }}
        />
      </Box>
    </Box>
  </Box>
);
