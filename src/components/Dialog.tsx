import React from 'react';
import { Dialog as MuiDialog, DialogProps as MuiDialogProps } from '@mui/material';

interface DialogProps extends Omit<MuiDialogProps, 'open' | 'onClose'> {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
  PaperProps?: MuiDialogProps['PaperProps'];
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  className = '',
  children,
  PaperProps,
  ...props
}) => {
  return (
    <MuiDialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      disableEnforceFocus
      hideBackdrop
      {...props}
      PaperProps={{
        className: className,
        sx: {
          margin: 2,
          position: 'relative',
          ...PaperProps?.sx,
        },
        ...PaperProps,
      }}
    >
      {children}
    </MuiDialog>
  );
};
