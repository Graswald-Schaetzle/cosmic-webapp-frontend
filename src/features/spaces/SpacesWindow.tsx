import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { closeSpacesWindow, openSpaceViewerWindow } from '../../store/modalSlice';
import { useGetMySpacesQuery, Space } from '../../api/spaces/spacesApi';
import { useSpace } from '../../contexts/SpaceContext';
import { Box, Typography, IconButton, CircularProgress, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Dialog from '@mui/material/Dialog';

const paperStyles = {
  borderRadius: '32px',
  overflow: 'hidden',
  backgroundColor: 'rgba(46, 46, 46, 0.35)',
  backdropFilter: 'blur(100px)',
  WebkitBackdropFilter: 'blur(100px)',
  padding: '32px 24px 24px',
  minWidth: 500,
  maxWidth: 760,
  width: '100%',
  boxShadow: 'none',
  border: '1px solid rgba(255,255,255,0.08)',
};

function SpaceCard({
  space,
  isActive,
  onSelect,
  onViewReconstruction,
}: {
  space: Space;
  isActive: boolean;
  onSelect: () => void;
  onViewReconstruction: () => void;
}) {
  const hasCompletedSplat =
    space.latest_job?.status === 'completed' &&
    (space.latest_job?.output_splat_path || space.latest_job?.output_spz_path);

  const hasModel = Boolean(space.model_url);
  const hasMatterport = Boolean(space.matterport_model_id);
  const date = new Date(space.created_at).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Box
      onClick={onSelect}
      sx={{
        borderRadius: '20px',
        background: isActive ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
        border: isActive
          ? '2px solid rgba(255,255,255,0.5)'
          : '1px solid rgba(255,255,255,0.1)',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        '&:hover': {
          background: isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)',
          border: isActive
            ? '2px solid rgba(255,255,255,0.6)'
            : '1px solid rgba(255,255,255,0.2)',
        },
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#4CAF50',
            boxShadow: '0 0 6px rgba(76,175,80,0.6)',
          }}
        />
      )}

      {/* Model preview area */}
      <Box
        sx={{
          height: 120,
          borderRadius: '12px',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HomeWorkIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 48 }} />
      </Box>

      {/* Name */}
      <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
        {space.name}
      </Typography>

      {/* Date + badge row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', mr: 'auto' }}>
          {date}
        </Typography>
        {hasMatterport && (
          <Chip
            icon={<ViewInArIcon sx={{ fontSize: '12px !important' }} />}
            label="Matterport"
            size="small"
            sx={{
              height: 20,
              fontSize: '10px',
              backgroundColor: 'rgba(156,39,176,0.25)',
              color: '#ce93d8',
              border: '1px solid rgba(156,39,176,0.4)',
              '& .MuiChip-icon': { color: '#ce93d8' },
            }}
          />
        )}
        {hasCompletedSplat && (
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
            label="3D Splat"
            size="small"
            sx={{
              height: 20,
              fontSize: '10px',
              backgroundColor: 'rgba(76,175,80,0.25)',
              color: '#81c784',
              border: '1px solid rgba(76,175,80,0.4)',
              '& .MuiChip-icon': { color: '#81c784' },
            }}
          />
        )}
        {!hasCompletedSplat && hasModel && (
          <Chip
            label="USDZ"
            size="small"
            sx={{
              height: 20,
              fontSize: '10px',
              backgroundColor: 'rgba(33,150,243,0.25)',
              color: '#64b5f6',
              border: '1px solid rgba(33,150,243,0.4)',
            }}
          />
        )}
      </Box>

      {/* View reconstruction button (only if splat/usdz available) */}
      {(hasCompletedSplat || hasModel) && (
        <Box
          onClick={e => {
            e.stopPropagation();
            onViewReconstruction();
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '11px',
            mt: '2px',
            '&:hover': { color: '#fff' },
          }}
        >
          <VisibilityIcon sx={{ fontSize: 14 }} />
          <Typography sx={{ fontSize: '11px' }}>View 3D Reconstruction</Typography>
        </Box>
      )}
    </Box>
  );
}

export const SpacesWindow = () => {
  const dispatch = useDispatch();
  const { isOpen } = useSelector((state: RootState) => state.modal.spacesWindowModal);
  const { data: spaces, isLoading, error } = useGetMySpacesQuery(undefined, { skip: !isOpen });
  const { activeSpaceId, switchSpace } = useSpace();

  const handleClose = () => dispatch(closeSpacesWindow());

  const handleSpaceSelect = async (space: Space) => {
    await switchSpace(space.space_id);
    handleClose();
  };

  const handleViewReconstruction = (space: Space) => {
    const jobId =
      space.latest_job?.status === 'completed' ? (space.latest_job?.job_id ?? null) : null;

    dispatch(
      openSpaceViewerWindow({
        spaceId: space.space_id,
        spaceName: space.name,
        modelUrl: space.model_url ?? null,
        jobId,
      })
    );
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      hideBackdrop
      disableEnforceFocus
      PaperProps={{ sx: paperStyles }}
    >
      {/* Header */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '24px' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <HomeWorkIcon sx={{ color: '#fff', fontSize: 22 }} />
          <Typography sx={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>
            My Spaces
          </Typography>
          {activeSpaceId && spaces && (
            <Chip
              label={spaces.find(s => s.space_id === activeSpaceId)?.name || ''}
              size="small"
              sx={{
                height: 22,
                fontSize: '11px',
                backgroundColor: 'rgba(76,175,80,0.2)',
                color: '#81c784',
                border: '1px solid rgba(76,175,80,0.3)',
              }}
            />
          )}
        </Box>
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{
            color: 'rgba(255,255,255,0.6)',
            '&:hover': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: '48px' }}>
          <CircularProgress sx={{ color: '#fff' }} />
        </Box>
      )}

      {error && (
        <Box sx={{ textAlign: 'center', py: '48px' }}>
          <Typography sx={{ color: '#ff6b6b', fontSize: '14px' }}>Error loading spaces</Typography>
          <Typography sx={{ color: '#ff6b6b', fontSize: '11px', mt: 1, opacity: 0.7, wordBreak: 'break-all' }}>
            {'status' in error ? `${error.status}: ${JSON.stringify(error.data)}` : error.message}
          </Typography>
        </Box>
      )}

      {!isLoading && !error && spaces && spaces.length === 0 && (
        <Box sx={{ textAlign: 'center', py: '48px' }}>
          <HomeWorkIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 64, mb: 2 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
            No spaces added yet
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', mt: 1 }}>
            Scan a space with the iOS app to see it here
          </Typography>
        </Box>
      )}

      {!isLoading && !error && spaces && spaces.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px',
            maxHeight: '60vh',
            overflowY: 'auto',
            pr: '4px',
          }}
        >
          {spaces.map(space => (
            <SpaceCard
              key={space.space_id}
              space={space}
              isActive={space.space_id === activeSpaceId}
              onSelect={() => handleSpaceSelect(space)}
              onViewReconstruction={() => handleViewReconstruction(space)}
            />
          ))}
        </Box>
      )}
    </Dialog>
  );
};
