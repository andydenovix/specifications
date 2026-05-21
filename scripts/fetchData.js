import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// 1. Specify your exact tab names here
const tabsToFetch = ['Spectrophotometers / Fluorometers', 'Cell Counters', 'Squid Pipette']; 

const spreadsheetId = '1itRN0ghY_ipkYwCnrHhhbMpYy1-no8DQUJYD0Xrj2pM';

async function main() {
  let authConfig;
  const keyPath = path.join(process.cwd(), 'google-credentials.json');

  // Multi-environment routing check: If local file is missing, pull credentials from Netlify environment variables
  if (fs.existsSync(keyPath)) {
    console.log('📂 Found local google-credentials.json file.');
    authConfig = {
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    };
  } else if (process.env.GOOGLE_CREDENTIALS_JSON) {
    console.log('☁️ Local file missing. Parsing credentials from environment variables...');
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    authConfig = {
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    };
  } else {
    throw new Error('❌ Missing authorization credentials! Neither google-credentials.json nor GOOGLE_CREDENTIALS_JSON variable was found.');
  }
  
  const auth = new google.auth.GoogleAuth(authConfig);
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

  const assetsDir = path.join(process.cwd(), 'src', 'assets');
  if (!fs.existsSync(assetsDir)){
      fs.mkdirSync(assetsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(assetsDir, 'specData.json'),
    JSON.stringify(masterData, null, 2)
  );

  console.log('🎉 Success! Latest data saved to src/assets/specData.json');
}

main().catch((err) => {
  console.error('❌ Error executing data pipeline:', err);
  process.exit(1); // Force Netlify to fail visibly if data pipeline experiences fetching issues
});