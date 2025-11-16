const axios = require('axios');
const config = require('./config');
const { format, subDays, startOfDay, parseISO, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } = require('date-fns');
const { fr } = require('date-fns/locale');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');

class ElectricityService {
  constructor() {
    this.baseUrl = config.myElectricalData.baseUrl;
    this.pdl = config.myElectricalData.pointDeLivraison;
    this.token = config.myElectricalData.token;
    this.cache = null;
    this.cacheTimestamp = null;
    this.cacheDailyChartDays = null; // Track which dailyChartDays was cached
    this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache
    this.last409ErrorLogTime = 0;
    this.ERROR_LOG_INTERVAL = 5 * 60 * 1000; // Log 409 errors at most once every 5 minutes
  }

  async fetchFromAPI(endpoint, retries = 2) {
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Authorization': this.token
        },
        timeout: 30000 // 30 seconds timeout
      });

      return response.data;
    } catch (error) {
      // Only log error if it's not a 409 (handled separately) or if enough time has passed
      const now = Date.now();
      if (error.response?.status !== 409 && (now - this.last409ErrorLogTime > this.ERROR_LOG_INTERVAL)) {
        console.error('Error fetching from MyElectricalData API:', error.message);
      }
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        
        // Handle 409 Conflict (rate limiting) with retry
        if (status === 409 && retries > 0) {
          const now = Date.now();
          if (now - this.last409ErrorLogTime > this.ERROR_LOG_INTERVAL) {
            console.log(`Rate limit hit (409), retrying in 3 seconds... (${retries} retries left)`);
            this.last409ErrorLogTime = now;
          }
          // Increase delay to 3 seconds for 409 errors
          await new Promise(resolve => setTimeout(resolve, 3000));
          return this.fetchFromAPI(endpoint, retries - 1);
        }
        
        // Handle 429 Too Many Requests
        if (status === 429 && retries > 0) {
          const retryAfter = error.response.headers['retry-after'] || 5;
          console.log(`Rate limit hit (429), retrying after ${retryAfter} seconds... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.fetchFromAPI(endpoint, retries - 1);
        }
        
        throw new Error(`API error: ${status} - ${statusText}`);
      }
      throw error;
    }
  }

  /**
   * Get daily consumption for a date range
   * Uses cache endpoint if enabled to reduce API load
   */
  async getDailyConsumption(startDate, endDate, useCache = null) {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    const shouldUseCache = useCache !== null ? useCache : config.myElectricalData.useCache;
    const endpoint = `/daily_consumption/${this.pdl}/start/${start}/end/${end}${shouldUseCache ? '/cache/' : ''}`;
    
    if (shouldUseCache) {
      console.log(`[Électricité] 📡 Appel API: daily_consumption (endpoint cache)`);
    } else {
      console.log(`[Électricité] 📡 Appel API: daily_consumption (endpoint direct)`);
    }
    
    const data = await this.fetchFromAPI(endpoint);
    return data;
  }

  /**
   * Get consumption load curve (hourly data) for a date range
   * Uses cache endpoint if enabled to reduce API load
   */
  async getConsumptionLoadCurve(startDate, endDate, useCache = null) {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    const shouldUseCache = useCache !== null ? useCache : config.myElectricalData.useCache;
    const endpoint = `/consumption_load_curve/${this.pdl}/start/${start}/end/${end}${shouldUseCache ? '/cache/' : ''}`;
    
    const data = await this.fetchFromAPI(endpoint);
    return data;
  }

  /**
   * Get contract information
   * Uses cache endpoint if enabled to reduce API load
   */
  async getContract(useCache = null) {
    const shouldUseCache = useCache !== null ? useCache : config.myElectricalData.useCache;
    const endpoint = `/contracts/${this.pdl}${shouldUseCache ? '/cache/' : '/'}`;
    
    if (shouldUseCache) {
      console.log(`[Électricité] 📡 Appel API: contracts (endpoint cache)`);
    } else {
      console.log(`[Électricité] 📡 Appel API: contracts (endpoint direct)`);
    }
    
    const data = await this.fetchFromAPI(endpoint);
    return data;
  }

  /**
   * Get monthly consumption data for the last 12 months
   * Reuses daily data if provided to avoid multiple API calls
   */
  async getMonthlyConsumption(dailyDataForYear = null) {
    const timezone = config.timezone;
    const now = new Date();
    const todayInParis = utcToZonedTime(now, timezone);
    const startOfToday = startOfDay(todayInParis);
    
    // Get data for the last 12 months
    const twelveMonthsAgo = startOfMonth(subMonths(startOfToday, 12));
    
    let dailyData;
    if (dailyDataForYear) {
      // Reuse provided data to avoid additional API call
      dailyData = dailyDataForYear;
    } else {
      // Fetch daily data and aggregate by month
      const start = format(twelveMonthsAgo, 'yyyy-MM-dd');
      const end = format(startOfToday, 'yyyy-MM-dd');
      dailyData = await this.getDailyConsumption(twelveMonthsAgo, startOfToday);
    }
    
    // Aggregate daily data by month
    const monthlyData = {};
    
    // Handle different possible response structures
    let readings = [];
    if (dailyData) {
      if (Array.isArray(dailyData)) {
        readings = dailyData;
      } else if (dailyData.meter_reading) {
        if (Array.isArray(dailyData.meter_reading)) {
          readings = dailyData.meter_reading;
        } else if (dailyData.meter_reading.interval_reading && Array.isArray(dailyData.meter_reading.interval_reading)) {
          readings = dailyData.meter_reading.interval_reading;
        }
      } else if (dailyData.interval_reading && Array.isArray(dailyData.interval_reading)) {
        readings = dailyData.interval_reading;
      } else if (dailyData.readings && Array.isArray(dailyData.readings)) {
        readings = dailyData.readings;
      } else if (typeof dailyData === 'object') {
        const keys = Object.keys(dailyData);
        for (const key of keys) {
          if (Array.isArray(dailyData[key])) {
            readings = dailyData[key];
            break;
          } else if (dailyData[key] && typeof dailyData[key] === 'object' && dailyData[key].interval_reading && Array.isArray(dailyData[key].interval_reading)) {
            readings = dailyData[key].interval_reading;
            break;
          }
        }
      }
    }

    // Check if values are in Wh and need conversion to kWh
    // The API typically returns values in Wh, so we need to convert to kWh
    const needsConversion = dailyData?.meter_reading?.reading_type?.unit === 'Wh';
    const conversionFactor = needsConversion ? 1000 : 1;

    // Group readings by month
    readings.forEach(reading => {
      const readingDate = reading.date || reading.Date || reading.start || reading.Start;
      if (!readingDate) return;
      
      const date = parseISO(readingDate);
      const monthKey = format(date, 'yyyy-MM');
      const value = reading.value || reading.Value || reading.energy || reading.Energy;
      
      if (value !== undefined && value !== null) {
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            total: 0,
            count: 0
          };
        }
        // Convert from Wh to kWh if needed
        monthlyData[monthKey].total += (parseFloat(value) || 0) / conversionFactor;
        monthlyData[monthKey].count += 1;
      }
    });

    // Convert to array and format for the last 12 months
    const monthlyChartData = [];
    const months = eachMonthOfInterval({
      start: twelveMonthsAgo,
      end: startOfToday
    });

    months.forEach(month => {
      const monthKey = format(month, 'yyyy-MM');
      const monthData = monthlyData[monthKey];
      
      monthlyChartData.push({
        month: monthKey,
        monthLabel: format(month, 'MMM yyyy', { locale: fr }),
        value: monthData ? Math.round(monthData.total * 100) / 100 : 0
      });
    });

    return monthlyChartData;
  }

  /**
   * Get formatted consumption data for the widget
   * Returns today's consumption and this week's total
   * @param {number} dailyChartDays - Number of days to include in daily chart (default: 7)
   */
  async getWidgetData(dailyChartDays = 7) {
    // Check cache first - only use cache if it matches the requested dailyChartDays
    if (this.cache && this.cacheTimestamp && this.cacheDailyChartDays === dailyChartDays && Date.now() - this.cacheTimestamp < this.CACHE_DURATION) {
      const cacheAge = Math.round((Date.now() - this.cacheTimestamp) / 1000);
      console.log(`[Électricité] ✅ Données récupérées depuis le cache serveur (âge: ${cacheAge}s, ${dailyChartDays} jours)`);
      return this.cache;
    }
    
    console.log(`[Électricité] 🔄 Appel API réel - cache serveur expiré ou inexistant (demandé: ${dailyChartDays} jours, cache: ${this.cacheDailyChartDays || 'aucun'} jours)`);

    try {
      const timezone = config.timezone;
      const now = new Date();
      const todayInParis = utcToZonedTime(now, timezone);
      const startOfToday = startOfDay(todayInParis);
      const weekAgo = subDays(startOfToday, 7);
      const twoWeeksAgo = subDays(startOfToday, 14);
      const dailyChartStart = subDays(startOfToday, dailyChartDays);

      // Get daily consumption for the requested period (7 days by default, or more if dailyChartDays > 7)
      const daysToFetch = Math.max(7, dailyChartDays);
      const fetchStart = subDays(startOfToday, daysToFetch);
      const dailyData = await this.getDailyConsumption(fetchStart, startOfToday);
      
      // Add delay between API calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get daily consumption for the previous week (7-14 days ago)
      let previousWeekData = null;
      try {
        previousWeekData = await this.getDailyConsumption(twoWeeksAgo, weekAgo);
      } catch (error) {
        console.warn('Could not fetch previous week data:', error.message);
      }

      // Calculate today's consumption
      const today = format(startOfToday, 'yyyy-MM-dd');
      let todayConsumption = 0;
      let weekTotal = 0;
      let yesterdayConsumption = 0;
      let dayBeforeYesterdayConsumption = 0;
      let previousWeekTotal = 0;

      // Handle different possible response structures
      let readings = [];
      if (dailyData) {
        // Try different possible structures
        if (Array.isArray(dailyData)) {
          readings = dailyData;
        } else if (dailyData.meter_reading) {
          if (Array.isArray(dailyData.meter_reading)) {
            readings = dailyData.meter_reading;
          } else if (dailyData.meter_reading.interval_reading && Array.isArray(dailyData.meter_reading.interval_reading)) {
            readings = dailyData.meter_reading.interval_reading;
          } else if (typeof dailyData.meter_reading === 'object') {
            // If it's an object, try to extract an array from it
            readings = Object.values(dailyData.meter_reading).filter(item => Array.isArray(item) ? item : false).flat();
            if (readings.length === 0) {
              // If no array found, try to use the object itself as a single reading
              readings = [dailyData.meter_reading];
            }
          }
        } else if (dailyData.interval_reading && Array.isArray(dailyData.interval_reading)) {
          readings = dailyData.interval_reading;
        } else if (dailyData.readings && Array.isArray(dailyData.readings)) {
          readings = dailyData.readings;
        } else if (typeof dailyData === 'object') {
          // Try to find any array property
          const keys = Object.keys(dailyData);
          for (const key of keys) {
            if (Array.isArray(dailyData[key])) {
              readings = dailyData[key];
              break;
            } else if (dailyData[key] && typeof dailyData[key] === 'object' && dailyData[key].interval_reading && Array.isArray(dailyData[key].interval_reading)) {
              readings = dailyData[key].interval_reading;
              break;
            }
          }
        }
      }

      // Check if values are in Wh and need conversion to kWh
      const needsConversion = dailyData?.meter_reading?.reading_type?.unit === 'Wh';
      const conversionFactor = needsConversion ? 1000 : 1;

      console.log('Extracted readings count:', readings.length);
      if (readings.length > 0) {
        console.log('Sample reading:', JSON.stringify(readings[0], null, 2));
        console.log('Unit:', dailyData?.meter_reading?.reading_type?.unit, 'Conversion factor:', conversionFactor);
      }

      if (readings.length > 0) {
        // Find today's reading
        const todayReading = readings.find(r => {
          const readingDate = r.date || r.Date || r.start || r.Start;
          return readingDate === today || readingDate?.startsWith(today);
        });
        if (todayReading) {
          const rawValue = todayReading.value || todayReading.Value || todayReading.energy || todayReading.Energy || 0;
          todayConsumption = parseFloat(rawValue) / conversionFactor;
        }

        // Calculate week total (only last 7 days, regardless of dailyChartDays)
        const weekStartDate = format(subDays(startOfToday, 7), 'yyyy-MM-dd');
        readings.forEach(reading => {
          const readingDate = reading.date || reading.Date || reading.start || reading.Start;
          // Only include readings from the last 7 days (excluding today)
          if (readingDate && (readingDate >= weekStartDate && readingDate < today)) {
            const value = reading.value || reading.Value || reading.energy || reading.Energy;
            if (value !== undefined && value !== null) {
              weekTotal += parseFloat(value) / conversionFactor;
            }
          }
        });

        // Calculate previous week total if data is available
        if (previousWeekData) {
          let previousReadings = [];
          if (Array.isArray(previousWeekData)) {
            previousReadings = previousWeekData;
          } else if (previousWeekData.meter_reading) {
            if (Array.isArray(previousWeekData.meter_reading)) {
              previousReadings = previousWeekData.meter_reading;
            } else if (previousWeekData.meter_reading.interval_reading && Array.isArray(previousWeekData.meter_reading.interval_reading)) {
              previousReadings = previousWeekData.meter_reading.interval_reading;
            } else if (typeof previousWeekData.meter_reading === 'object') {
              previousReadings = Object.values(previousWeekData.meter_reading).filter(item => Array.isArray(item) ? item : false).flat();
              if (previousReadings.length === 0) {
                previousReadings = [previousWeekData.meter_reading];
              }
            }
          } else if (previousWeekData.interval_reading && Array.isArray(previousWeekData.interval_reading)) {
            previousReadings = previousWeekData.interval_reading;
          } else if (previousWeekData.readings && Array.isArray(previousWeekData.readings)) {
            previousReadings = previousWeekData.readings;
          } else if (typeof previousWeekData === 'object') {
            const keys = Object.keys(previousWeekData);
            for (const key of keys) {
              if (Array.isArray(previousWeekData[key])) {
                previousReadings = previousWeekData[key];
                break;
              } else if (previousWeekData[key] && typeof previousWeekData[key] === 'object' && previousWeekData[key].interval_reading && Array.isArray(previousWeekData[key].interval_reading)) {
                previousReadings = previousWeekData[key].interval_reading;
                break;
              }
            }
          }

          // Use the same conversion factor
          const previousNeedsConversion = previousWeekData?.meter_reading?.reading_type?.unit === 'Wh';
          const previousConversionFactor = previousNeedsConversion ? 1000 : 1;

          previousReadings.forEach(reading => {
            const value = reading.value || reading.Value || reading.energy || reading.Energy;
            if (value !== undefined && value !== null) {
              previousWeekTotal += parseFloat(value) / previousConversionFactor;
            }
          });
        }

        // Get yesterday's consumption
        const yesterday = format(subDays(startOfToday, 1), 'yyyy-MM-dd');
        const yesterdayReading = readings.find(r => {
          const readingDate = r.date || r.Date || r.start || r.Start;
          return readingDate === yesterday || readingDate?.startsWith(yesterday);
        });
        if (yesterdayReading) {
          const rawValue = yesterdayReading.value || yesterdayReading.Value || yesterdayReading.energy || yesterdayReading.Energy || 0;
          yesterdayConsumption = parseFloat(rawValue) / conversionFactor;
        }

        // Get day before yesterday's consumption
        const dayBeforeYesterday = format(subDays(startOfToday, 2), 'yyyy-MM-dd');
        const dayBeforeYesterdayReading = readings.find(r => {
          const readingDate = r.date || r.Date || r.start || r.Start;
          return readingDate === dayBeforeYesterday || readingDate?.startsWith(dayBeforeYesterday);
        });
        if (dayBeforeYesterdayReading) {
          const rawValue = dayBeforeYesterdayReading.value || dayBeforeYesterdayReading.Value || dayBeforeYesterdayReading.energy || dayBeforeYesterdayReading.Energy || 0;
          dayBeforeYesterdayConsumption = parseFloat(rawValue) / conversionFactor;
        }
      }

      // Add delay before contract call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get contract info for power info
      let contractInfo = null;
      try {
        const contractData = await this.getContract();
        if (contractData) {
          // Handle different possible structures
          let contracts = [];
          if (Array.isArray(contractData)) {
            contracts = contractData;
          } else if (contractData.contracts && Array.isArray(contractData.contracts)) {
            contracts = contractData.contracts;
          } else if (contractData.contract && typeof contractData.contract === 'object') {
            contracts = [contractData.contract];
          }

          if (contracts.length > 0) {
            const contract = contracts[0];
            contractInfo = {
              subscribedPower: contract.subscribed_power || contract.subscribedPower || contract.power || null,
              contractType: contract.contract_type || contract.contractType || contract.type || null
            };
          }
        }
      } catch (error) {
        console.warn('Could not fetch contract info:', error.message);
      }

      // Prepare daily data for chart (last N days, where N = dailyChartDays)
      const dailyChartData = [];
      if (readings.length > 0) {
        // Get all readings for the requested period
        for (let i = dailyChartDays - 1; i >= 0; i--) {
          const date = subDays(startOfToday, i);
          const dateStr = format(date, 'yyyy-MM-dd');
          const reading = readings.find(r => {
            const readingDate = r.date || r.Date || r.start || r.Start;
            return readingDate === dateStr || readingDate?.startsWith(dateStr);
          });
          
          let value = 0;
          if (reading) {
            const rawValue = reading.value || reading.Value || reading.energy || reading.Energy || 0;
            value = parseFloat(rawValue) / conversionFactor;
          }
          
          dailyChartData.push({
            date: dateStr,
            dateLabel: format(date, 'EEE d', { locale: fr }),
            value: Math.round(value * 100) / 100
          });
        }
      }

      // Get monthly data for 12 months chart
      // Use a more conservative approach: only fetch if we have enough quota
      let monthlyChartData = [];
      try {
        // For now, limit to 3 months to avoid 409 errors
        // The API has strict rate limits (5 calls/sec, 10000 calls/hour for all users)
        const timezone = config.timezone;
        const now = new Date();
        const todayInParis = utcToZonedTime(now, timezone);
        const startOfToday = startOfDay(todayInParis);
        const threeMonthsAgo = startOfMonth(subMonths(startOfToday, 3));
        
        // Add a delay between API calls to respect rate limits (increased to 1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const yearlyData = await this.getDailyConsumption(threeMonthsAgo, startOfToday);
        monthlyChartData = await this.getMonthlyConsumption(yearlyData);
        
        // If we only have 3 months, pad with empty months
        if (monthlyChartData.length < 12) {
          const allMonths = eachMonthOfInterval({
            start: startOfMonth(subMonths(startOfToday, 12)),
            end: startOfToday
          });
          
          const existingMonths = new Set(monthlyChartData.map(m => m.month));
          const paddedData = allMonths.map(month => {
            const monthKey = format(month, 'yyyy-MM');
            const existing = monthlyChartData.find(m => m.month === monthKey);
            return existing || {
              month: monthKey,
              monthLabel: format(month, 'MMM yyyy', { locale: fr }),
              value: 0
            };
          });
          monthlyChartData = paddedData;
        }
      } catch (error) {
        console.warn('Could not fetch monthly consumption data:', error.message);
        // If monthly data fails, continue without it
        monthlyChartData = [];
      }

      const result = {
        today: Math.round(todayConsumption * 100) / 100, // Round to 2 decimals
        yesterday: Math.round(yesterdayConsumption * 100) / 100,
        dayBeforeYesterday: Math.round(dayBeforeYesterdayConsumption * 100) / 100,
        weekTotal: Math.round(weekTotal * 100) / 100,
        weekAverage: Math.round((weekTotal / 7) * 100) / 100,
        previousWeekTotal: Math.round(previousWeekTotal * 100) / 100,
        dailyChartData,
        monthlyChartData,
        contractInfo,
        lastUpdate: new Date().toISOString()
      };

      // Update cache
      this.cache = result;
      this.cacheTimestamp = Date.now();
      this.cacheDailyChartDays = dailyChartDays;
      console.log(`[Électricité] 💾 Données mises en cache serveur (durée: ${this.CACHE_DURATION / 1000 / 60} minutes, ${dailyChartDays} jours)`);

      return result;
    } catch (error) {
      // Only log error if it's been more than ERROR_LOG_INTERVAL since last log
      const now = Date.now();
      if (now - this.last409ErrorLogTime > this.ERROR_LOG_INTERVAL) {
        console.error('Error getting widget data:', error.message);
        this.last409ErrorLogTime = now;
      }
      throw error;
    }
  }
}

module.exports = new ElectricityService();

