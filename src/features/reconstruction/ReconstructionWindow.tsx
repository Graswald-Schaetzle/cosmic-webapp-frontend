import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { Dialog } from '../../components/Dialog';
import { closeReconstructionWindow } from '../../store/modalSlice';
import { Box, Typography, IconButton, Button, TextField, LinearProgress } from '@mui/material';
import ThreeDRotationIcon from '@mui/icons-material/ThreeDRotation';
import { useCallback, useState } from 'react';
import { SplatViewer } from './SplatViewer';
import {
  useCreateJobMutation,
  useStartJobMutation,
  useListJobsQuery,
  useGetJobQuery,
  useCancelJobMutation,
  useGetJobOutputQuery,
  getStatusLabel,
  isProcessing,
  getProgressPercent,
  ReconstructionJob,
} from '../../api/reconstruction/reconstructionApi';

type View = 'list' | 'create' | 'detail';

export const ReconstructionWindow = () => {
  const dispatch = useDispatch();
  const { isOpen, spaceId } = useSelector(
    (state: RootState) => state.modal.reconstructionWindowModal
  );

  const [view, setView] = useState<View>('list');
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  // Create form state
  const [title, setTitle] = useState('');
  const [inputType, setInputType] = useState<'video' | 'images'>('video');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API hooks
  const { data: jobs, refetch: refetchJobs } = useListJobsQuery(spaceId ?? undefined, {
    skip: !isOpen,
    pollingInterval: 10000,
  });
  const [createJob] = useCreateJobMutation();
  const [startJob] = useStartJobMutation();
  const [cancelJob] = useCancelJobMutation();

  const handleClose = () => {
    dispatch(closeReconstructionWindow());
    setView('list');
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setInputType('video');
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    setError(null);
  };

  const handleFileSelect = useCallback(
    (file: File) => {
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (file.size > maxSize) {
        setError('File must not exceed 2 GB');
        return;
      }

      const videoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      const imageTypes = ['application/zip', 'application/x-zip-compressed'];
      const allowed = inputType === 'video' ? videoTypes : imageTypes;

      if (!allowed.includes(file.type)) {
        setError(
          inputType === 'video'
            ? 'Please select a video file (MP4, MOV, AVI)'
            : 'Please select a ZIP archive with images'
        );
        return;
      }

      setError(null);
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    },
    [inputType, title]
  );

  const handleBrowseClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = inputType === 'video' ? '.mp4,.mov,.avi' : '.zip';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileSelect(file);
    };
    input.click();
  }, [handleFileSelect, inputType]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedFile || !title.trim() || !spaceId) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Step 1: Create job and get upload URL
      const result = await createJob({
        space_id: spaceId,
        title: title.trim(),
        input_type: inputType,
      }).unwrap();

      const job = result.data;
      if (!job.upload_url) throw new Error('No upload URL received');

      // Step 2: Upload file directly to GCS
      setUploadProgress(5);
      const xhr = new XMLHttpRequest();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 85) + 5;
            setUploadProgress(pct);
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));

        xhr.open('PUT', job.upload_url!);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(selectedFile);
      });

      setUploadProgress(92);

      // Step 3: Start processing
      await startJob(job.job_id).unwrap();
      setUploadProgress(100);

      // Show job detail
      setSelectedJobId(job.job_id);
      setView('detail');
      resetForm();
      refetchJobs();
    } catch (err: any) {
      setError(err.message || 'Error creating job');
      setIsUploading(false);
    }
  }, [selectedFile, title, spaceId, inputType, createJob, startJob, refetchJobs]);

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[420px] max-w-full max-h-[700px]"
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
          gap: '16px',
          height: 'auto',
          maxHeight: '700px',
        },
      }}
    >
      {/* Header */}
      <Box display="flex" alignItems="center" className="px-[18px]">
        {view !== 'list' && (
          <IconButton
            onClick={() => {
              setView('list');
              resetForm();
              setSelectedJobId(null);
            }}
            size="small"
            sx={{
              position: 'absolute',
              left: '18px',
              width: '40px',
              height: '40px',
              padding: 0,
              borderRadius: '100px',
              backgroundColor: 'transparent',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
            }}
          >
            <img
              src="/icons/mattertag/arrow-left.svg"
              alt="Back"
              style={{ width: '40px', height: '40px' }}
            />
          </IconButton>
        )}
        <Box display="flex" alignItems="center" flex={1} justifyContent="center">
          <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
            {view === 'list' ? '3D Reconstruction' : view === 'create' ? 'New Scan' : 'Job Details'}
          </Typography>
        </Box>
      </Box>

      {/* List View */}
      {view === 'list' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          <Button
            onClick={() => setView('create')}
            sx={{
              width: '100%',
              height: '48px',
              borderRadius: '20px',
              backgroundColor: '#00000026',
              color: '#FFFFFF',
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 600,
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.4)' },
            }}
          >
            + Start new scan
          </Button>

          {jobs && jobs.length > 0 ? (
            jobs.map(job => (
              <JobListItem
                key={job.job_id}
                job={job}
                onClick={() => {
                  setSelectedJobId(job.job_id);
                  setView('detail');
                }}
              />
            ))
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#FFFFFF80', fontSize: '14px' }}>No 3D scans yet</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Create View */}
      {view === 'create' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {error && (
            <Box
              sx={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 107, 107, 0.2)',
                border: '1px solid rgba(255, 107, 107, 0.5)',
              }}
            >
              <Typography sx={{ color: '#FF6B6B', fontSize: '12px', fontWeight: 500 }}>
                {error}
              </Typography>
            </Box>
          )}

          <TextField
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Scan title"
            variant="outlined"
            size="small"
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                height: '48px',
                borderRadius: '20px',
                background: '#00000026',
                '& fieldset': { border: 'none' },
                '& input': { color: '#fff', '&::placeholder': { color: '#fff', opacity: 0.7 } },
              },
            }}
          />

          {/* Input type selector */}
          <Box
            sx={{
              display: 'flex',
              gap: '8px',
              padding: '0 4px',
            }}
          >
            <Button
              onClick={() => setInputType('video')}
              sx={{
                flex: 1,
                height: '40px',
                borderRadius: '20px',
                backgroundColor: inputType === 'video' ? '#FFFFFF20' : '#00000026',
                color: '#FFFFFF',
                textTransform: 'none',
                fontSize: '13px',
                fontWeight: inputType === 'video' ? 600 : 400,
                border: inputType === 'video' ? '1px solid #FFFFFF40' : 'none',
                '&:hover': { backgroundColor: '#FFFFFF20' },
              }}
            >
              Video
            </Button>
            <Button
              onClick={() => setInputType('images')}
              sx={{
                flex: 1,
                height: '40px',
                borderRadius: '20px',
                backgroundColor: inputType === 'images' ? '#FFFFFF20' : '#00000026',
                color: '#FFFFFF',
                textTransform: 'none',
                fontSize: '13px',
                fontWeight: inputType === 'images' ? 600 : 400,
                border: inputType === 'images' ? '1px solid #FFFFFF40' : 'none',
                '&:hover': { backgroundColor: '#FFFFFF20' },
              }}
            >
              Images (ZIP)
            </Button>
          </Box>

          {/* File drop zone */}
          {!selectedFile ? (
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleBrowseClick}
              sx={{
                width: '100%',
                height: '160px',
                borderRadius: '20px',
                padding: '30px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                border: '2px dashed #FFFFFF80',
                background: isDragging ? '#2E2E2E80' : '#2E2E2E59',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                '&:hover': { background: '#2E2E2E80' },
              }}
            >
              <Typography
                sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: '14px', textAlign: 'center' }}
              >
                {inputType === 'video'
                  ? 'Drop video here (.mp4, .mov, .avi)'
                  : 'Drop ZIP archive with images here'}
              </Typography>
              <Box
                sx={{
                  width: '124px',
                  height: '40px',
                  borderRadius: '500px',
                  padding: '8px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#00000026',
                  '&:hover': { backgroundColor: '#00000040' },
                }}
              >
                <Typography sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: '14px' }}>
                  Browse
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                width: '100%',
                borderRadius: '20px',
                padding: '12px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: '#00000026',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontWeight: 500,
                    fontSize: '14px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '250px',
                  }}
                >
                  {selectedFile.name}
                </Typography>
                <Typography sx={{ color: '#FFFFFF80', fontSize: '12px' }}>
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                </Typography>
              </Box>
              {isUploading && (
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress}
                  sx={{
                    borderRadius: '4px',
                    backgroundColor: '#FFFFFF20',
                    '& .MuiLinearProgress-bar': { backgroundColor: '#4CAF50' },
                  }}
                />
              )}
            </Box>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Button
              onClick={() => {
                setView('list');
                resetForm();
              }}
              disabled={isUploading}
              sx={{
                flex: 1,
                height: '48px',
                borderRadius: '20px',
                backgroundColor: 'transparent',
                color: '#FFFFFF',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 600,
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                '&.Mui-disabled': { opacity: 0.5, color: '#FFFFFF' },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedFile || !title.trim() || isUploading}
              sx={{
                flex: 1,
                height: '48px',
                borderRadius: '20px',
                backgroundColor: '#00000026',
                color: '#FFFFFF',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 600,
                '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.4)' },
                '&.Mui-disabled': { opacity: 0.5, color: '#FFFFFF' },
              }}
            >
              {isUploading ? `Uploading... ${uploadProgress}%` : 'Start scan'}
            </Button>
          </Box>
        </Box>
      )}

      {/* Detail View */}
      {view === 'detail' && selectedJobId && (
        <JobDetail
          jobId={selectedJobId}
          onCancel={async id => {
            await cancelJob(id).unwrap();
            refetchJobs();
          }}
        />
      )}
    </Dialog>
  );
};

