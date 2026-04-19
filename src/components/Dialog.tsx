import React from 'react';
import { Dialog as MuiDialog, DialogProps as MuiDialogProps, Slide } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { useIsMobile } from '../hooks/useIsMobile';

interface DialogProps extends Omit<MuiDialogProps, 'open' | 'onClose'> {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
  PaperProps?: MuiDialogProps['PaperProps'];
}

const SlideUp = React.forwardRef(function SlideUp(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  className = '',
  children,
  PaperProps,
  ...props
}) => {
  const isMobile = useIsMobile();

  const mobilePaperSx = isMobile
    ? {
        margin: 0,
        width: '100vw',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        borderRadius: '24px 24px 0 0',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }
    : {};

  return (
    <MuiDialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      disableEnforceFocus
      hideBackdrop
      fullScreen={isMobile}
      TransitionComponent={isMobile ? SlideUp : undefined}
      {...props}
      PaperProps={{
        className: className,
        ...PaperProps,
        sx: {
          margin: 2,
          position: 'relative',
          ...PaperProps?.sx,
          ...mobilePaperSx,
        },
      }}
    >
      {children}
    </MuiDialog>
  );
};
