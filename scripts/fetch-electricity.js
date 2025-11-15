// Load environment variables from .env file
require('dotenv').config();

const electricityService = require('../server/electricity');
const fs = require('fs');
const path = require('path');

async function fetchAndDisplayElectricity() {
  try {
    console.log('Fetching electricity data from API...\n');
    
    // Get widget data
    console.log('=== Widget Data ===');
    const widgetData = await electricityService.getWidgetData();
    console.log(JSON.stringify(widgetData, null, 2));
    console.log('\n');

    // Get raw daily consumption data
    console.log('=== Raw Daily Consumption Data ===');
    const { format, subDays, startOfDay } = require('date-fns');
    const { utcToZonedTime } = require('date-fns-tz');
    const config = require('../server/config');
    
    const timezone = config.timezone;
    const now = new Date();
    const todayInParis = utcToZonedTime(now, timezone);
    const startOfToday = startOfDay(todayInParis);
    const weekAgo = subDays(startOfToday, 7);
    
    const dailyData = await electricityService.getDailyConsumption(weekAgo, startOfToday);
    console.log(JSON.stringify(dailyData, null, 2));
    console.log('\n');

    // Get contract data
    console.log('=== Contract Data ===');
    let contractData = null;
    try {
      contractData = await electricityService.getContract();
      console.log(JSON.stringify(contractData, null, 2));
    } catch (error) {
      console.error('Error fetching contract:', error.message);
    }
    console.log('\n');

    // Save full dump to file
    const dumpPath = path.join(__dirname, 'electricity-dump.json');
    const fullDump = {
      timestamp: new Date().toISOString(),
      widgetData,
      dailyData,
      contractData
    };
    
    fs.writeFileSync(dumpPath, JSON.stringify(fullDump, null, 2));
    console.log(`\nFull dump saved to: ${dumpPath}`);

    // Analysis
    console.log('\n=== Analysis ===');
    console.log(`Today's consumption: ${widgetData.today} kWh`);
    console.log(`Yesterday's consumption: ${widgetData.yesterday} kWh`);
    console.log(`Week total: ${widgetData.weekTotal} kWh`);
    console.log(`Week average: ${widgetData.weekAverage} kWh/day`);
    
    if (dailyData) {
      console.log('\nDaily data structure:');
      console.log('- Type:', typeof dailyData);
      console.log('- Is array:', Array.isArray(dailyData));
      if (typeof dailyData === 'object' && !Array.isArray(dailyData)) {
        console.log('- Keys:', Object.keys(dailyData));
      }
      
      // Try to find readings
      let readings = [];
      if (Array.isArray(dailyData)) {
        readings = dailyData;
      } else if (dailyData.meter_reading) {
        if (Array.isArray(dailyData.meter_reading)) {
          readings = dailyData.meter_reading;
        } else {
          console.log('- meter_reading type:', typeof dailyData.meter_reading);
          console.log('- meter_reading keys:', Object.keys(dailyData.meter_reading || {}));
        }
      }
      
      console.log(`\nFound ${readings.length} readings`);
      if (readings.length > 0) {
        console.log('\nFirst reading sample:');
        console.log(JSON.stringify(readings[0], null, 2));
        console.log('\nLast reading sample:');
        console.log(JSON.stringify(readings[readings.length - 1], null, 2));
        
        // Check for today's date
        const today = format(startOfToday, 'yyyy-MM-dd');
        console.log(`\nLooking for today's date: ${today}`);
        const todayReading = readings.find(r => {
          const date = r.date || r.Date || r.start || r.Start;
          return date === today || date?.startsWith(today);
        });
        if (todayReading) {
          console.log('Found today\'s reading:');
          console.log(JSON.stringify(todayReading, null, 2));
        } else {
          console.log('No reading found for today');
          console.log('Available dates:');
          readings.slice(0, 5).forEach((r, i) => {
            const date = r.date || r.Date || r.start || r.Start;
            console.log(`  ${i + 1}. ${date}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('Error fetching or displaying electricity data:', error);
    console.error('Stack:', error.stack);
  }
}

fetchAndDisplayElectricity();

