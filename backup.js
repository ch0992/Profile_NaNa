import fs from 'fs';
import path from 'path';
import { getStore } from '@netlify/blobs';

const BACKUPS_DIR = path.join(process.cwd(), 'backups');

async function runBackup() {
  try {
    console.log("=== Netlify Blobs Backup Starting ===");

    // 1. backups 폴더 생성
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      console.log(`Created backups directory at: ${BACKUPS_DIR}`);
    }

    // 2. Blobs 스토어 연결
    const store = getStore({
      name: "profiles",
      siteID: process.env.NETLIFY_SITE_ID || "62ee6f2f-283d-4f8e-8606-62705a16eace",
      token: process.env.NETLIFY_API_TOKEN
    });

    console.log("Listing all blobs from server...");
    const list = await store.list();
    console.log(`Found ${list.blobs.length} keys in database.`);

    // 3. 각 blob 데이터 읽어오기
    const profiles = [];
    for (const blob of list.blobs) {
      const raw = await store.get(blob.key);
      if (raw) {
        try {
          const profile = JSON.parse(raw);
          profiles.push(profile);
        } catch (e) {
          console.warn(`Failed to parse blob data for key ${blob.key}, saving as raw string.`);
          profiles.push({ id: blob.key, rawData: raw });
        }
      }
    }

    console.log(`Successfully fetched ${profiles.length} profiles.`);

    // 4. 타임스탬프 계산 및 저장
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    const stampedFilename = `profiles_backup_${dateStr}_${timeStr}.json`;
    const stampedPath = path.join(BACKUPS_DIR, stampedFilename);
    const latestPath = path.join(BACKUPS_DIR, 'profiles_backup_latest.json');

    const jsonString = JSON.stringify(profiles, null, 2);

    // 파일 쓰기
    fs.writeFileSync(stampedPath, jsonString, 'utf8');
    fs.writeFileSync(latestPath, jsonString, 'utf8');

    console.log(`Backup saved to: ${stampedPath}`);
    console.log(`Latest link updated: ${latestPath}`);
    console.log("=== Backup Completed Successfully ===");

  } catch (err) {
    console.error("Backup failed with error:", err);
    process.exit(1);
  }
}

runBackup();
