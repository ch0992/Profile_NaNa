import fs from 'fs';

async function backup() {
  try {
    console.log("Fetching profiles from production...");
    const response = await fetch('https://profile-nana.netlify.app/.netlify/functions/profiles');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Successfully fetched ${data.length} profiles.`);
    
    const backupPath = './production_profiles_backup.json';
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Backup saved to ${backupPath}`);
  } catch (error) {
    console.error("Backup failed:", error);
    process.exit(1);
  }
}

backup();
