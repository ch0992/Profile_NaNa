import fs from 'fs';

async function verify() {
  try {
    console.log("Fetching profiles from production after deploy...");
    const response = await fetch('https://profile-nana.netlify.app/.netlify/functions/profiles');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Current production profiles count: ${data.length}`);
    
    // 백업본 읽기
    const backupPath = './production_profiles_backup.json';
    if (!fs.existsSync(backupPath)) {
      console.error("Backup file not found!");
      process.exit(1);
    }
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`Backup profiles count: ${backupData.length}`);
    
    if (data.length === backupData.length) {
      console.log("SUCCESS: Data count matches perfectly!");
      
      // 이름 기준으로 매칭 검사
      const currentNames = data.map(p => p.nickname).sort();
      const backupNames = backupData.map(p => p.nickname).sort();
      
      let allMatch = true;
      for(let i=0; i<currentNames.length; i++) {
        if(currentNames[i] !== backupNames[i]) {
          allMatch = false;
          console.warn(`Mismatch at index ${i}: Current [${currentNames[i]}] vs Backup [${backupNames[i]}]`);
        }
      }
      
      if (allMatch) {
        console.log("SUCCESS: All profile nicknames match exactly!");
      } else {
        console.error("WARNING: Profile names do not match perfectly.");
      }
    } else {
      console.error("FAIL: Data count mismatch! Production has lost data or changed.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Verification failed:", error);
    process.exit(1);
  }
}

verify();
