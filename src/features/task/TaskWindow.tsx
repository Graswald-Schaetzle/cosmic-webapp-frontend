import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store.ts';
import { Dialog } from '../../components/Dialog';
import {
  closeTaskWindow,
  openTasksWindow,
  openMatterTagWindow,
  openListWindow,
  openCalendarWindow,
  openListsWindow,
} from '../../store/modalSlice.ts';
import {
  useGetTaskByIdQuery,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
} from '../../api/tasks/taskApi';
import { useCreateNotificationMutation } from '../../api/notifications/notificationApi';
import {
  createTaskUpdatedNotification,
  createTaskDeletedNotification,
} from '../../utils/notificationUtils';

import { NameModal } from './components/NameModal';
import { TypeModal } from './components/TypeModal';
import { StatusModal } from './components/StatusModal';
import { AssigneeModal } from './components/AssigneeModal';
import { ListModal } from './components/ListModal';
import { CalendarModal } from './components/CalendarModal';
import { RecurringModal } from './components/RecurringModal';
import { TimePickerModal } from './components/TimePickerModal';
import { ConfirmDeletionModal } from '../../components/ConfirmDeletionModal';
import { Box, Typography, IconButton, Stack, Paper, CircularProgress } from '@mui/material';
import { useState, useEffect } from 'react';

