import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store.ts';
import { Dialog } from '../../components/Dialog';
import { closeNotificationWindow } from '../../store/modalSlice.ts';
import {
  useGetNotificationsQuery,
  useMarkNotificationsAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  Notification,
} from '../../api/notifications/notificationApi';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  styled,
  Collapse,
  Button,
  CircularProgress,
} from '@mui/material';
import { useState, useMemo, useEffect } from 'react';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

const StyledListItem = styled(ListItemButton)(() => ({
  height: '48px',
  padding: '12px 18px 12px 36px',
  gap: '16px',
  borderRadius: '20px',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  '&.Mui-selected': {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    color: '#000000',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    '& img': {
      filter: 'brightness(0)',
    },
  },
}));

const NewBadge = styled(Box)({
  width: '34px',
  height: '18px',
  borderRadius: '500px',
  padding: '4px 8px',
  backgroundColor: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& .MuiTypography-root': {
    fontWeight: 600,
    fontSize: '8px',
    lineHeight: '100%',
    color: '#2E2E2E',
  },
});

export const NotificationWindow = () => {
  const dispatch = useDispatch();
  const { isOpen, selectedNotificationId } = useSelector(
    (state: RootState) => state.modal.notificationWindowModal
  );
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [isAllSelected, setIsAllSelected] = useState(true);
  const [expandedFloors, setExpandedFloors] = useState<number[]>([]);

  // Fetch all notifications once without filters
  const { data: notificationsResponse, isLoading, error } = useGetNotificationsQuery({});

  // Auto-select floor/room based on selected notification
  useEffect(() => {
    if (selectedNotificationId && notificationsResponse?.floors) {
      // Find the notification and its location
      for (const floor of notificationsResponse.floors) {
        for (const room of floor.rooms) {
          const notification = room.notifications.find(
            n => n.notification_id === selectedNotificationId
          );
          if (notification) {
            setSelectedFloor(floor.floor_id);
            setSelectedRoom(room.room_id);
            setIsAllSelected(false);
            // Expand the floor to show the room
            setExpandedFloors(prev =>
              prev.includes(floor.floor_id) ? prev : [...prev, floor.floor_id]
            );
            break;
          }
        }
      }
    }
  }, [selectedNotificationId, notificationsResponse]);
  const [markNotificationsAsRead] = useMarkNotificationsAsReadMutation();
  const [markAllNotificationsAsRead] = useMarkAllNotificationsAsReadMutation();

  // Filter notifications locally based on selection
  const filteredNotifications = useMemo(() => {
    if (!notificationsResponse?.floors) return [];

    let notifications: Notification[] = [];

    if (isAllSelected) {
      // Return all notifications
      notifications = notificationsResponse.floors.flatMap(f =>
        f.rooms.flatMap(r => r.notifications)
      );
    } else if (selectedRoom) {
      // Return notifications for specific room
      notifications =
        notificationsResponse.floors.flatMap(f => f.rooms).find(r => r.room_id === selectedRoom)
          ?.notifications || [];
    } else if (selectedFloor) {
      // Return notifications for specific floor
      notifications =
        notificationsResponse.floors
          .find(f => f.floor_id === selectedFloor)
          ?.rooms.flatMap(r => r.notifications) || [];
    }

    // Sort notifications: unread notifications first, then by creation date (newest first)
    return notifications.sort((a, b) => {
      // First priority: unread notifications come first
      if (a.read_at === null && b.read_at !== null) return -1;
      if (a.read_at !== null && b.read_at === null) return 1;

      // Second priority: newest notifications first (by created_at)
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  }, [notificationsResponse, isAllSelected, selectedFloor, selectedRoom]);

  // Calculate total notifications for each floor and room
  const floorTotals = useMemo(() => {
    if (!notificationsResponse?.floors) return {};

    const totals: Record<number, number> = {};
    notificationsResponse.floors.forEach(floor => {
      totals[floor.floor_id] = floor.rooms.reduce(
        (sum, room) => sum + room.notifications.length,
        0
      );
    });
    return totals;
  }, [notificationsResponse]);

  const roomTotals = useMemo(() => {
    if (!notificationsResponse?.floors) return {};

    const totals: Record<number, number> = {};
    notificationsResponse.floors.forEach(floor => {
      floor.rooms.forEach(room => {
        totals[room.room_id] = room.notifications.length;
      });
    });
    return totals;
  }, [notificationsResponse]);

  const totalNotifications = useMemo(() => {
    if (!notificationsResponse?.floors) return 0;
    return notificationsResponse.floors.reduce(
      (sum, floor) =>
        sum + floor.rooms.reduce((roomSum, room) => roomSum + room.notifications.length, 0),
      0
    );
  }, [notificationsResponse]);

  const handleClose = () => {
    dispatch(closeNotificationWindow());
  };

  const handleAllNotificationsClick = () => {
    setIsAllSelected(true);
    setSelectedFloor(null);
    setSelectedRoom(null);
  };

  const handleFloorClick = (floorId: number) => {
    // Always select the floor when clicked
    setSelectedFloor(floorId);
    setSelectedRoom(null);
    setIsAllSelected(false);
  };

  const handleFloorExpandClick = (floorId: number, event: React.MouseEvent) => {
    // Prevent the floor selection when clicking the expand button
    event.stopPropagation();
    setExpandedFloors(prev =>
      prev.includes(floorId) ? prev.filter(id => id !== floorId) : [...prev, floorId]
    );
  };

  const handleRoomClick = (roomId: number) => {
    setSelectedRoom(roomId);
    setIsAllSelected(false);
    // Always find and set the floor that contains this room
    const floor = notificationsResponse?.floors?.find(f => f.rooms.some(r => r.room_id === roomId));
    if (floor) {
      setSelectedFloor(floor.floor_id);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark this specific notification as read using notification_id
      await markNotificationsAsRead({
        notification_id: notification.notification_id,
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleReadAllClick = async () => {
    try {
      if (isAllSelected) {
        // Mark all notifications as read
        await markAllNotificationsAsRead({});
      } else if (selectedFloor && selectedRoom) {
        // Mark all notifications in the selected room as read
        await markNotificationsAsRead({
          room_id: selectedRoom,
        });
      } else if (selectedFloor) {
        // Mark all notifications in the selected floor as read
        await markNotificationsAsRead({
          floor_id: selectedFloor,
        });
      }
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="w-[756px]"
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
            maxHeight: '90vh',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress sx={{ color: '#fff' }} />
        </Box>
      </Dialog>
    );
  }

  // Show error state
  if (error) {
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="w-[756px]"
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
            maxHeight: '90vh',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Typography sx={{ color: '#ff6b6b', textAlign: 'center' }}>
            Error loading notifications
          </Typography>
        </Box>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[756px]"
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
          maxHeight: '90vh',
        },
      }}
    >
      <Box sx={{ display: 'flex', gap: '20px' }}>
        {/* Left Column */}
        <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header */}
          <Box
            sx={{
              height: '40px',
              padding: '0 0 0 16px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '20px',
                lineHeight: '32px',
                color: '#FFFFFF',
                textAlign: 'left',
              }}
            >
              Notifications
            </Typography>
          </Box>

          {/* All Notifications Box */}
          <StyledListItem
            selected={isAllSelected}
            onClick={handleAllNotificationsClick}
            sx={{
              height: '48px',
              minHeight: '48px',
              maxHeight: '48px',
              padding: '12px 18px 12px 18px',
              backgroundColor: 'transparent',
            }}
          >
            <ListItemText
              primary="All notifications"
              primaryTypographyProps={{
                sx: {
                  fontWeight: 500,
                  fontSize: '16px',
                  lineHeight: '22px',
                  color: isAllSelected ? '#000000' : '#FFFFFF',
                },
              }}
            />
            <Typography
              sx={{
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '22px',
                color: isAllSelected ? '#000000' : '#FFFFFF',
              }}
            >
              {totalNotifications}
            </Typography>
          </StyledListItem>

          {/* Locations List */}
          <List sx={{ padding: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {notificationsResponse?.floors?.map(floor => (
              <Box key={floor.floor_id}>
                <Box
                  onClick={() => handleFloorClick(floor.floor_id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    padding: '12px 18px',
                    borderRadius: '20px',
                    backgroundColor:
                      selectedFloor === floor.floor_id ? 'rgba(255, 255, 255, 0.8)' : 'transparent',
                    color: selectedFloor === floor.floor_id ? '#000000' : '#FFFFFF',
                    '&:hover': {
                      backgroundColor:
                        selectedFloor === floor.floor_id
                          ? 'rgba(255, 255, 255, 0.9)'
                          : 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 600,
                      fontSize: '16px',
                      lineHeight: '22px',
                      color: selectedFloor === floor.floor_id ? '#000000' : '#FFFFFF',
                    }}
                  >
                    Floor {floor.floor_name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: '16px',
                        lineHeight: '22px',
                        color: selectedFloor === floor.floor_id ? '#000000' : '#FFFFFF',
                      }}
                    >
                      {floorTotals[floor.floor_id] || 0}
                    </Typography>
                    <Box
                      onClick={event => handleFloorExpandClick(floor.floor_id, event)}
                      sx={{ cursor: 'pointer' }}
                    >
                      {expandedFloors.includes(floor.floor_id) ? (
                        <ExpandLess
                          sx={{ color: selectedFloor === floor.floor_id ? '#000000' : '#FFFFFF' }}
                        />
                      ) : (
                        <ExpandMore
                          sx={{ color: selectedFloor === floor.floor_id ? '#000000' : '#FFFFFF' }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>
                <Collapse in={expandedFloors.includes(floor.floor_id)} timeout="auto" unmountOnExit>
                  {floor.rooms.map(room => (
                    <ListItem key={room.room_id} disablePadding>
                      <StyledListItem
                        selected={selectedRoom === room.room_id}
                        onClick={() => handleRoomClick(room.room_id)}
                        sx={{
                          padding: '12px 18px 12px 18px',
                          marginLeft: '18px',
                          marginTop: '4px',
                        }}
                      >
                        <ListItemText
                          primary={room.room_name}
                          primaryTypographyProps={{
                            sx: {
                              fontWeight: 500,
                              fontSize: '16px',
                              lineHeight: '22px',
                              color: selectedRoom === room.room_id ? '#000000' : '#FFFFFF',
                            },
                          }}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Typography
                            sx={{
                              fontWeight: 500,
                              fontSize: '16px',
                              lineHeight: '22px',
                              color: selectedRoom === room.room_id ? '#000000' : '#FFFFFF',
                            }}
                          >
                            {roomTotals[room.room_id] || 0}
                          </Typography>
                          <img
                            src="/icons/mattertag/arrow-right.svg"
                            alt="arrow"
                            style={{
                              filter: selectedRoom === room.room_id ? 'brightness(0)' : 'none',
                            }}
                          />
                        </Box>
                      </StyledListItem>
                    </ListItem>
                  ))}
                </Collapse>
              </Box>
            ))}
          </List>
        </Box>

        {/* Right Column */}
        <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header */}
          <Box
            sx={{
              height: '40px',
              padding: '0 0 0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
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
              {isAllSelected
                ? 'All notifications'
                : selectedRoom
                  ? notificationsResponse?.floors
                      ?.flatMap(f => f.rooms)
                      .find(r => r.room_id === selectedRoom)?.room_name || 'Unknown Room'
                  : selectedFloor
                    ? `Floor ${notificationsResponse?.floors?.find(f => f.floor_id === selectedFloor)?.floor_name || selectedFloor}`
                    : 'Notifications'}
            </Typography>
            <Button
              sx={{
                height: '40px',
                borderRadius: '500px',
                padding: '8px 18px',
                gap: '12px',
                backgroundColor: '#00000026',
                color: '#FFFFFF',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
              onClick={handleReadAllClick}
            >
              Read All
            </Button>
          </Box>

          {/* Notifications List */}
          <List
            sx={{
              border: '1px solid #FFFFFF40',
              borderRadius: '20px',
              overflow: 'hidden',
              margin: 0,
              padding: 0,
              '& .MuiListItem-root:first-of-type': {
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
              },
              '& .MuiListItem-root:last-of-type': {
                borderBottomLeftRadius: '20px',
                borderBottomRightRadius: '20px',
              },
            }}
          >
            {filteredNotifications.map((notification, index, array) => (
              <ListItem
                key={notification.notification_id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  height: '48px',
                  padding: '0 18px',
                  margin: 0,
                  borderBottom: index !== array.length - 1 ? '1px solid #FFFFFF40' : 'none',
                  cursor: 'pointer',
                  backgroundColor:
                    notification.notification_id === selectedNotificationId
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'transparent',
                  '&:hover': {
                    backgroundColor:
                      notification.notification_id === selectedNotificationId
                        ? 'rgba(255, 255, 255, 0.25)'
                        : 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 500,
                      fontSize: '14px',
                      lineHeight: '22px',
                      color: '#FFFFFF',
                    }}
                  >
                    {notification.name}
                  </Typography>
                  {notification.read_at === null && (
                    <NewBadge>
                      <Typography>New</Typography>
                    </NewBadge>
                  )}
                </Box>
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    </Dialog>
  );
};
