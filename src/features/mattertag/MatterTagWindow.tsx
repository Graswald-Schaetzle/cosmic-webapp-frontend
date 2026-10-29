import { Dialog } from '../../components/Dialog';
import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Paper,
  CircularProgress,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { ConfirmDeletionModal } from '../../components/ConfirmDeletionModal';
import { ObjectInfoTab } from './components/ObjectInfoTab';
import { RoomInfoTab } from './components/RoomInfoTab';
import { DocumentTab } from './components/DocumentTab.tsx';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store.ts';
import { closeMatterTagWindow, setMatterTagActiveTab } from '../../store/modalSlice.ts';
import {
  useGetLocationByTagIdQuery,
  useDeleteLocationMutation,
} from '../../api/locationApi/locationApi';
import { LocationDetailResponse } from '../../api/locationApi/locationApi';
import { useEffect, useState } from 'react';

export function MatterTagWindow() {
  const dispatch = useDispatch();
  const {
    isOpen,
    selectedTag: tag,
    activeTab,
  } = useSelector((state: RootState) => state.modal.matterTagWindowModal);

  // Check if selectedTag is LocationDetailResponse (from redirect) or MatterTag (normal flow)
  const isLocationData = tag && 'location_id' in tag && 'location_name' in tag;

  // Get location ID - either from tag (if it's LocationDetailResponse) or from tag.sid (if it's MatterTag)
  const locationId = isLocationData
    ? (tag as LocationDetailResponse).location_id
    : (tag as any)?.sid;

  // Fetch location data from API using RTK Query
  const {
    data: fetchedLocationData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useGetLocationByTagIdQuery(locationId || '', {
    skip: !locationId || !isOpen,
  });

  // Refetch location data every time the modal opens
  useEffect(() => {
    if (isOpen && locationId) {
      refetch();
    }
  }, [isOpen, locationId, refetch]);

  // Always use fetched location data from API
  const locationData = fetchedLocationData;

  const [deleteLocation] = useDeleteLocationMutation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!tag) return null;

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    dispatch(setMatterTagActiveTab(newValue));
  };

  const handleClose = () => {
    dispatch(closeMatterTagWindow());
  };

  const handleDeleteClick = () => {
    setMenuAnchor(null);
    setShowDeleteConfirm(true);
  };

  // Errors propagate to ConfirmDeletionModal, which shows them and keeps the dialog open.
  const handleDeleteConfirm = async () => {
    if (!locationData) return;
    await deleteLocation(String(locationData.location_id)).unwrap();
    dispatch(closeMatterTagWindow());
  };

  const tagType = locationData?.tag_type ?? 'object';
  const isRoom = tagType === 'room';

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
          overflowY: 'auto',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '40px',
          position: 'relative',
          px: 2,
        }}
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px',
            // keep long names clear of the action buttons on the right
            px: '80px',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              m: 0,
              fontWeight: 700,
              fontSize: '16px',
              lineHeight: '22px',
              color: '#FFFFFF',
              textAlign: 'center',
            }}
          >
            {isLoading || isFetching ? '...' : locationData?.location_name || '...'}
          </Typography>

          {locationData && (
            <Chip
              label={isRoom ? 'Room' : 'Object'}
              size="small"
              sx={{
                height: '22px',
                borderRadius: '100px',
                bgcolor: isRoom ? 'rgba(255, 166, 0, 0.25)' : 'rgba(51, 128, 255, 0.25)',
                color: isRoom ? '#FFA600' : '#3380FF',
                border: `1px solid ${isRoom ? 'rgba(255, 166, 0, 0.4)' : 'rgba(51, 128, 255, 0.4)'}`,
                fontWeight: 600,
                fontSize: '11px',
                '& .MuiChip-label': { px: '8px' },
              }}
            />
          )}
        </Box>
        <IconButton
          size="small"
          aria-label="Edit tag"
          sx={{
            position: 'absolute',
            right: '40px',
            top: 0,
          }}
        >
          <img src="/icons/mattertag/edit.svg" alt="Edit" />
        </IconButton>
        <IconButton
          size="small"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={Boolean(menuAnchor)}
          disabled={!locationData}
          onClick={event => setMenuAnchor(event.currentTarget)}
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '40px',
            height: '40px',
            color: '#FFFFFF',
            '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.3)' },
          }}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: {
                mt: '4px',
                borderRadius: '16px',
                backgroundColor: 'rgba(46, 46, 46, 0.85)',
                backdropFilter: 'blur(100px)',
                WebkitBackdropFilter: 'blur(100px)',
                color: '#FFFFFF',
              },
            },
          }}
        >
          <MenuItem onClick={handleDeleteClick} sx={{ color: '#FF6B6B', fontWeight: 600 }}>
            <ListItemIcon sx={{ color: 'inherit', minWidth: '32px' }}>
              <DeleteOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Delete tag
          </MenuItem>
        </Menu>
      </Box>

      {/* Loading state */}
      {(isLoading || isFetching) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: 'white' }} />
        </Box>
      )}

      {/* Error state */}
      {error && !locationData && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography color="error" sx={{ color: '#ff6b6b' }}>
            Failed to load tag data
          </Typography>
        </Box>
      )}

      {/* Content when data is loaded */}
      {locationData && !isLoading && !isFetching && (
        <>
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
                <Tab label="Info" />
                <Tab label="Documents" />
              </Tabs>
            </Paper>
          </Box>

          {/* Tab Content */}
          {activeTab === 0 ? (
            isRoom ? (
              <RoomInfoTab locationData={locationData} />
            ) : (
              <ObjectInfoTab tag={tag} handleClose={handleClose} locationData={locationData} />
            )
          ) : (
            <DocumentTab locationData={locationData} />
          )}
        </>
      )}

      <ConfirmDeletionModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Tag"
        message={`Do you want to delete "${locationData?.location_name ?? 'this tag'}"? Linked tasks and documents are kept.`}
        itemType="Tag"
      />
    </Dialog>
  );
}