// ── Job List Item ────────────────────────────────────────────────────────────

const JobListItem = ({ job, onClick }: { job: ReconstructionJob; onClick: () => void }) => {
  const statusColor =
    job.status === 'completed'
      ? '#4CAF50'
      : job.status === 'failed'
        ? '#FF6B6B'
        : job.status === 'cancelled'
          ? '#FF9800'
          : isProcessing(job.status)
            ? '#2196F3'
            : '#FFFFFF80';

  return (
    <Box
      onClick={onClick}
      sx={{
        width: '100%',
        borderRadius: '20px',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        backgroundColor: '#00000026',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        '&:hover': { backgroundColor: '#00000040' },
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography
          sx={{
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '14px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '220px',
          }}
        >
          {job.title}
        </Typography>
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: '12px',
            backgroundColor: `${statusColor}20`,
            border: `1px solid ${statusColor}40`,
          }}
        >
          <Typography sx={{ color: statusColor, fontSize: '11px', fontWeight: 600 }}>
            {getStatusLabel(job.status)}
          </Typography>
        </Box>
      </Box>
      {isProcessing(job.status) && (
        <LinearProgress
          variant="determinate"
          value={getProgressPercent(job.status)}
          sx={{
            borderRadius: '4px',
            backgroundColor: '#FFFFFF20',
            '& .MuiLinearProgress-bar': { backgroundColor: '#2196F3' },
          }}
        />
      )}
      <Typography sx={{ color: '#FFFFFF60', fontSize: '11px' }}>
        {new Date(job.created_at).toLocaleDateString('en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Typography>
    </Box>
  );
};

// ── Job Detail ───────────────────────────────────────────────────────────────

const JobDetail = ({ jobId, onCancel }: { jobId: number; onCancel: (id: number) => void }) => {
  const { data: job, isLoading } = useGetJobQuery(jobId, {
    pollingInterval: 5000,
  });
  const { data: output } = useGetJobOutputQuery(jobId, {
    skip: job?.status !== 'completed',
  });
  const [splatViewerUrl, setSplatViewerUrl] = useState<string | null>(null);

  const viewableSplatUrl = output?.splat_url || output?.spz_url || null;

  if (isLoading || !job) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography sx={{ color: '#FFFFFF80' }}>Loading...</Typography>
      </Box>
    );
  }

  const statusColor =
    job.status === 'completed'
      ? '#4CAF50'
      : job.status === 'failed'
        ? '#FF6B6B'
        : job.status === 'cancelled'
          ? '#FF9800'
          : isProcessing(job.status)
            ? '#2196F3'
            : '#FFFFFF80';

  const canCancel = !['completed', 'failed', 'cancelled'].includes(job.status);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Status */}
      <Box
        sx={{
          borderRadius: '20px',
          padding: '16px 18px',
          backgroundColor: '#00000026',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: '16px' }}>
            {job.title}
          </Typography>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: '12px',
              backgroundColor: `${statusColor}20`,
              border: `1px solid ${statusColor}40`,
            }}
          >
            <Typography sx={{ color: statusColor, fontSize: '12px', fontWeight: 600 }}>
              {getStatusLabel(job.status)}
            </Typography>
          </Box>
        </Box>

        {isProcessing(job.status) && (
          <LinearProgress
            variant="determinate"
            value={getProgressPercent(job.status)}
            sx={{
              height: 6,
              borderRadius: '4px',
              backgroundColor: '#FFFFFF20',
              '& .MuiLinearProgress-bar': { backgroundColor: '#2196F3' },
            }}
          />
        )}

        {job.error_message && (
          <Typography sx={{ color: '#FF6B6B', fontSize: '12px' }}>{job.error_message}</Typography>
        )}
      </Box>

      {/* Details */}
      <Box
        sx={{
          borderRadius: '20px',
          padding: '14px 18px',
          backgroundColor: '#00000026',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <DetailRow label="Type" value={job.input_type === 'video' ? 'Video' : 'Images'} />
        {job.input_frame_count && (
          <DetailRow label="Frames" value={String(job.input_frame_count)} />
        )}
        {job.colmap_point_count && (
          <DetailRow label="COLMAP Points" value={job.colmap_point_count.toLocaleString('en-US')} />
        )}
        {job.point_count && (
          <DetailRow label="Gaussian Splats" value={job.point_count.toLocaleString('en-US')} />
        )}
        {job.worker_started_at && (
          <DetailRow
            label="Started"
            value={new Date(job.worker_started_at).toLocaleString('en-US')}
          />
        )}
        {job.worker_finished_at && (
          <DetailRow
            label="Finished"
            value={new Date(job.worker_finished_at).toLocaleString('en-US')}
          />
        )}
      </Box>

      {/* Download links */}
      {job.status === 'completed' && output && (
        <Box
          sx={{
            borderRadius: '20px',
            padding: '14px 18px',
            backgroundColor: '#00000026',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <Typography sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: '14px', mb: 0.5 }}>
            Downloads
          </Typography>
          {output.ply_url && <DownloadButton label="PLY File" url={output.ply_url} />}
          {output.splat_url && <DownloadButton label="Splat File" url={output.splat_url} />}
          {output.spz_url && <DownloadButton label="SPZ File" url={output.spz_url} />}
        </Box>
      )}

      {/* 3D Viewer button */}
      {job.status === 'completed' && viewableSplatUrl && (
        <Button
          onClick={() => setSplatViewerUrl(viewableSplatUrl)}
          startIcon={<ThreeDRotationIcon />}
          sx={{
            width: '100%',
            height: '48px',
            borderRadius: '20px',
            backgroundColor: 'rgba(33, 150, 243, 0.15)',
            color: '#2196F3',
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 600,
            '&:hover': { backgroundColor: 'rgba(33, 150, 243, 0.25)' },
          }}
        >
          View 3D
        </Button>
      )}

      {/* Splat Viewer overlay */}
      {splatViewerUrl && (
        <SplatViewer splatUrl={splatViewerUrl} onClose={() => setSplatViewerUrl(null)} />
      )}

      {/* Cancel button */}
      {canCancel && (
        <Button
          onClick={() => onCancel(job.job_id)}
          sx={{
            width: '100%',
            height: '48px',
            borderRadius: '20px',
            backgroundColor: 'rgba(255, 107, 107, 0.15)',
            color: '#FF6B6B',
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 600,
            '&:hover': { backgroundColor: 'rgba(255, 107, 107, 0.25)' },
          }}
        >
          Cancel
        </Button>
      )}
    </Box>
  );
};

// ── Small Helpers ────────────────────────────────────────────────────────────

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <Box display="flex" justifyContent="space-between">
    <Typography sx={{ color: '#FFFFFF80', fontSize: '13px' }}>{label}</Typography>
    <Typography sx={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 500 }}>{value}</Typography>
  </Box>
);

const DownloadButton = ({ label, url }: { label: string; url: string }) => (
  <Box
    component="a"
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderRadius: '14px',
      backgroundColor: '#FFFFFF10',
      color: '#FFFFFF',
      textDecoration: 'none',
      transition: 'background-color 0.2s',
      '&:hover': { backgroundColor: '#FFFFFF20' },
    }}
  >
    <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>{label}</Typography>
    <Typography sx={{ fontSize: '12px', color: '#FFFFFF60' }}>Download</Typography>
  </Box>
);
