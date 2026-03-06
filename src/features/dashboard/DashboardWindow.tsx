import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store.ts';
import { Dialog } from '../../components/Dialog';
import {
  closeDashboardWindow,
  openNotificationWindow,
  openCalendarWindow,
} from '../../store/modalSlice.ts';
import { DesignedCalendar } from '../../components/DesignedCalendar';
import { useEffect, useState } from 'react';
import { WeatherData, fetchWeatherData, getCurrentLocation } from '../../api/weather/weatherApi';
import {
  useGetNotificationsQuery,
  useMarkNotificationsAsReadMutation,
  useGetLastActivitiesQuery,
} from '../../api/notifications/notificationApi';

import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';

// Weather icon mapping function
const getWeatherIcon = (weatherCode: string): string => {
  const iconMap: { [key: string]: string } = {
    '01d': '/icons/weather/sun.svg', // clear sky day
    '01n': '/icons/weather/moon.svg', // clear sky night
    '02d': '/icons/weather/partly-cloudy-day.svg', // few clouds day
    '02n': '/icons/weather/partly-cloudy-night.svg', // few clouds night
    '03d': '/icons/weather/cloud.svg', // scattered clouds
    '03n': '/icons/weather/cloud.svg',
    '04d': '/icons/weather/cloudy.svg', // broken clouds
    '04n': '/icons/weather/cloudy.svg',
    '09d': '/icons/weather/rain.svg', // shower rain
    '09n': '/icons/weather/rain.svg',
    '10d': '/icons/weather/partly-cloudy-day-rain.svg', // rain day
    '10n': '/icons/weather/partly-cloudy-night-rain.svg', // rain night
    '11d': '/icons/weather/thunder.svg', // thunderstorm
    '11n': '/icons/weather/thunder.svg',
    '13d': '/icons/weather/snow.svg', // snow
    '13n': '/icons/weather/snow.svg',
    '50d': '/icons/weather/fog.svg', // mist
    '50n': '/icons/weather/fog.svg',
  };
  return iconMap[weatherCode] || '/icons/weather/sun.svg'; // default to sun if no match
};

