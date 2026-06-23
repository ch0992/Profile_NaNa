import fs from 'fs';
import path from 'path';
import { getStore } from '@netlify/blobs';

async function runRestore() {
  try {
    console.log("=== Netlify Blobs Restore Starting ===");

    // 1. 복구 대상 백업 파일 경로 결정
    let backupFile = process.argv[2];
    if (!backupFile) {
      backupFile = path.join(process.cwd(), 'backups', 'profiles_backup_latest.json');
      console.log(`No backup file specified. Defaulting to latest backup: ${backupFile}`);
    } else {
      backupFile = path.resolve(process.cwd(), backupFile);
      console.log(`Target backup file: ${backupFile}`);
    }

    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file does not exist at: ${backupFile}`);
    }

    // 2. 백업 데이터 로드
    const profiles = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    if (!Array.isArray(profiles)) {
      throw new Error("Invalid backup format. Expected an array of profiles.");
    }
    console.log(`Loaded ${profiles.length} profiles from backup.`);

    // 3. Blobs 스토어 연결
    const store = getStore({
      name: "profiles",
      siteID: process.env.NETLIFY_SITE_ID || "62ee6f2f-283d-4f8e-8606-62705a16eace",
      token: process.env.NETLIFY_API_TOKEN
    });

    const targetIds = new Set(profiles.map(p => p.id));

    // 4. 실서버의 잔여 불필요 키 정리 (Clean up)
    console.log("Listing current live database for cleanup...");
    const liveList = await store.list();
    console.log(`Live database has ${liveList.blobs.length} keys.`);

    let deleteCount = 0;
    for (const blob of liveList.blobs) {
      if (!targetIds.has(blob.key)) {
        console.log(`Deleting untracked blob key: ${blob.key}...`);
        await store.delete(blob.key);
        deleteCount++;
      }
    }
    console.log(`Cleaned up ${deleteCount} untracked keys.`);

    // 5. 백업 데이터 주입 (Restore)
    console.log("Injecting backup profiles into database...");
    let restoreCount = 0;
    for (const profile of profiles) {
      if (!profile.id) {
        console.warn(`Profile missing id field. Skipping: ${JSON.stringify(profile)}`);
        continue;
      }
      await store.setJSON(profile.id, profile);
      restoreCount++;
    }

    console.log(`Successfully restored ${restoreCount} profiles to database.`);
    console.log("=== Restore Completed Successfully ===");

  } catch (err) {
    console.error("Restore failed with error:", err);
    process.exit(1);
  }
}

runRestore();
