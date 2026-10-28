import { useState } from 'react';
import * as THREE from 'three';
import { Box, Button, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import {
  SplatPlacement,
  applyFrameDelta,
  floorAlignment,
  originAlignment,
  scaleFromReference,
} from './spaceFrame';

export type CalibrationStep = 'floor' | 'scale' | 'origin';

interface StepConfig {
  label: string;
  points: number;
  instruction: string;
  invalid: string;
}

const STEPS: Record<CalibrationStep, StepConfig> = {
  floor: {
    label: 'Boden',
    points: 3,
    instruction: 'Tippe drei Punkte auf den Boden, möglichst weit auseinander.',
    invalid: 'Die Punkte ergeben keine Bodenebene (auf einer Linie oder zu steil).',
  },
  scale: {
    label: 'Maßstab',
    points: 2,
    instruction: 'Tippe zwei Punkte, deren echter Abstand bekannt ist (z. B. Türhöhe 2,05 m).',
    invalid: 'Die beiden Punkte liegen zu nah beieinander oder die Länge fehlt.',
  },
  origin: {
    label: 'Ursprung',
    points: 2,
    instruction: 'Tippe zuerst den Ursprung, dann einen Punkt in Richtung der +X-Achse.',
    invalid: 'Der zweite Punkt muss neben dem Ursprung liegen, nicht darüber.',
  },
};

interface CalibrationPanelProps {
  placement: SplatPlacement;
  points: THREE.Vector3[];
  onClearPoints: () => void;
  /** Saves the new placement; rejects with a message fit for the user. */
  onApply: (placement: SplatPlacement) => Promise<void>;
  onClose: () => void;
  step: CalibrationStep;
  onStepChange: (step: CalibrationStep) => void;
}

/** Floating panel for the three calibration steps of a space's coordinate system. */
export function CalibrationPanel({
  placement,
  points,
  onClearPoints,
  onApply,
  onClose,
  step,
  onStepChange,
}: CalibrationPanelProps) {
  const [length, setLength] = useState('2.05');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const config = STEPS[step];
  const ready = points.length >= config.points;

  const apply = async () => {
    const picked = points.slice(0, config.points);
    let delta: THREE.Matrix4 | null = null;
    if (step === 'floor') delta = floorAlignment(picked);
    else if (step === 'scale') delta = scaleFromReference(picked, Number(length.replace(',', '.')));
    else delta = originAlignment(picked);
    if (!delta) {
      setMessage({ text: config.invalid, error: true });
      return;
    }
    setSaving(true);
    try {
      await onApply(applyFrameDelta(placement, delta));
      setMessage({ text: 'Gespeichert. Tags wurden mitgeführt.', error: false });
      onClearPoints();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Speichern fehlgeschlagen',
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        right: 16,
        bottom: 24,
        zIndex: 40,
        width: 300,
        maxWidth: 'calc(100% - 32px)',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        borderRadius: '20px',
        backgroundColor: 'rgba(46, 46, 46, 0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        color: '#fff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
          Koordinatensystem kalibrieren
        </Typography>
        <Button size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 0 }}>
          Fertig
        </Button>
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        fullWidth
        value={step}
        onChange={(_, next: CalibrationStep | null) => {
          if (!next) return;
          onStepChange(next);
          setMessage(null);
        }}
        sx={{
          '& .MuiToggleButton-root': {
            color: 'rgba(255,255,255,0.7)',
            border: 'none',
            textTransform: 'none',
            '&.Mui-selected': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.2)' },
          },
        }}
      >
        {(Object.keys(STEPS) as CalibrationStep[]).map(key => (
          <ToggleButton key={key} value={key}>
            {STEPS[key].label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
        {config.instruction}
      </Typography>

      {step === 'scale' && (
        <TextField
          size="small"
          label="Echter Abstand (m)"
          value={length}
          onChange={event => setLength(event.target.value)}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          sx={{
            '& .MuiInputBase-root': { color: '#fff' },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
          }}
        />
      )}

      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
        Punkte: {Math.min(points.length, config.points)} / {config.points}
        {points.length > config.points && ' (weitere werden ignoriert)'}
      </Typography>

      {message && (
        <Typography sx={{ fontSize: 12, color: message.error ? '#FF6B6B' : '#7CE0A3' }}>
          {message.text}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          onClick={() => {
            onClearPoints();
            setMessage(null);
          }}
          disabled={!points.length || saving}
          sx={{ color: 'rgba(255,255,255,0.8)', textTransform: 'none' }}
        >
          Zurücksetzen
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={apply}
          disabled={!ready || saving}
          sx={{ flex: 1, textTransform: 'none', borderRadius: '12px' }}
        >
          {saving ? 'Speichern…' : 'Anwenden'}
        </Button>
      </Box>

      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
        Maßstab: {placement.scale.toFixed(3)} · Rotation:{' '}
        {placement.rotation_deg.map(a => a.toFixed(1)).join(', ')}°
      </Typography>
    </Box>
  );
}