export const DashboardWindow = () => {
  const dispatch = useDispatch();
  const { isOpen } = useSelector((state: RootState) => state.modal.dashboardWindowModal);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date();

  // Fetch notifications from API
  const { data: notificationsResponse, isLoading: notificationsLoading } = useGetNotificationsQuery(
    {}
  );
  const [markNotificationsAsRead] = useMarkNotificationsAsReadMutation();

  // Fetch last activities from API
  const { data: lastActivitiesResponse, isLoading: lastActivitiesLoading } =
    useGetLastActivitiesQuery();

  // Get notifications data from the new structure and sort by new first
  const notifications = [
    ...(notificationsResponse?.floors?.flatMap(f => f.rooms).flatMap(r => r.notifications) || []),
  ].sort((a, b) => {
    // First priority: new notifications come first
    if (a.is_new && !b.is_new) return -1;
    if (!a.is_new && b.is_new) return 1;

    // Second priority: newest notifications first (by created_at)
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });

  // Get last activities data from API and sort by newest first
  const lastActivities = [...(lastActivitiesResponse?.notifications || [])].sort((a, b) => {
    // Sort by newest first (by created_at)
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });

  const handleNotificationClick = async (notification: any) => {
    try {
      // Mark this specific notification as read using notification_id
      await markNotificationsAsRead({
        notification_id: notification.notification_id,
      });

      // Close dashboard and open notification window with selected notification
      dispatch(closeDashboardWindow());
      dispatch(
        openNotificationWindow({
          selectedNotificationId: notification.notification_id,
        })
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  useEffect(() => {
    const loadWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const location = await getCurrentLocation();
        const weatherData = await fetchWeatherData(location.latitude, location.longitude);
        setWeather(weatherData);
      } catch (error) {
        console.error('Error loading weather:', error);
        setError(error instanceof Error ? error.message : 'Failed to load weather data');
      } finally {
        setLoading(false);
      }
    };

    loadWeather();
  }, []);

  const handleClose = () => {
    dispatch(closeDashboardWindow());
  };

  const handleDateSelect = (date: Date) => {
    // Close dashboard and open calendar window with selected date
    dispatch(closeDashboardWindow());
    dispatch(openCalendarWindow({ selectedDate: date }));
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      className="w-[756px]"
      PaperProps={{
        sx: {
          borderRadius: '32px',
          overflow: 'hidden',
          backgroundColor: 'rgba(46, 46, 46, 0.35)',
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          padding: '32px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          height: 'auto',
          maxHeight: '90vh',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          padding: '0 8px 0 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '20px',
            lineHeight: '32px',
            color: '#FFFFFF',
            textAlign: 'left',
          }}
        >
          Dashboard
        </Typography>
        <Button
          sx={{
            width: '63px',
            height: '40px',
            borderRadius: '500px',
            padding: '8px 18px',
            gap: '12px',
            backgroundColor: '#FFFFFF1A',
            color: '#FFFFFF',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: '#FFFFFF2A',
            },
          }}
        >
          Edit
        </Button>
      </Box>

      {/* Two Columns Layouts */}
      <Box sx={{ display: 'flex', gap: '20px' }}>
        {/* Left Column */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Weather Section */}
          <Box>
            <Typography
              sx={{
                padding: '12px 18px',
                gap: '8px',
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '18px',
                color: '#FFFFFF',
              }}
            >
              Weather
            </Typography>
            <Box
              sx={{
                width: '100%',
                height: '112px',
                backgroundColor: '#00000026',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                color: '#FFFFFF',
              }}
            >
              {loading ? (
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                >
                  <CircularProgress size={24} sx={{ color: '#FFFFFF' }} />
                </Box>
              ) : error ? (
                <Typography color="error">{error}</Typography>
              ) : weather ? (
                <>
                  {/* Location and Weather Icon Row */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      height: '24px',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        height: '24px',
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 600,
                          fontSize: '14px',
                          lineHeight: '22px',
                          color: '#FFFFFF',
                        }}
                      >
                        {weather.name}, {weather.sys.country}
                      </Typography>
                      <img
                        src="/icons/mattertag/geo-arrow.svg"
                        alt="Location"
                        style={{ width: '16px', height: '16px' }}
                      />
                    </Box>
                    <img
                      src={getWeatherIcon(weather.weather[0].icon)}
                      alt={weather.weather[0].description}
                      style={{ width: '40px', height: '40px' }}
                    />
                  </Box>

                  {/* Temperature and Weather Details Row */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      height: '48px',
                    }}
                  >
                    {/* Left Column - Temperature */}
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 500,
                          fontSize: '40px',
                          lineHeight: '100%',
                          color: '#FFFFFF',
                        }}
                      >
                        {Math.round(weather.main.temp)}°
                      </Typography>
                    </Box>

                    {/* Right Column - Weather Details */}
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 500,
                          fontSize: '14px',
                          lineHeight: '22px',
                          color: '#FFFFFF',
                          textTransform: 'capitalize',
                        }}
                      >
                        {weather.weather[0].description}
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 500,
                          fontSize: '14px',
                          lineHeight: '22px',
                          color: '#FFFFFF',
                        }}
                      >
                        H: {Math.round(weather.main.temp_max)}° L:{' '}
                        {Math.round(weather.main.temp_min)}°
                      </Typography>
                    </Box>
                  </Box>
                </>
              ) : (
                'No weather data available'
              )}
            </Box>
          </Box>

          {/* Calendar Section */}
          <Box>
            <Typography
              sx={{
                padding: '12px 18px',
                gap: '8px',
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '18px',
                color: '#FFFFFF',
              }}
            >
              Calendar
            </Typography>
            <Box
              sx={{
                display: 'flex',
                width: '100%',
                height: 'fit-content',
                padding: '12px 8px',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#00000026',
                borderRadius: '16px',
                '& > div': {
                  width: '100%',
                },
              }}
            >
              <DesignedCalendar
                onDateSelect={handleDateSelect}
                selectedDate={today}
                currentDate={today}
                datesWithTasks={[]}
              />
            </Box>
          </Box>
        </Box>

        {/* Right Column */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Notifications Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 18px',
                gap: '8px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Typography
                  sx={{
                    fontWeight: 500,
                    fontSize: '16px',
                    lineHeight: '18px',
                    color: '#FFFFFF',
                  }}
                >
                  Notifications
                </Typography>
              </Box>
              <img
                src="/icons/mattertag/arrow-right.svg"
                alt="Arrow right"
                style={{ width: '24px', height: '24px' }}
              />
            </Box>
            <Paper
              elevation={0}
              sx={{
                width: '100%',
                height: '196.8px',
                overflowY: 'auto',
                bgcolor: 'rgba(0, 0, 0, 0.15)',
                borderRadius: '20px',
                '&::-webkit-scrollbar': {
                  display: 'none',
                },
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {notificationsLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <CircularProgress size={24} sx={{ color: '#FFFFFF' }} />
                </Box>
              ) : (
                <List disablePadding>
                  {notifications.map(notification => (
                    <ListItem
                      key={notification.notification_id}
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
                        onClick={() => handleNotificationClick(notification)}
                        sx={{
                          bgcolor: 'transparent',
                          height: '48px',
                          px: 2.25,
                          position: 'relative',
                          '&:hover': {
                            bgcolor: '#FFFFFF26',
                            '& .arrow-icon': {
                              display: 'block',
                            },
                          },
                        }}
                      >
                        <ListItemText
                          primary={notification.name}
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
                          <Typography
                            sx={{
                              fontSize: '12px',
                              fontWeight: 400,
                              lineHeight: '16px',
                              color: 'rgba(255, 255, 255, 0.7)',
                              textAlign: 'right',
                            }}
                          >
                            {new Date(notification.created_at).toLocaleDateString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                            })}
                            {' at '}
                            {new Date(notification.created_at).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </Typography>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Box>

          {/* Activities Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Box
              sx={{
                padding: '12px 18px',
                gap: '8px',
              }}
            >
              <Typography
                sx={{
                  fontWeight: 500,
                  fontSize: '16px',
                  lineHeight: '18px',
                  color: '#FFFFFF',
                }}
              >
                Last activities
              </Typography>
            </Box>
            <Paper
              elevation={0}
              sx={{
                width: '100%',
                height: '196.8px',
                overflowY: 'auto',
                bgcolor: 'rgba(0, 0, 0, 0.15)',
                borderRadius: '20px',
                '&::-webkit-scrollbar': {
                  display: 'none',
                },
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {lastActivitiesLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <CircularProgress size={24} sx={{ color: '#FFFFFF' }} />
                </Box>
              ) : (
                <List disablePadding>
                  {lastActivities.map((activity: any) => (
                    <ListItem
                      key={activity.notification_id}
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
                        onClick={() => handleNotificationClick(activity)}
                        sx={{
                          bgcolor: 'transparent',
                          height: '48px',
                          px: 2.25,
                          position: 'relative',
                          gap: '12px',
                          '&:hover': {
                            bgcolor: '#FFFFFF26',
                            '& .arrow-icon': {
                              display: 'block',
                            },
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex' }}>
                          <img
                            src="/icons/mattertag/check-icon.svg"
                            alt="Arrow right"
                            style={{ width: '24px', height: '24px' }}
                          />
                        </Box>
                        <ListItemText
                          primary={activity.name}
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
                          <Typography
                            sx={{
                              fontSize: '12px',
                              fontWeight: 400,
                              lineHeight: '16px',
                              color: 'rgba(255, 255, 255, 0.7)',
                              textAlign: 'right',
                            }}
                          >
                            {new Date(activity.created_at).toLocaleDateString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                            })}
                            {' at '}
                            {new Date(activity.created_at).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </Typography>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};
