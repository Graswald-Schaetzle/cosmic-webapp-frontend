import { Box, Typography, Chip, Paper } from '@mui/material';
import { LocationDetailResponse } from '../../../api/locationApi/locationApi';

interface RoomInfoTabProps {
  locationData: LocationDetailResponse;
}

export const RoomInfoTab = ({ locationData }: RoomInfoTabProps) => {
  const responsibleName = locationData.responsible_user
    ? `${locationData.responsible_user.first_name} ${locationData.responsible_user.last_name}`.trim()
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Notes */}
      {locationData.description && (
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
            Notes
          </Typography>
          <Paper
            elevation={0}
            sx={{ bgcolor: 'rgba(0, 0, 0, 0.15)', borderRadius: '20px', p: '14px 18px' }}
          >
            <Typography
              sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', lineHeight: '22px' }}
            >
              {locationData.description}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Responsible */}
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
          Responsible
        </Typography>
        <Box sx={{ display: 'flex', gap: '8px', px: '4px' }}>
          {responsibleName ? (
            <Chip
              label={responsibleName}
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
                  padding: 0,
                },
              }}
            />
          ) : (
            <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', ml: '14px' }}>
              —
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};
