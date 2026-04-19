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
  Collapse,
  CircularProgress,
} from '@mui/material';
import { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store.ts';
import { closeObjectManagerWindow, openMatterTagWindow } from '../../store/modalSlice.ts';
import { UniversalFilterModal, FilterType } from '../../components/UniversalFilterModal';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useLocations } from '../../hooks/useLocations';
import { LocationItem, LocationDetailResponse } from '../../api/locationApi/locationApi';

interface ObjectItem {
  id: string;
  name: string;
  location: LocationItem;
}

interface Room {
  id: string;
  name: string;
  objects: ObjectItem[];
}

interface Floor {
  id: string;
  name: string;
  rooms: Room[];
}

export function ObjectManagerWindow() {
  const dispatch = useDispatch();
  const { isOpen } = useSelector((state: RootState) => state.modal.objectManagerWindowModal);
  const { locations, isLoading, error } = useLocations();

  const [filters, setFilters] = useState<Array<{ type: FilterType; value: string }>>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [expandedFloors, setExpandedFloors] = useState<{ [key: string]: boolean }>({});
  const [expandedRooms, setExpandedRooms] = useState<{ [key: string]: boolean }>({});

  // Transform locations data into floors/rooms/objects structure
  const floors: Floor[] = useMemo(() => {
    if (!locations) return [];

    // Group locations by floor and room
    const floorMap = new Map<string, Floor>();

    locations.forEach(location => {
      const floorId = location.floor_id != null ? location.floor_id.toString() : 'unassigned';
      const roomId = location.room_id != null ? location.room_id.toString() : 'unassigned';
      const floorName =
        location.floor_name ||
        (location.floor_id != null ? `Floor ${location.floor_id}` : 'Unassigned');
      const roomName =
        location.room_name ||
        (location.room_id != null ? `Room ${location.room_id}` : 'Unassigned');

      // Create or get floor
      if (!floorMap.has(floorId)) {
        floorMap.set(floorId, {
          id: floorId,
          name: floorName,
          rooms: [],
        });
      }

      const floor = floorMap.get(floorId)!;

      // Find or create room
      let room = floor.rooms.find(r => r.id === roomId);
      if (!room) {
        room = {
          id: roomId,
          name: roomName,
          objects: [],
        };
        floor.rooms.push(room);
      }

      // Add location as an object
      room.objects.push({
        id: location.location_id,
        name: location.location_name,
        location: location,
      });
    });

    return Array.from(floorMap.values());
  }, [locations]);

  const filteredFloors = useMemo(() => {
    if (filters.length === 0) return floors;

    return floors
      .map(floor => {
        const isFloorMatch = filters.some(
          filter => filter.type === 'Floor' && floor.id === filter.value
        );
        const filteredRooms = floor.rooms.filter(room => {
          const isRoomMatch = filters.some(
            filter => filter.type === 'Room' && room.id === filter.value
          );
          return isRoomMatch;
        });

        if (isFloorMatch) {
          // If floor is selected, show all rooms and objects
          return {
            ...floor,
            rooms: floor.rooms.map(room => ({
              ...room,
              objects: room.objects,
            })),
          };
        } else if (filteredRooms.length > 0) {
          // If rooms are selected, show all objects in those rooms
          return {
            ...floor,
            rooms: filteredRooms.map(room => ({
              ...room,
              objects: room.objects,
            })),
          };
        }
        return null;
      })
      .filter(Boolean) as Floor[];
  }, [floors, filters]);

  const handleFloorClick = (floorId: string) => {
    setExpandedFloors(prev => ({
      ...prev,
      [floorId]: !prev[floorId],
    }));
  };

  const handleRoomClick = (roomId: string) => {
    setExpandedRooms(prev => ({
      ...prev,
      [roomId]: !prev[roomId],
    }));
  };

  // Function to get display name for filter
  const getFilterDisplayName = (filter: { type: FilterType; value: string }) => {
    switch (filter.type) {
      case 'Floor': {
        const floor = floors.find(f => f.id === filter.value);
        return floor ? `Floor: ${floor.name}` : filter.value;
      }
      case 'Room': {
        const room = floors.flatMap(f => f.rooms).find(r => r.id === filter.value);
        return room ? `Room: ${room.name}` : filter.value;
      }
      default:
        return filter.value;
    }
  };

  const handleFilterSelect = (filterType: FilterType, value: string) => {
    setFilters(prev => [...prev, { type: filterType, value }]);

    // Auto-expand relevant sections
    floors.forEach(floor => {
      const isFloorMatch = filterType === 'Floor' && floor.id === value;
      const hasMatchingRoom = filterType === 'Room' && floor.rooms.some(room => room.id === value);

      if (isFloorMatch) {
        // If floor is selected, expand all rooms
        setExpandedFloors(prev => ({ ...prev, [floor.id]: true }));
        floor.rooms.forEach(room => {
          setExpandedRooms(prev => ({ ...prev, [room.id]: true }));
        });
      } else if (hasMatchingRoom) {
        // If room is selected, expand its floor and the room
        setExpandedFloors(prev => ({ ...prev, [floor.id]: true }));
        floor.rooms.forEach(room => {
          if (room.id === value) {
            setExpandedRooms(prev => ({ ...prev, [room.id]: true }));
          }
        });
      }
    });
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

  const handleObjectClick = (objId: string) => {
    handleClose();
    const object = floors
      .flatMap(floor => floor.rooms)
      .flatMap(room => room.objects)
      .find(obj => obj.id === objId);

    if (object) {
      // Pass the location data directly as the tag data
      dispatch(
        openMatterTagWindow({
          tag: object.location as LocationDetailResponse,
          activeTab: 0, // Start with Object info tab
        })
      );
    }
  };

  const handleClose = () => {
    setFilters([]);
    setExpandedFloors({});
    setExpandedRooms({});
    setIsFilterOpen(false);
    setFilterAnchorEl(null);
    dispatch(closeObjectManagerWindow());
  };

  // Show loading state
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
            height: 'auto',
            maxHeight: '600px',
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
            height: 'auto',
            maxHeight: '600px',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography sx={{ color: 'white', textAlign: 'center' }}>
            Error loading locations
          </Typography>
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
          height: 'auto',
          maxHeight: '600px',
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
            Object Manager
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
          availableFilterTypes={['Floor', 'Room']}
        />
      </Box>

      {/* Edit Objects via Matterport Button */}
      <Button
        onClick={() => {
          const modelId = import.meta.env.VITE_MATTERPORT_MODEL_ID;

          if (modelId) {
            const matterportAdminUrl = `https://my.matterport.com/models/${modelId}?section=media`;
            window.open(matterportAdminUrl, '_blank');
          } else {
            console.error('Matterport model ID is missing. Please check your .env file.');
          }
        }}
        variant="outlined"
        startIcon={<img src="/icons/mattertag/to-materport-icon.svg" alt="Matterport" />}
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
        Edit Objects via Matterport
      </Button>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Filters section */}
        {filters.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Box sx={{ display: 'flex', gap: '8px' }}>
              {filters.map(item => (
                <Box
                  key={item.value}
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

        <Paper
          sx={{
            flex: 1,
            overflowY: 'auto',
            bgcolor: 'transparent',
            borderRadius: '20px',
            boxShadow: 'none',
            minHeight: '100px',
            maxHeight: '400px',
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
            '&::-webkit-scrollbar-thumb:hover': {
              display: 'none',
            },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredFloors.map(floor => (
              <Box key={floor.id}>
                <Box
                  onClick={() => handleFloorClick(floor.id)}
                  sx={{
                    bgcolor: 'transparent',
                    height: '48px',
                    px: 2.25,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'transparent',
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '14px',
                      fontWeight: 600,
                      lineHeight: '22px',
                      color: '#FFFFFF',
                    }}
                  >
                    {`Floor: ${floor.name}`}
                  </Typography>
                  {expandedFloors[floor.id] ? (
                    <ExpandLess sx={{ color: '#FFFFFF' }} />
                  ) : (
                    <ExpandMore sx={{ color: '#FFFFFF' }} />
                  )}
                </Box>
                <Collapse in={expandedFloors[floor.id]} timeout="auto" unmountOnExit>
                  <Box
                    sx={{
                      bgcolor: 'transparent',
                      borderRadius: '20px',
                      margin: '8px 0',
                      padding: '8px 0',
                    }}
                  >
                    {floor.rooms.map(room => (
                      <Box key={room.id}>
                        <Box
                          onClick={() => handleRoomClick(room.id)}
                          sx={{
                            bgcolor: 'transparent',
                            height: '48px',
                            pl: 4,
                            pr: 2.25,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: 'transparent',
                            },
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '14px',
                              fontWeight: 500,
                              lineHeight: '22px',
                              color: '#FFFFFF',
                            }}
                          >
                            {room.name}
                          </Typography>
                          {expandedRooms[room.id] ? (
                            <ExpandLess sx={{ color: '#FFFFFF' }} />
                          ) : (
                            <ExpandMore sx={{ color: '#FFFFFF' }} />
                          )}
                        </Box>
                        <Collapse in={expandedRooms[room.id]} timeout="auto" unmountOnExit>
                          <List
                            component="div"
                            disablePadding
                            sx={{
                              bgcolor: '#00000026',
                              backgroundBlendMode: 'luminosity',
                              borderRadius: '20px',
                              margin: '8px 0',
                              '& .MuiListItem-root:first-of-type .MuiListItemButton-root': {
                                borderTopLeftRadius: '20px',
                                borderTopRightRadius: '20px',
                              },
                              '& .MuiListItem-root:last-of-type .MuiListItemButton-root': {
                                borderBottomLeftRadius: '20px',
                                borderBottomRightRadius: '20px',
                              },
                            }}
                          >
                            {room.objects.map(obj => (
                              <ListItem
                                key={obj.id}
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
                                  onClick={() => handleObjectClick(obj.id)}
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
                                    primary={obj.name}
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
                        </Collapse>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    </Dialog>
  );
}
