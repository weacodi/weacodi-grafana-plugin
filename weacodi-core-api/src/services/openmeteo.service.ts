import axios from 'axios';

type ForecastParams = {
  latitude: number;
  longitude: number;
  days: number;
};

export class OpenMeteoService {
  private readonly hourlyParams = [
    'temperature_2m',
    'relativehumidity_2m',
    'precipitation',
    'cloudcover',
    'windspeed_10m',
    'direct_radiation',
  ];

  public async fetchForecast({ latitude, longitude, days }: ForecastParams): Promise<any> {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('hourly', this.hourlyParams.join(','));
    url.searchParams.set('forecast_days', days.toString());

    const response = await axios.get(url.toString());
    return response.data;
  }
}
