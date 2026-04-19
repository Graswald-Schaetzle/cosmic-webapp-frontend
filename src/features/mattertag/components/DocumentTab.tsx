import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  CircularProgress,
  Typography,
} from '@mui/material';
import { LocationDetailResponse } from '../../../api/locationApi/locationApi';
import { useGetAllDocumentsQuery } from '../../../api/documents/documentApi';
import { useDispatch } from 'react-redux';
import {
  openAddDocumentWindow,
  closeMatterTagWindow,
  openDocumentInfoWindow,
} from '../../../store/modalSlice';

interface DocumentTabProps {
  locationData: LocationDetailResponse;
}

export const DocumentTab = ({ locationData }: DocumentTabProps) => {
  const dispatch = useDispatch();

  // Fetch documents for this location
  const {
    data: documentsResponse,
    isLoading,
    error,
  } = useGetAllDocumentsQuery({
    location_id: locationData.location_id,
  });

  // Flatten all documents from all floors and rooms
  const allDocuments =
    documentsResponse?.floors?.flatMap(floor => floor.rooms.flatMap(room => room.documents)) || [];

  const handleAddDocumentsClick = () => {
    // Close MatterTagWindow first
    dispatch(closeMatterTagWindow());

    // Then open AddDocumentWindow with redirect information
    const preSelectedLocation = {
      id: locationData.location_id,
      name: locationData.location_name,
      room_id: locationData.room_id,
    };

    dispatch(
      openAddDocumentWindow({
        preSelectedLocation,
        redirectBack: {
          type: 'mattertag',
          tagData: locationData,
        },
      })
    );
  };

  const handleDocumentClick = (documentId: string) => {
    // Close MatterTagWindow first
    dispatch(closeMatterTagWindow());

    // Then open DocumentInfoWindow with redirect back information
    dispatch(
      openDocumentInfoWindow({
        docId: documentId,
        redirectBack: {
          type: 'mattertag',
          tagData: locationData,
        },
      })
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Location section */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* New Document Button */}
        <Button
          variant="outlined"
          startIcon={<img src="/icons/mattertag/plus.svg" alt="Add" />}
          fullWidth
          onClick={handleAddDocumentsClick}
          sx={{
            justifyContent: 'flex-start',
            width: { xs: '100%', sm: '356px' },
            maxWidth: '100%',
            height: '48px',
            textTransform: 'none',
            bgcolor: 'rgba(0, 0, 0, 0.15)',
            border: 'none',
            borderRadius: '20px',
            color: '#FFFFFF',
            padding: '0 8px 0 18px',
            gap: '16px',
            fontWeight: 600,
            fontSize: '14px',
            lineHeight: '22px',
            letterSpacing: '0px',
            verticalAlign: 'middle',
            '&:hover': {
              bgcolor: '#FFFFFF26',
              border: 'none',
            },
            '& .MuiButton-startIcon': {
              margin: 0,
            },
          }}
        >
          Add documents
        </Button>
        <Paper
          sx={{
            flex: 1,
            overflowY: 'auto',
            bgcolor: 'rgba(0, 0, 0, 0.15)',
            borderRadius: '20px',
          }}
        >
          {isLoading ? (
            <Box
              sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}
            >
              <CircularProgress sx={{ color: '#fff' }} />
            </Box>
          ) : error ? (
            <Box
              sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}
            >
              <Typography sx={{ color: '#ff6b6b', textAlign: 'center' }}>
                Error loading documents
              </Typography>
            </Box>
          ) : allDocuments.length === 0 ? (
            <Box
              sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}
            >
              <Typography sx={{ color: '#FFFFFF', textAlign: 'center' }}>
                No documents found
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {allDocuments.map(document => (
                <ListItem
                  key={document.document_id}
                  disablePadding
                  sx={{
                    mb: 0,
                    borderWidth: '1px 0 1px 0',
                    borderStyle: 'solid',
                    borderColor: '#FFFFFF40',
                    '&:first-of-type': {
                      borderTop: 'none',
                    },
                    '&:last-of-type': {
                      borderBottom: 'none',
                    },
                  }}
                >
                  <ListItemButton
                    onClick={() => handleDocumentClick(document.document_id.toString())}
                    sx={{
                      bgcolor: 'transparent',
                      height: '48px',
                      px: 2.25,
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        '& .arrow-icon': {
                          display: 'block',
                        },
                      },
                    }}
                  >
                    <ListItemText
                      primary={document.name}
                      primaryTypographyProps={{
                        sx: {
                          fontSize: '14px',
                          fontWeight: 500,
                          lineHeight: '22px',
                          color: '#FFFFFF',
                        },
                      }}
                    />
                    <Box
                      className="arrow-icon"
                      sx={{
                        display: 'none',
                        position: 'absolute',
                        right: '18px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    >
                      <img src="/icons/mattertag/arrow-right.svg" alt="Arrow right" />
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Box>
    </Box>
  );
};
