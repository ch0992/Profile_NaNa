import fs from "fs";
import path from "path";
import { getStore } from "@netlify/blobs";

// 로컬 테스트용 모의 데이터베이스 파일 경로
const LOCAL_DB_PATH = path.join(process.cwd(), "nana_profiles.json");

// 로컬 JSON 파일 기반 Mock Store 구현
const getLocalStore = () => {
  return {
    get: async (key) => {
      if (!fs.existsSync(LOCAL_DB_PATH)) return null;
      try {
        const data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
        return data[key] || null;
      } catch (e) {
        return null;
      }
    },
    setJSON: async (key, val) => {
      let data = {};
      if (fs.existsSync(LOCAL_DB_PATH)) {
        try {
          data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
        } catch (e) {
          data = {};
        }
      }
      data[key] = val;
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf8");
    },
    list: async () => {
      if (!fs.existsSync(LOCAL_DB_PATH)) return { blobs: [] };
      try {
        const data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
        return {
          blobs: Object.keys(data).map(key => ({ key }))
        };
      } catch (e) {
        return { blobs: [] };
      }
    },
    delete: async (key) => {
      if (!fs.existsSync(LOCAL_DB_PATH)) return;
      try {
        const data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
        delete data[key];
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf8");
      } catch (e) {}
    }
  };
};

// 관리자 로그인 정보 고정 (환경변수 오염 방지)
const DEFAULT_ADMIN_EMAIL = "admin";
const DEFAULT_ADMIN_PASSWORD = "1111";

// store.get 결과를 안전하게 JSON으로 파싱하는 헬퍼
const getProfileJSON = async (store, key) => {
  try {
    const item = await store.get(key);
    if (!item) return null;
    if (typeof item === "string") {
      return JSON.parse(item);
    }
    return item;
  } catch (e) {
    return null;
  }
};

export const handler = async (event, context) => {
  // CORS 및 헤더 설정
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Profile-Password",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };

  // Preflight 대응
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // 로컬 호스트 도메인 판별 (localhost, 127.0.0.1, ::1 등)을 통한 100% 확실한 로컬/프로덕션 분기
  const host = event.headers.host || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1");
  
  const pathSegments = event.path.split("/");
  const lastSegment = pathSegments[pathSegments.length - 1];
  const method = event.httpMethod;

  try {
    let store;
    if (isLocal) {
      store = getLocalStore();
    } else {
      try {
        store = getStore({
          name: "profiles",
          siteID: process.env.NETLIFY_SITE_ID || process.env.SITE_ID,
          token: process.env.NETLIFY_API_TOKEN
        });
      } catch (e) {
        throw new Error("Netlify Blobs initialization failed: " + e.message);
      }
    }

    // 1. 관리자 로그인 API
    if (lastSegment === "admin-login" && method === "POST") {
      const { email, password } = JSON.parse(event.body);
      if (email === DEFAULT_ADMIN_EMAIL && password === DEFAULT_ADMIN_PASSWORD) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            token: DEFAULT_ADMIN_PASSWORD,
            adminPermissions: { canDelete: true, canPromote: true }
          })
        };
      }
      return { statusCode: 401, headers, body: JSON.stringify({ error: "이메일 또는 비밀번호가 잘못되었습니다." }) };
    }

    // 2. 관리자 권한 검증 헬퍼
    const isAdmin = () => {
      const authHeader = event.headers.authorization || "";
      const token = authHeader.replace("Bearer ", "").trim();
      return token === DEFAULT_ADMIN_PASSWORD;
    };

    // 3. 프로필 GET (목록 조회)
    if (method === "GET") {
      const list = await store.list();
      const profiles = [];
      for (const blob of list.blobs) {
        const item = await getProfileJSON(store, blob.key);
        if (item) {
          profiles.push(item);
        }
      }
      // 정렬 규칙: 방장 > 부방장(닉네임 ㄱㄴㄷ순) > 일반(최신 등록순)
      const getRolePriority = (role) => {
        if (role === '방장') return 1;
        if (role === '부방장') return 2;
        return 3;
      };

      profiles.sort((a, b) => {
        const priorityA = getRolePriority(a.role);
        const priorityB = getRolePriority(b.role);
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        if (a.role === '부방장') {
          const nameA = a.nickname || "";
          const nameB = b.nickname || "";
          return nameA.localeCompare(nameB, 'ko');
        }
        
        const dateA = a.createdAt ? new Date(a.createdAt) : 0;
        const dateB = b.createdAt ? new Date(b.createdAt) : 0;
        return dateB - dateA;
      });
      return { statusCode: 200, headers, body: JSON.stringify(profiles) };
    }

    // 4. 프로필 POST (등록/수정)
    if (method === "POST") {
      const data = JSON.parse(event.body);
      const isEdit = !!data.id;
      
      if (isEdit) {
        // 수정 시: 권한 체크
        const existing = await getProfileJSON(store, data.id);
        if (!existing) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: "존재하지 않는 프로필입니다." }) };
        }

        // 일반 수정은 비밀번호 검증 필요, 관리자 수정은 통과
        const isAuthorized = isAdmin() || (data.inputPassword === existing.password);
        if (!isAuthorized) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: "비밀번호가 일치하지 않습니다." }) };
        }

        // 기존 프로필 데이터와 요청받은 데이터를 안전하게 병합 (데이터 유실 방지)
        const updated = {
          ...existing,
          ...data
        };

        // 수정 시 중요 권한 필드(decoAllowed, decoPurchased, role)는 관리자가 아닐 경우 기존 값을 유지하도록 덮어쓰기 방지
        if (!isAdmin()) {
          updated.decoAllowed = existing.decoAllowed;
          updated.decoPurchased = existing.decoPurchased;
          updated.role = existing.role || '일반';
        } else {
          // 관리자일 경우, 명시적으로 payload에 포함된 값만 갱신하며, payload에 없으면 기존 값 유지
          if (data.decoAllowed !== undefined) updated.decoAllowed = data.decoAllowed;
          if (data.decoPurchased !== undefined) updated.decoPurchased = data.decoPurchased;
          if (data.role !== undefined) updated.role = data.role;
        }

        // 임시 필드 제거
        delete updated.inputPassword;

        updated.updatedAt = new Date().toISOString();
        await store.setJSON(updated.id, updated);
        return { statusCode: 200, headers, body: JSON.stringify(updated) };
      } else {
        // 등록 시
        const id = "p_" + Date.now().toString() + "_" + Math.random().toString(36).substr(2, 5);
        data.id = id;
        data.decoAllowed = true;
        data.decoPurchased = false;
        data.role = '일반';
        data.createdAt = new Date().toISOString();
        data.updatedAt = new Date().toISOString();
        
        await store.setJSON(id, data);
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }
    }

    // 5. 프로필 DELETE (삭제)
    if (method === "DELETE") {
      const id = event.queryStringParameters.id;
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "ID가 필요합니다." }) };
      }

      const existing = await getProfileJSON(store, id);
      if (!existing) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "존재하지 않는 프로필입니다." }) };
      }

      // 비밀번호 검증 (관리자이거나 비밀번호가 맞을 경우)
      const clientPassword = event.headers["x-profile-password"] || event.queryStringParameters.password;
      const isAuthorized = isAdmin() || (clientPassword === existing.password);
      if (!isAuthorized) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "비밀번호가 일치하지 않습니다." }) };
      }

      await store.delete(id);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "지원하지 않는 메소드입니다." }) };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "서버 내부 오류가 발생했습니다.", details: err.message })
    };
  }
};
