import { useRef, useState } from 'react';
import { Box } from '@mui/material';

const SIZE = 104;
const KNOB = 44;
const RADIUS = (SIZE - KNOB) / 2;

interface VirtualJoystickProps {
  /** x: strafe right, y: forward, both in [-1, 1]. Called with (0, 0) on release. */
  onChange: (x: number, y: number) => void;
}

/** On-screen stick for touch devices. Captures its own pointer, so looking around still works. */
export const VirtualJoystick = ({ onChange }: VirtualJoystickProps) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX: number, clientY: number) => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > RADIUS) {
      dx = (dx / length) * RADIUS;
      dy = (dy / length) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / RADIUS, -dy / RADIUS);
  };

  const release = (event: React.PointerEvent) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <Box
      ref={baseRef}
      data-testid="walk-joystick"
      onPointerDown={event => {
        if (activePointer.current !== null) return;
        activePointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={event => {
        if (activePointer.current === event.pointerId) update(event.clientX, event.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      sx={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'max(32px, env(safe-area-inset-bottom))',
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        zIndex: 20,
        touchAction: 'none',
        userSelect: 'none',
        backgroundColor: 'rgba(46, 46, 46, 0.35)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: (SIZE - KNOB) / 2 + knob.x,
          top: (SIZE - KNOB) / 2 + knob.y,
          width: KNOB,
          height: KNOB,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.55)',
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
};