export const TaskWindow = () => {
  const dispatch = useDispatch();
  const { isOpen, taskId, source, mattertagData, listId, redirectBack } = useSelector(
    (state: RootState) => state.modal.taskWindowModal
  );

  // RTK Query hooks
  const {
    data: taskResponse,
    isLoading,
    error,
  } = useGetTaskByIdQuery(taskId!, {
    skip: !isOpen || !taskId,
  });

  const [updateTask] = useUpdateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [createNotification] = useCreateNotificationMutation();

  // Local state for live editing
  const [localTask, setLocalTask] = useState({
    type: 'Select Action',
    name: '',
    status: '',
    assignee: '',
    lists: [] as Array<{ list_id: number; name: string }>,
    dueTime: '00:00',
    dueDate: '00.00.0000',
    recurring: '',
    description: '',
    tags: [] as string[],
  });

  // State for description editing
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editingDescription, setEditingDescription] = useState('');

  // State for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset delete confirmation and editing states when modal opens/closes or taskId changes
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
      setIsEditingDescription(false);
      setEditingDescription('');
      // Reset task data to initial state
      setLocalTask({
        type: 'Select Action',
        name: '',
        status: '',
        assignee: '',
        lists: [],
        dueTime: '00:00',
        dueDate: '00.00.0000',
        recurring: '',
        description: '',
        tags: [] as string[],
      });
    }
  }, [isOpen, taskId]);

  // Get task data from local state (updated by useEffect when API data changes)
  const getTaskData = () => {
    return localTask;
  };

  const task = getTaskData();

  // Update local state when API data changes
  useEffect(() => {
    if (taskResponse?.task && !isLoading) {
      const apiTask = taskResponse.task;

      // Parse dueDate into separate date and time
      let parsedDueDate = '00.00.0000';
      let parsedDueTime = '00:00';

      if (apiTask.due_at) {
        const date = new Date(apiTask.due_at);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        parsedDueDate = `${day}.${month}.${year}`;

        parsedDueTime = date.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      const locationName =
        apiTask.location?.location_name || apiTask.title.split('|')[1]?.trim() || '';

      const newLocalTask = {
        type: apiTask.task_type || 'Select Action',
        name: locationName,
        status: apiTask.status || '',
        assignee: apiTask.assignee
          ? `${apiTask.assignee.first_name} ${apiTask.assignee.last_name}`
          : '',
        lists: apiTask.lists || [],
        dueTime: parsedDueTime,
        dueDate: parsedDueDate,
        recurring: apiTask.recurrence_rule || 'No',
        description: apiTask.description || '',
        tags: [],
      };

      setLocalTask(newLocalTask);
      // Reset editing states when task data changes
      setIsEditingDescription(false);
      setEditingDescription('');
    }
  }, [taskResponse, isLoading]);

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

  const handleRedirectBack = () => {
    if (redirectBack) {
      switch (redirectBack.type) {
        case 'mattertag':
          if (redirectBack.tagData) {
            dispatch(openMatterTagWindow({ tag: redirectBack.tagData }));
          } else {
            dispatch(openTasksWindow());
          }
          break;
        case 'calendar':
          dispatch(openCalendarWindow());
          break;
        case 'tasks':
          dispatch(openTasksWindow());
          break;
        case 'lists':
          if (redirectBack.listId) {
            dispatch(openListWindow(redirectBack.listId));
          } else {
            dispatch(openListsWindow());
          }
          break;
        default:
          dispatch(openTasksWindow());
      }
    } else {
      // fallback to old source-based logic
      switch (source) {
        case 'tasks':
          dispatch(openTasksWindow());
          break;
        case 'mattertag':
          if (mattertagData) {
            dispatch(openMatterTagWindow(mattertagData));
          } else {
            dispatch(openTasksWindow());
          }
          break;
        case 'list':
          if (listId) {
            dispatch(openListWindow(listId));
          } else {
            dispatch(openListsWindow());
          }
          break;
        case 'liststab':
          dispatch(openTasksWindow({ activeTab: 1 }));
          break;
        case 'calendar':
          dispatch(openCalendarWindow());
          break;
        default:
          dispatch(openTasksWindow());
      }
    }
    dispatch(closeTaskWindow());
  };

  const handleClose = () => {
    handleRedirectBack();
  };

  // Live edit handlers
  const handleTypeSelect = async (newType: string) => {
    if (!taskId || !taskResponse?.task) return;

    // Update local state immediately
    setLocalTask(prev => ({ ...prev, type: newType }));

    try {
      // Get current location name from task response
      const currentLocationName = taskResponse.task.location?.location_name || task.name;

      // Create new title without separator
      const newTitle = `${newType} ${currentLocationName}`;

      await updateTask({
        id: taskId,
        payload: {
          task_type: newType,
          title: newTitle,
          location_id: taskResponse.task.location.location_id,
        },
      });

      // Create notification for task type update
      await createTaskUpdatedNotification(
        createNotification,
        newTitle,
        'type',
        newType,
        taskId,
        taskResponse.task.location?.location_id
      );
    } catch (error) {
      console.error('Failed to update task type:', error);
    }
  };

  const handleTypeClick = (event: React.MouseEvent<HTMLElement>) => {
    setTypeAnchorEl(event.currentTarget);
    setIsTypeModalOpen(true);
  };

  const handleNameSelect = async (newName: string) => {
    if (!taskId || !taskResponse?.task) return;

    // Update local state immediately
    setLocalTask(prev => ({ ...prev, name: newName }));

    try {
      // Get current task type from task response
      const currentActivityName = taskResponse.task.task_type || task.type;

      // Create new title without separator
      const newTitle = `${currentActivityName} ${newName}`;

      await updateTask({
        id: taskId,
        payload: {
          title: newTitle,
          location_id: taskResponse.task.location.location_id,
        },
      });

      // Create notification for task name update
      await createTaskUpdatedNotification(
        createNotification,
        newTitle,
        'location',
        newName,
        taskId,
        taskResponse.task.location?.location_id
      );
    } catch (error) {
      console.error('Failed to update task name:', error);
    }
  };

  const handleNameClick = (event: React.MouseEvent<HTMLElement>) => {
    setNameAnchorEl(event.currentTarget);
    setIsNameModalOpen(true);
  };

  const handleStatusSelect = async (newStatus: string) => {
    if (!taskId || !taskResponse?.task) return;

    // Update local state immediately
    setLocalTask(prev => ({ ...prev, status: newStatus }));

    try {
      await updateTask({
        id: taskId,
        payload: {
          status: newStatus,
          location_id: taskResponse.task.location.location_id,
        },
      });

      // Create notification for task status update
      await createTaskUpdatedNotification(
        createNotification,
        taskResponse.task.title,
        'status',
        newStatus,
        taskId,
        taskResponse.task.location?.location_id
      );
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handleStatusClick = (event: React.MouseEvent<HTMLElement>) => {
    setStatusAnchorEl(event.currentTarget);
    setIsStatusModalOpen(true);
  };

  const handleAssigneeSelect = async (newAssignee: string, userId: number) => {
    if (!taskId || !taskResponse?.task) return;

    // Update local state immediately
    setLocalTask(prev => ({ ...prev, assignee: newAssignee }));

    try {
      await updateTask({
        id: taskId,
        payload: {
          created_by_user_id: userId,
          location_id: taskResponse.task.location.location_id,
        },
      });

      // Create notification for task assignee update
      await createTaskUpdatedNotification(
        createNotification,
        taskResponse.task.title,
        'assignee',
        newAssignee,
        taskId,
        taskResponse.task.location?.location_id
      );
    } catch (error) {
      console.error('Failed to update task assignee:', error);
    }
  };

  const handleAssigneeClick = (event: React.MouseEvent<HTMLElement>) => {
    setAssigneeAnchorEl(event.currentTarget);
    setIsAssigneeModalOpen(true);
  };

  const handleListSelect = async (newList: string, listId: number) => {
    if (!taskId || !taskResponse?.task) return;

    // Check if list is already selected
    const isAlreadySelected = localTask.lists.some(list => list.list_id === listId);

    let updatedLists;
    if (isAlreadySelected) {
      // Remove list if already selected
      updatedLists = localTask.lists.filter(list => list.list_id !== listId);
    } else {
      // Add list if not selected
      updatedLists = [...localTask.lists, { list_id: listId, name: newList }];
    }

    // Update local state immediately
    setLocalTask(prev => ({ ...prev, lists: updatedLists }));

    try {
      // Get all list IDs for the update
      const listIds = updatedLists.map(list => list.list_id);

      await updateTask({
        id: taskId,
        payload: {
          lists_ids: listIds,
          location_id: taskResponse.task.location.location_id,
        },
      });

      // Create notification for task list update
      const action = isAlreadySelected ? 'removed from' : 'added to';
      await createTaskUpdatedNotification(
        createNotification,
        taskResponse.task.title,
        'list',
        `${action} ${newList}`,
        taskId,
        taskResponse.task.location?.location_id
      );
    } catch (error) {
      console.error('Failed to update task list:', error);
    }
  };

  const handleListClick = (event: React.MouseEvent<HTMLElement>) => {
    setListAnchorEl(event.currentTarget);
    setIsListModalOpen(true);
  };

  const handleRecurringSelect = async (newRecurring: string) => {
    if (!taskId || !taskResponse?.task) return;

    // Update local state immediately
    setLocalTask(prev => ({ ...prev, recurring: newRecurring }));

    try {
      await updateTask({
        id: taskId,
        payload: {
          recurrence_rule: newRecurring,
          location_id: taskResponse.task.location.location_id,
        },
      });

      // Create notification for task recurring update
      await createTaskUpdatedNotification(
        createNotification,
        taskResponse.task.title,
        'recurring',
        newRecurring,
        taskId,
        taskResponse.task.location?.location_id
      );
    } catch (error) {
      console.error('Failed to update task recurring:', error);
    }
  };

  const handleRecurringClick = (event: React.MouseEvent<HTMLElement>) => {
    setRecurringAnchorEl(event.currentTarget);
    setIsRecurringModalOpen(true);
  };

  const handleCalendarSelect = async (newDate: string) => {
    if (!taskId || !taskResponse?.task) return;

    // Update local state immediately - only dueDate
    setLocalTask(prev => ({ ...prev, dueDate: newDate }));

    try {
      // Get current time from local state
      const currentTime = localTask.dueTime;

      // Convert date string to ISO format and combine with current time
      const [day, month, year] = newDate.split('.');
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${currentTime}:00.000Z`;

      await updateTask({
        id: taskId,
        payload: {
          due_at: isoDate,
          location_id: taskResponse.task.location.location_id,
        },
      });

      // Create notification for task due date update
      await createTaskUpdatedNotification(
        createNotification,
        taskResponse.task.title,
        'due date',
        newDate,
        taskId,
        taskResponse.task.location?.location_id
      );
    } catch (error) {
      console.error('Failed to update task date:', error);
    }
  };

  const handleCalendarClick = (event: React.MouseEvent<HTMLElement>) => {
    setCalendarAnchorEl(event.currentTarget);
    setIsCalendarModalOpen(true);
  };

  const handleTimePickerSelect = async (newTime: string) => {
    if (!taskId || !taskResponse?.task) return;

    // Update local state immediately - only dueTime
    setLocalTask(prev => ({ ...prev, dueTime: newTime }));

    try {
      // Get current date from local state
      const currentDate = localTask.dueDate;

      // Convert local date to ISO format and combine with new time
      const [day, month, year] = currentDate.split('.');
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${newTime}:00.000Z`;

      await updateTask({
        id: taskId,
        payload: {
          due_at: isoDate,
          location_id: taskResponse.task.location.location_id,
        },
      });

      // Create notification for task due time update
      await createTaskUpdatedNotification(
        createNotification,
        taskResponse.task.title,
        'due time',
        newTime,
        taskId,
        taskResponse.task.location?.location_id
      );
    } catch (error) {
      console.error('Failed to update task time:', error);
    }
  };

  const handleTimePickerClick = (event: React.MouseEvent<HTMLElement>) => {
    setTimePickerAnchorEl(event.currentTarget);
    setIsTimePickerModalOpen(true);
  };

  // Description editing handlers
  const handleDescriptionClick = () => {
    setIsEditingDescription(true);
    setEditingDescription(task.description);
  };

  // Auto-resize textarea when entering edit mode
  useEffect(() => {
    if (isEditingDescription) {
      // Use setTimeout to ensure the textarea is rendered
      setTimeout(() => {
        const textarea = document.querySelector(
          'textarea[placeholder="Enter description..."]'
        ) as HTMLTextAreaElement;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }
      }, 0);
    }
  }, [isEditingDescription]);

  const handleDescriptionApply = async () => {
    if (!taskId || !taskResponse?.task) return;

    // Update local state immediately
    setLocalTask(prev => ({ ...prev, description: editingDescription }));

    try {
      await updateTask({
        id: taskId,
        payload: {
          description: editingDescription,
          location_id: taskResponse.task.location.location_id,
        },
      });

      // Create notification for task description update
      await createTaskUpdatedNotification(
        createNotification,
        taskResponse.task.title,
        'description',
        editingDescription.length > 50
          ? editingDescription.substring(0, 50) + '...'
          : editingDescription,
        taskId,
        taskResponse.task.location?.location_id
      );

      setIsEditingDescription(false);
    } catch (error) {
      console.error('Failed to update task description:', error);
    }
  };

  const handleDescriptionCancel = () => {
    setIsEditingDescription(false);
    setEditingDescription('');
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!taskId || !taskResponse?.task) return;

    try {
      await deleteTask(taskId).unwrap();

      // Create notification for task deletion
      await createTaskDeletedNotification(
        createNotification,
        taskResponse.task.title,
        taskResponse.task.location?.location_id
      );

      // Close the window after successful deletion
      dispatch(closeTaskWindow());

      // Navigate back based on source
      switch (source) {
        case 'tasks':
          dispatch(openTasksWindow());
          break;
        case 'mattertag':
          if (mattertagData) {
            dispatch(openMatterTagWindow(mattertagData));
          } else {
            dispatch(openTasksWindow());
          }
          break;
        case 'list':
          if (listId) {
            dispatch(openListWindow(listId));
          } else {
            dispatch(openListsWindow());
          }
          break;
        case 'liststab':
          dispatch(openTasksWindow({ activeTab: 1 }));
          break;
        case 'calendar':
          dispatch(openCalendarWindow());
          break;
        default:
          dispatch(openTasksWindow());
          break;
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      // You might want to show an error message to the user here
    }
  };

  if (!isOpen) return null;

  // Show loader while waiting for new data
  if (isLoading) {
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
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress sx={{ color: '#fff' }} />
        </Box>
      </Dialog>
    );
  }

  if (error) {
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
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Typography sx={{ color: '#ff6b6b', textAlign: 'center' }}>Error loading task</Typography>
        </Box>
      </Dialog>
    );
  }

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
          position: 'relative',
        },
      }}
    >
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} className="px-[18px]">
        {/* Back Button */}
        <IconButton
          onClick={handleRedirectBack}
          size="small"
          aria-label={'Back'}
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
            src={'/icons/mattertag/arrow-left.svg'}
            alt={'Back'}
            style={{ width: '40px', height: '40px' }}
          />
        </IconButton>
        {/* Delete Button */}
        <IconButton
          onClick={handleDelete}
          size="small"
          aria-label="Delete"
          sx={{
            position: 'absolute',
            right: '18px',
            width: '40px',
            height: '40px',
            padding: 0,
            borderRadius: '100px',
            backgroundColor: '#FF474780',
            '&:hover': {
              backgroundColor: '#FF4747',
            },
          }}
        >
          <img
            src="/icons/mattertag/delete.svg"
            alt="Delete"
            style={{ width: '24px', height: '24px' }}
          />
        </IconButton>
        {/* Center divided field */}
        <Box display="flex" alignItems="center" flex={1} justifyContent="center" gap="1px">
          {/* Left part */}
          <Box
            onClick={handleTypeClick}
            sx={{
              height: 40,
              maxWidth: 100,
              padding: '8px 12px',
              gap: '16px',
              borderTopLeftRadius: '500px',
              borderBottomLeftRadius: '500px',
              bgcolor: isTypeModalOpen ? '#FFFFFF' : '#00000026',
              color: isTypeModalOpen ? '#222' : '#fff',
              fontWeight: 600,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              opacity: 1,
              '&:hover': {
                bgcolor: isTypeModalOpen ? '#FFFFFF' : '#FFFFFF1A',
              },
            }}
            title={task.type}
          >
            {task.type}
          </Box>
          {/* Right part */}
          <Box
            onClick={handleNameClick}
            sx={{
              height: 40,
              maxWidth: 180,
              padding: '8px 12px',
              gap: '16px',
              borderTopRightRadius: '500px',
              borderBottomRightRadius: '500px',
              bgcolor: isNameModalOpen ? '#FFFFFF' : '#00000026',
              color: isNameModalOpen ? '#222' : '#fff',
              fontWeight: 600,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              opacity: 1,
              '&:hover': {
                bgcolor: isNameModalOpen ? '#FFFFFF' : '#FFFFFF1A',
              },
            }}
            title={task.name}
          >
            {task.name}
          </Box>
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
        />
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
              value={task.assignee}
              isOpen={isAssigneeModalOpen}
              onClick={handleAssigneeClick}
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
              value={
                task.lists.length === 0
                  ? 'None'
                  : task.lists.length === 1
                    ? task.lists[0].name
                    : `${task.lists.length} Lists`
              }
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
              currentLists={task.lists}
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
                  maxWidth: 130,
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
              key={task.dueDate}
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
              {task.recurring}
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
              padding: '12px 0 12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '42px',
            }}
          >
            <Typography color="#fff" sx={{ fontSize: 16 }}>
              Description
            </Typography>
            {isEditingDescription && (
              <Box display="flex" gap={1}>
                <IconButton
                  onClick={handleDescriptionApply}
                  size="small"
                  aria-label="Apply"
                  sx={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    bgcolor: '#00000026',
                    borderRadius: '50%',
                    '&:hover': {
                      bgcolor: '#FFFFFF1A',
                    },
                  }}
                >
                  <img
                    src="/icons/mattertag/check-icon.svg"
                    alt="Apply"
                    style={{ width: 20, height: 20 }}
                  />
                </IconButton>
                <IconButton
                  onClick={handleDescriptionCancel}
                  size="small"
                  aria-label="Cancel"
                  sx={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    bgcolor: '#00000026',
                    borderRadius: '50%',
                    '&:hover': {
                      bgcolor: '#FFFFFF1A',
                    },
                  }}
                >
                  <img
                    src="/icons/mattertag/cross.svg"
                    alt="Cancel"
                    style={{ width: 20, height: 20 }}
                  />
                </IconButton>
              </Box>
            )}
          </Box>
          {isEditingDescription ? (
            <Paper
              elevation={0}
              sx={{
                bgcolor: '#00000026',
                borderRadius: '20px',
                padding: '12px 18px',
                color: '#fff',
                fontWeight: 500,
                fontSize: 14,
                minHeight: '42px',
              }}
            >
              <textarea
                value={editingDescription}
                onChange={e => setEditingDescription(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '18px',
                  maxHeight: '200px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontWeight: 500,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'none',
                  overflow: 'hidden',
                  lineHeight: '1.4',
                  wordWrap: 'break-word',
                  wordBreak: 'break-word',
                }}
                placeholder="Enter description..."
                autoFocus
                onInput={e => {
                  // Auto-resize textarea
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                }}
              />
            </Paper>
          ) : (
            <Paper
              elevation={0}
              onClick={handleDescriptionClick}
              sx={{
                bgcolor: '#00000026',
                borderRadius: '20px',
                padding: '12px 18px',
                color: '#fff',
                fontWeight: 500,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'background 0.2s',
                minHeight: '42px',
                display: 'flex',
                alignItems: 'flex-start',
                '&:hover': {
                  bgcolor: '#FFFFFF1A',
                },
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  wordWrap: 'break-word',
                  wordBreak: 'break-word',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {task.description || 'Click to add description...'}
              </Box>
            </Paper>
          )}
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
            {task.tags.map(tag => (
              <Box
                key={tag}
                onClick={() => {}}
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
                  {tag}
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
                width: 40,
                height: 40,
                minWidth: 0,
                padding: 0,
                fontSize: 24,
                transition: 'background 0.2s',
                '&:hover': {
                  bgcolor: '#FFFFFF1A',
                },
              }}
            >
              <img
                src="/icons/mattertag/plus.svg"
                alt="Add"
                style={{ width: 24, height: 24, display: 'block' }}
              />
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Task Deletion Confirmation Modal */}
      <ConfirmDeletionModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        message="Do you want to delete this Task?"
        itemType="Task"
      />
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
}: {
  label: string;
  value: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  isOpen?: boolean;
  disabled?: boolean;
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
