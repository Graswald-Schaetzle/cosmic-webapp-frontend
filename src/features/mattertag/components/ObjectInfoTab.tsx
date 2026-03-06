import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { MatterTag } from '../../../types/matterport';
import { useDispatch } from 'react-redux';
import { openNewTaskWindow, openTaskWindow } from '../../../store/modalSlice';
import { LocationDetailResponse } from '../../../api/locationApi/locationApi';

interface ObjectInfoTabProps {
  tag: MatterTag | LocationDetailResponse;
  handleClose: () => void;
  locationData: LocationDetailResponse;
}

export const ObjectInfoTab = ({ tag, handleClose, locationData }: ObjectInfoTabProps) => {
  const dispatch = useDispatch();

  // Use location data from API
  const locationInfo = locationData?.description ? [locationData.description] : [];

  // Use real tasks from API response
  const tasks = Array.isArray(locationData?.tasks)
    ? locationData.tasks.map(task => {
        return {
          id: task.task_id,
          name: task.title || 'Untitled Task',
          status: task.status || 'Unknown Status',
          activity: task.task_type || 'Unknown Activity',
        };
      })
    : [];

  const handleTaskClick = (taskId: number) => {
    handleClose();
    dispatch(openTaskWindow({ taskId, source: 'mattertag', mattertagData: tag }));
  };

  const handleNewTaskClick = () => {
    handleClose();
    dispatch(
      openNewTaskWindow({
        preSelectedLocation: {
          id: locationData.location_id,
          name: locationData.location_name,
          room_id: locationData.room_id,
        },
        redirectBack: {
          type: 'mattertag',
          tagData: locationData,
        },
      })
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Location section */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Typography
          sx={{
            fontSize: '16px',
            fontWeight: 500,
            lineHeight: '18px',
            color: '#FFFFFF',
            ml: '18px',
          }}
        >
          Location
        </Typography>
        <Box sx={{ display: 'flex', gap: '8px' }}>
          {locationInfo.map((label, index) => (
            <Chip
              key={index}
              label={label}
              size="small"
              sx={{
                height: '40px',
                borderRadius: '500px',
                bgcolor: 'rgba(0, 0, 0, 0.15)',
                color: '#FFFFFF',
                padding: '8px 18px',
                '& .MuiChip-label': {
                  fontWeight: 600,
                  fontSize: '14px',
                  lineHeight: '22px',
                  letterSpacing: 0,
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  padding: 0,
                  width: '100%',
                },
              }}
            />
          ))}
        </Box>
      </Box>

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

      {/* Tasks List */}
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
        elevation={0}
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: 'rgba(0, 0, 0, 0.15)',
          borderRadius: '20px',
        }}
      >
        <List disablePadding>
          {tasks.length > 0 ? (
            tasks.map(task => (
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
            ))
          ) : (
            <ListItem>
              <ListItemText
                primary="No tasks found"
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
    </Box>
  );
};
