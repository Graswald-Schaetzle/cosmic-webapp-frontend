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
} from '@mui/material';
import { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store.ts';
import {
  closeDocumentsWindow,
  openAddDocumentWindow,
  openDocumentInfoWindow,
} from '../../store/modalSlice.ts';
import { UniversalFilterModal, FilterType } from '../../components/UniversalFilterModal';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useGetAllDocumentsQuery, Floor } from '../../api/documents/documentApi';
import { useGetTasksQuery } from '../../api/tasks/taskApi';
import { useGetRoomsQuery } from '../../api/locationApi/locationApi';
import { useLocations } from '../../hooks/useLocations';

export function DocumentsWindow() {
  const dispatch = useDispatch();
  const { isOpen } = useSelector((state: RootState) => state.modal.documentsWindowModal);
  const [filters, setFilters] = useState<Array<{ type: FilterType; value: string }>>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [expandedFloors, setExpandedFloors] = useState<{ [key: string]: boolean }>({});
  const [expandedRooms, setExpandedRooms] = useState<{ [key: string]: boolean }>({});

  // Fetch documents from API
  const {
    data: documentsResponse,
    isLoading,
    error,
  } = useGetAllDocumentsQuery(
    {},
    {
      skip: !isOpen,
    }
  );

  // Fetch tasks from API
  const { data: tasksResponse } = useGetTasksQuery(undefined, {
    skip: !isOpen,
  });

  // Fetch rooms from API
  const { data: roomsResponse } = useGetRoomsQuery(undefined, {
    skip: !isOpen,
  });

  // Fetch locations for Object filter
  const { locations } = useLocations();

  // Function to get display name for filter
  const getFilterDisplayName = (filter: { type: FilterType; value: string }) => {
    switch (filter.type) {
      case 'Floor': {
        const floor = documentsResponse?.floors.find(f => f.floor_id.toString() === filter.value);
        return floor ? `Floor: ${floor.floor_name}` : filter.value;
      }
      case 'Room': {
        const room = roomsResponse?.data?.find(r => r.room_id.toString() === filter.value);
        return room ? `Room: ${room.name}` : filter.value;
      }
      case 'Task': {
        const task = tasksResponse?.data?.find(t => t.task_id.toString() === filter.value);
        return task ? task.title : filter.value;
      }
      case 'Object': {
        // Find the location by location_id in the locations data
        const location = locations?.find(loc => loc.location_id.toString() === filter.value);
        return location ? `Object: ${location.location_name}` : `Object: ${filter.value}`;
      }
      default:
        return filter.value;
    }
  };

  // Filter floors based on selected filters
  const filteredFloors = useMemo(() => {
    if (!documentsResponse?.floors || filters.length === 0) {
      return documentsResponse?.floors || [];
    }

    const result = documentsResponse.floors
      .map(floor => {
        const isFloorMatch = filters.some(
          filter => filter.type === 'Floor' && floor.floor_id.toString() === filter.value
        );

        // If floor is directly filtered, show all rooms and documents in that floor
        if (isFloorMatch) {
          return {
            ...floor,
            rooms: floor.rooms.map(room => ({
              ...room,
              documents: room.documents, // Show all documents in all rooms of this floor
            })),
          };
        }

        // Check if any room in this floor is filtered
        const filteredRooms = floor.rooms.filter(room => {
          const isRoomMatch = filters.some(
            filter => filter.type === 'Room' && room.room_id.toString() === filter.value
          );
          const hasMatchingTaskDocuments = room.documents.some(doc => {
            const isTaskMatch = filters.some(
              filter => filter.type === 'Task' && doc.task_id?.toString() === filter.value
            );
            return isTaskMatch;
          });
          const hasMatchingObjectDocuments = room.documents.some(doc => {
            const isObjectMatch = filters.some(
              filter => filter.type === 'Object' && doc.location_id?.toString() === filter.value
            );
            return isObjectMatch;
          });
          return isRoomMatch || hasMatchingTaskDocuments || hasMatchingObjectDocuments;
        });

        // If any room is filtered, show the parent floor with filtered documents in that room
        if (filteredRooms.length > 0) {
          return {
            ...floor,
            rooms: filteredRooms.map(room => ({
              ...room,
              documents: room.documents.filter(doc => {
                // Show documents that match any of the applied filters
                const isTaskMatch = filters.some(
                  filter => filter.type === 'Task' && doc.task_id?.toString() === filter.value
                );
                const isObjectMatch = filters.some(
                  filter => filter.type === 'Object' && doc.location_id?.toString() === filter.value
                );
                return isTaskMatch || isObjectMatch;
              }),
            })),
          };
        }

        return null;
      })
      .filter(Boolean) as Floor[];

    return result;
  }, [filters, documentsResponse]);

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

  const handleFilterSelect = (filterType: FilterType, value: string) => {
    setFilters(prev => [...prev, { type: filterType, value }]);

    // Auto-expand relevant sections
    if (documentsResponse?.floors) {
      documentsResponse.floors.forEach(floor => {
        const isFloorMatch = floor.floor_name === value;
        const hasMatchingRoom = floor.rooms.some(room => room.room_name === value);
        const hasMatchingDocument = floor.rooms.some(room =>
          room.documents.some(doc => doc.name.toLowerCase().includes(value.toLowerCase()))
        );

        if (isFloorMatch || hasMatchingRoom || hasMatchingDocument) {
          setExpandedFloors(prev => ({ ...prev, [floor.floor_id.toString()]: true }));
          if (hasMatchingRoom || hasMatchingDocument) {
            floor.rooms.forEach(room => {
              if (
                room.room_name === value ||
                room.documents.some(doc => doc.name.toLowerCase().includes(value.toLowerCase()))
              ) {
                setExpandedRooms(prev => ({ ...prev, [room.room_id.toString()]: true }));
              }
            });
          }
        }
      });
    }
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

  const handleDocumentClick = (docId: string) => {
    handleClose();
    dispatch(openDocumentInfoWindow(docId));
  };

  const handleAddDocument = () => {
    dispatch(closeDocumentsWindow());
    dispatch(openAddDocumentWindow());
  };

  const handleClose = () => {
    setFilters([]);
    setExpandedFloors({});
    setExpandedRooms({});
    setIsFilterOpen(false);
    setFilterAnchorEl(null);
    dispatch(closeDocumentsWindow());
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[380px] max-h-[600px]"
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
            Documents
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
          availableFilterTypes={['Object', 'Task', 'Floor', 'Room']}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Filters section */}
        {filters.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Box
              sx={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
              }}
            >
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
                    flexShrink: 0,
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
                      whiteSpace: 'nowrap',
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

        {/* Add Document Button */}
        <Button
          variant="outlined"
          onClick={handleAddDocument}
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
          Add a Document
        </Button>

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
          {isLoading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
              }}
            >
              <Typography sx={{ color: '#FFFFFF' }}>Loading documents...</Typography>
            </Box>
          ) : error ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
              }}
            >
              <Typography sx={{ color: '#FF6B6B' }}>Error loading documents</Typography>
            </Box>
          ) : filteredFloors.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
              }}
            >
              <Typography sx={{ color: '#FFFFFF' }}>No documents found</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredFloors.map(floor => (
                <Box key={floor.floor_id}>
                  <Box
                    onClick={() => handleFloorClick(floor.floor_id.toString())}
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
                      Floor {floor.floor_name}
                    </Typography>
                    {expandedFloors[floor.floor_id.toString()] ? (
                      <ExpandLess sx={{ color: '#FFFFFF' }} />
                    ) : (
                      <ExpandMore sx={{ color: '#FFFFFF' }} />
                    )}
                  </Box>
                  <Collapse
                    in={expandedFloors[floor.floor_id.toString()]}
                    timeout="auto"
                    unmountOnExit
                  >
                    <Box
                      sx={{
                        bgcolor: 'transparent',
                        borderRadius: '20px',
                        margin: '8px 0',
                        padding: '8px 0',
                      }}
                    >
                      {floor.rooms.map(room => (
                        <Box key={room.room_id}>
                          <Box
                            onClick={() => handleRoomClick(room.room_id.toString())}
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
                              {room.room_name}
                            </Typography>
                            {expandedRooms[room.room_id.toString()] ? (
                              <ExpandLess sx={{ color: '#FFFFFF' }} />
                            ) : (
                              <ExpandMore sx={{ color: '#FFFFFF' }} />
                            )}
                          </Box>
                          <Collapse
                            in={expandedRooms[room.room_id.toString()]}
                            timeout="auto"
                            unmountOnExit
                          >
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
                              {room.documents.map(doc => (
                                <ListItem
                                  key={doc.document_id}
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
                                    onClick={() => handleDocumentClick(doc.document_id.toString())}
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
                                      primary={doc.name}
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
                                      <img
                                        src="/icons/mattertag/arrow-right.svg"
                                        alt="Arrow right"
                                      />
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
          )}
        </Paper>
      </Box>
    </Dialog>
  );
}
