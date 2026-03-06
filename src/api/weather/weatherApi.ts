import axios from 'axios';

export interface WeatherData {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    temp_max: number;
    temp_min: number;
  };
  wind: {
    speed: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  name: string;
  sys: {
    country: string;
  };
}

export class WeatherApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeatherApiError';
  }
}

export const fetchWeatherData = async (
  latitude: number,
  longitude: number
): Promise<WeatherData> => {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

  if (!apiKey) {
    throw new WeatherApiError('OpenWeather API key is not configured');
  }

  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
      params: {
        lat: latitude,
        lon: longitude,
        appid: apiKey,
        units: 'metric',
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new WeatherApiError('Failed to fetch weather data');
    }
    throw new WeatherApiError('Failed to fetch weather data');
  }
};

export const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          reject(new WeatherApiError('Failed to get location'));
        }
      );
    } else {
      reject(new WeatherApiError('Geolocation is not supported'));
    }
  });
};
