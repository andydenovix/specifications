import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// 1. Specify your exact tab names here
const tabsToFetch = ['Spectrophotometers / Fluorometers', 'Cell Counters', 'Squid Pipette']; 

const spreadsheetId = '1itRN0ghY_ipkYwCnrHhhbMpYy1-no8DQUJYD0Xrj2pM';

async function main() {
  // Path to your service account key
  const keyPath = path.join(process.cwd(), 'google-credentials.json');
  
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const masterData = {};

  console.log('🔄 Connecting to Google Sheets API...');

  for (const sheetName of tabsToFetch) {
    console.log(`📡 Fetching data for tab: "${sheetName}"...`);
    
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z200`, 
      });

      const rows = response.data.values || [];
      console.log(`✅ Successfully fetched ${rows.length} rows for "${sheetName}".`);
      masterData[sheetName] = rows;
    } catch (sheetError) {
      console.error(`❌ Failed to fetch tab "${sheetName}". Check if the name matches exactly or if permissions are missing.`);
      console.error(sheetError.message);
    }
  }

  // Ensure the assets directory exists
  const assetsDir = path.join(process.cwd(), 'src', 'assets');
  if (!fs.existsSync(assetsDir)){
      fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Save everything into a single clean JSON file inside your React app
  fs.writeFileSync(
    path.join(assetsDir, 'specData.json'),
    JSON.stringify(masterData, null, 2)
  );

  console.log('🎉 Success! Latest data saved to src/assets/specData.json');
}

main().catch((err) => {
  console.error('❌ Error executing data pipeline:', err);
});