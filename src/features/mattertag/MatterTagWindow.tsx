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
} from '@mui/material';
import { ObjectInfoTab } from './components/ObjectInfoTab';
import { RoomInfoTab } from './components/RoomInfoTab';
import { DocumentTab } from './components/DocumentTab.tsx';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store.ts';
import { closeMatterTagWindow, setMatterTagActiveTab } from '../../store/modalSlice.ts';
import { useGetLocationByTagIdQuery } from '../../api/locationApi/locationApi';
import { LocationDetailResponse } from '../../api/locationApi/locationApi';
import { useEffect } from 'react';

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

  if (!tag) return null;

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    dispatch(setMatterTagActiveTab(newValue));
  };

  const handleClose = () => {
    dispatch(closeMatterTagWindow());
  };

  const tagType = locationData?.tag_type ?? 'object';
  const isRoom = tagType === 'room';

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
            right: 0,
            top: 0,
          }}
        >
          <img src="/icons/mattertag/edit.svg" alt="Edit" />
        </IconButton>
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
                width: '356px',
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
                    width: '172px',
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
    </Dialog>
  );
}
