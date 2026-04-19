import { Dialog } from '../../components/Dialog';
import {
  Box,
  Typography,
  Button,
  Paper,
  ListItem,
  ListItemButton,
  ListItemText,
  List,
  IconButton,
  CircularProgress,
  TextField,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store.ts';
import {
  closeListWindow,
  openListWindow,
  openTaskWindow,
  openTasksWindow,
} from '../../store/modalSlice.ts';
import { useState } from 'react';
import {
  useGetListByIdQuery,
  useUpdateListMutation,
  useDeleteListMutation,
} from '../../api/lists/listsApi';
import { useCreateNotificationMutation } from '../../api/notifications/notificationApi';
import {
  createListDeletedNotification,
  createListUpdatedNotification,
} from '../../utils/notificationUtils';
import { ConfirmDeletionModal } from '../../components/ConfirmDeletionModal';
import { AddTaskToListModal } from './components/AddTaskToListModal';

export const ListWindow = () => {
  const dispatch = useDispatch();
  const { isOpen, listId } = useSelector((state: RootState) => state.modal.listWindowModal);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [editedTasks, setEditedTasks] = useState<Array<{ task_id: number; title: string }>>([]);

  // Fetch list data
  const {
    data: listData,
    isLoading,
    error,
  } = useGetListByIdQuery(listId || 0, { skip: !listId || !isOpen });

  const [updateList] = useUpdateListMutation();
  const [deleteList] = useDeleteListMutation();
  const [createNotification] = useCreateNotificationMutation();

  const list = listData?.list;

  const handleTaskClick = (taskId: number) => {
    if (isEditMode) {
      // In edit mode, immediately remove task from local state
      setEditedTasks(prev => prev.filter(task => task.task_id !== taskId));
    } else {
      // Normal mode, close list window and open task window with redirect back
      dispatch(closeListWindow());
      dispatch(
        openTaskWindow({
          taskId,
          source: 'liststab',
          listId: listId || undefined,
          redirectBack: {
            type: 'lists',
            listId: listId || undefined,
          },
        })
      );
    }
  };

  const handleClose = () => {
    setIsEditMode(false);
    setEditName('');
    setEditedTasks([]);
    setShowAddTaskModal(false);
    dispatch(closeListWindow());
    dispatch(openTasksWindow({ activeTab: 1 }));
  };

  const handleAddTaskModalClose = () => {
    setShowAddTaskModal(false);
    // Reopen the ListWindow when AddTaskToListModal is closed
    dispatch(openListWindow(listId || 0));
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!listId || !list) return;

    try {
      await deleteList(listId).unwrap();

      // Create notification for list deletion
      await createListDeletedNotification(createNotification, list.name);

      // Success - close the list window and open ListsTab
      dispatch(closeListWindow());
      dispatch(openTasksWindow({ activeTab: 1 }));
    } catch (error) {
      console.error('Failed to delete list:', error);
      // Error handling is done in the ConfirmDeletionModal component
    }
  };

  const handleAddTask = () => {
    setShowAddTaskModal(true);
  };

  const handleTaskSelect = async (taskId: number) => {
    if (!listId || !list) return;

    try {
      // Get current task IDs and add the new task
      const currentTaskIds = list.tasks.map(task => task.task_id);
      const newTaskIds = [...currentTaskIds, taskId];

      await updateList({
        id: listId,
        payload: {
          name: list.name,
          task_ids: newTaskIds,
        },
      });

      // Create notification for list update (task added)
      await createListUpdatedNotification(createNotification, list.name, 'updated with new task');
    } catch (error) {
      console.error('Failed to add task to list:', error);
    }
  };

  const toggleEditMode = () => {
    if (isEditMode) {
      // Exit edit mode without saving
      setIsEditMode(false);
      setEditName(list?.name || '');
      setEditedTasks([]);
    } else {
      // Enter edit mode
      setEditName(list?.name || '');
      setEditedTasks(list?.tasks || []);
      setIsEditMode(true);
    }
  };

  const handleSave = async () => {
    if (list) {
      const taskIds = editedTasks.map(task => task.task_id);
      await updateList({
        id: list.list_id,
        payload: {
          name: editName.trim() || list.name,
          task_ids: taskIds,
        },
      });

      // Create notification for list update (tasks modified)
      await createListUpdatedNotification(
        createNotification,
        editName.trim() || list.name,
        'updated with modified tasks'
      );

      setIsEditMode(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="w-[380px] max-w-full max-h-[67vh]"
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

  // Show error state
  if (error || !list) {
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="w-[380px] max-w-full max-h-[67vh]"
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
          <Typography sx={{ color: 'white', textAlign: 'center' }}>Error loading list</Typography>
        </Box>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[380px] max-w-full max-h-[67vh]"
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
        {/* Back/Delete Icon */}
        <IconButton
          onClick={isEditMode ? handleDelete : handleClose}
          size="small"
          aria-label={isEditMode ? 'Delete' : 'Back'}
          sx={{
            position: 'absolute',
            left: '18px',
            width: '40px',
            height: '40px',
            padding: 0,
            borderRadius: '100px',
            backgroundColor: isEditMode ? '#FF474780' : 'transparent',
            '&:hover': {
              backgroundColor: isEditMode ? '#FF4747' : 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <img
            src={isEditMode ? '/icons/mattertag/delete.svg' : '/icons/mattertag/arrow-left.svg'}
            alt={isEditMode ? 'Delete' : 'Back'}
            style={{ width: isEditMode ? '24px' : '40px', height: isEditMode ? '24px' : '40px' }}
          />
        </IconButton>
        {/* List Name */}
        <Box display="flex" alignItems="center" flex={1} justifyContent="center">
          {isEditMode ? (
            <TextField
              value={editName}
              onChange={e => setEditName(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#FFFFFF',
                  backgroundColor: '#00000026',
                  borderRadius: '14px',
                  height: '42px',
                  '& fieldset': {
                    borderColor: 'transparent',
                  },
                  '&:hover fieldset': {
                    borderColor: 'transparent',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'transparent',
                  },
                },
                '& .MuiInputBase-input': {
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '16px',
                  lineHeight: '22px',
                },
              }}
            />
          ) : (
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '16px',
                lineHeight: '22px',
                color: '#FFFFFF',
              }}
            >
              {list.name}
            </Typography>
          )}
        </Box>
        {/* Edit Icon */}
        <IconButton
          onClick={toggleEditMode}
          size="small"
          aria-label="Edit tag"
          sx={{
            position: 'absolute',
            right: '18px',
            width: '40px',
            height: '40px',
            padding: 0,
            borderRadius: '100px',
            backgroundColor: isEditMode ? '#FFFFFF' : 'transparent',
            '&:hover': {
              backgroundColor: isEditMode ? '#FFFFFF' : 'rgba(255, 255, 255, 0.1)',
            },
            '& img': {
              width: '40px',
              height: '40px',
            },
          }}
        >
          <img
            src="/icons/mattertag/edit.svg"
            alt="Edit"
            style={{
              filter: isEditMode ? 'brightness(0)' : 'none',
            }}
          />
        </IconButton>
      </Box>

      {/* Re-schedule All */}
      {!isEditMode && (
        <Button
          variant="outlined"
          startIcon={<img src="/icons/mattertag/re-schedule-all.svg" alt="Re-schedule All" />}
          fullWidth
          sx={{
            justifyContent: 'flex-start',
            width: { xs: '100%', sm: '356px' },
            maxWidth: '100%',
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
          Re-schedule All
        </Button>
      )}

      {/* Add Task to List Button */}
      {!isEditMode && (
        <Button
          onClick={handleAddTask}
          variant="outlined"
          startIcon={<img src="/icons/mattertag/plus.svg" alt="Add" />}
          fullWidth
          sx={{
            justifyContent: 'flex-start',
            width: { xs: '100%', sm: '356px' },
            maxWidth: '100%',
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
          Add Task
        </Button>
      )}

      <Typography
        variant="subtitle2"
        sx={{
          mb: '-12px',
          padding: '0 18px',
          color: '#FFFFFF',
          fontSize: '16px',
          fontWeight: 500,
          lineHeight: '18px',
        }}
      >
        Tasks
      </Typography>

      <Paper
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: 'rgba(0, 0, 0, 0.15)',
          borderRadius: '20px',
          boxShadow: 'none',
          // Hide scrollbar for Webkit browsers
          '&::-webkit-scrollbar': { display: 'none' },
          // Hide scrollbar for Firefox
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <List disablePadding>
          {(isEditMode ? editedTasks : list.tasks).length > 0 ? (
            (isEditMode ? editedTasks : list.tasks).map(task => (
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
                    height: '48px',
                    px: 2.25,
                    position: 'relative',
                    '&:hover': {
                      bgcolor: '#FFFFFF26',
                      '& .arrow-icon': {
                        display: isEditMode ? 'none' : 'block',
                      },
                      '& .delete-icon': {
                        display: isEditMode ? 'block' : 'none',
                      },
                    },
                  }}
                >
                  <ListItemText
                    primary={task.title}
                    primaryTypographyProps={{
                      sx: {
                        fontSize: '14px',
                        fontWeight: 500,
                        lineHeight: '22px',
                        color: '#FFFFFF',
                      },
                    }}
                    secondaryTypographyProps={{
                      sx: {
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.7)',
                      },
                    }}
                  />
                  {!isEditMode && (
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
                  )}
                  {isEditMode && (
                    <Box
                      className="delete-icon"
                      sx={{
                        display: 'none',
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        cursor: 'pointer',
                      }}
                    >
                      <img src="/icons/mattertag/cross.svg" alt="Delete" />
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>
            ))
          ) : (
            <ListItem>
              <ListItemText
                primary="No tasks in this list"
                primaryTypographyProps={{
                  sx: {
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    textAlign: 'center',
                  },
                }}
              />
            </ListItem>
          )}
        </List>
      </Paper>

      {isEditMode && (
        <Box sx={{ display: 'flex', gap: '8px', padding: '0' }}>
          <Button
            onClick={() => {
              setIsEditMode(false);
              setEditName(list.name);
              setEditedTasks([]);
            }}
            sx={{
              flex: 1,
              height: '48px',
              borderRadius: '20px',
              padding: '0 18px',
              backgroundColor: 'transparent',
              color: '#FFFFFF',
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            sx={{
              flex: 1,
              height: '48px',
              borderRadius: '20px',
              padding: '0 18px',
              backgroundColor: '#00000026',
              color: '#FFFFFF',
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
              },
            }}
          >
            Save
          </Button>
        </Box>
      )}

      {/* List Deletion Confirmation Modal */}
      <ConfirmDeletionModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete List"
        message="Do you want to delete this List?"
        itemType="List"
      />

      {/* Add Task to List Modal */}
      <AddTaskToListModal
        isOpen={showAddTaskModal}
        onClose={handleAddTaskModalClose}
        onTaskSelect={handleTaskSelect}
        existingTaskIds={list?.tasks.map(task => task.task_id) || []}
      />
    </Dialog>
  );
};
