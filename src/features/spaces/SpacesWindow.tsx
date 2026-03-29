import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { closeSpacesWindow, openSpaceViewerWindow } from '../../store/modalSlice';
import { useGetMySpacesQuery, Space } from '../../api/spaces/spacesApi';
import { Box, Typography, IconButton, CircularProgress, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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

function SpaceCard({ space, onClick }: { space: Space; onClick: () => void }) {
  const hasCompletedSplat =
    space.latest_job?.status === 'completed' &&
    (space.latest_job?.output_splat_path || space.latest_job?.output_spz_path);

  const hasModel = Boolean(space.model_url);
  const date = new Date(space.created_at).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Box
      onClick={onClick}
      sx={{
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        '&:hover': {
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
        },
      }}
    >
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{date}</Typography>
        {hasCompletedSplat ? (
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
        ) : hasModel ? (
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
        ) : null}
      </Box>
    </Box>
  );
}

export const SpacesWindow = () => {
  const dispatch = useDispatch();
  const { isOpen } = useSelector((state: RootState) => state.modal.spacesWindowModal);
  const { data: spaces, isLoading, error } = useGetMySpacesQuery(undefined, { skip: !isOpen });

  const handleClose = () => dispatch(closeSpacesWindow());

  const handleSpaceClick = (space: Space) => {
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
            <SpaceCard key={space.space_id} space={space} onClick={() => handleSpaceClick(space)} />
          ))}
        </Box>
      )}
    </Dialog>
  );
};
