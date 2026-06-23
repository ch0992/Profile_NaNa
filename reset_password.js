async function resetPassword() {
  try {
    console.log("Fetching profiles from production...");
    const getRes = await fetch('https://profile-nana.netlify.app/.netlify/functions/profiles');
    if (!getRes.ok) {
      throw new Error(`Failed to fetch profiles: ${getRes.status}`);
    }
    const profiles = await getRes.json();
    
    // 닉네임이 '해이'인 프로필 탐색
    const target = profiles.find(p => p.nickname === '해이');
    if (!target) {
      console.error("해이 프로필을 찾을 수 없습니다.");
      process.exit(1);
    }
    
    console.log(`Found profile: ${target.nickname} (ID: ${target.id}), current password: ${target.password}`);
    
    // 비밀번호를 1111로 변경
    const updatedPayload = {
      ...target,
      password: "1111"
    };
    
    console.log("Sending update request with admin auth...");
    const postRes = await fetch('https://profile-nana.netlify.app/.netlify/functions/profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 1111' // 관리자 권한
      },
      body: JSON.stringify(updatedPayload)
    });
    
    if (!postRes.ok) {
      const errorText = await postRes.text();
      throw new Error(`Failed to update profile: ${postRes.status} - ${errorText}`);
    }
    
    const result = await postRes.json();
    console.log("SUCCESS: Password reset complete!");
    console.log(`Updated profile password: ${result.password}`);
  } catch (error) {
    console.error("Error resetting password:", error);
    process.exit(1);
  }
}

resetPassword();
