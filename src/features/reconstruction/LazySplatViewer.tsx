import { ComponentProps, lazy, Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';

// The splat renderer is large, so it is only fetched when a viewer is actually opened.
const SplatViewer = lazy(() =>
  import('./SplatViewer').then(module => ({ default: module.SplatViewer }))
);

export const LazySplatViewer = (props: ComponentProps<typeof SplatViewer>) => (
  <Suspense
    fallback={
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={48} sx={{ color: '#FFFFFF' }} />
      </Box>
    }
  >
    <SplatViewer {...props} />
  </Suspense>
);
