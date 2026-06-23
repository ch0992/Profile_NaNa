window.profileApp = function() {
    return {
        profiles: [], search: '', filterType: 'all', isLoading: false,
        isDark: true,
        galleryIndex: 0,
        writeTab: 'basic',
        formData: {
            nickname: '', mbti: '', birth: '', height: '', bloodType: '', location: '', gender: 'male', marriageStatus: '미혼', role: '일반',
            intro: '', drinkSmoke: '', longDistance: '', idealType: '', prosCons: '',
            image: '', password: '', tags: [], images: [], decoAllowed: false,
            userId: '',
            deco: {
                font: 'Pretendard', boxOpacity: 50, boxBlur: 16,
                bgImage: '', bgType: 'image', bgmUrl: '', effect: 'none',
                customEffectUrl: '', customEffectType: 'falling', customEffectSpeed: 5,
                bgOpacity: 50, nameColor: '', bubbleColor: '', drinkColor: '', distanceColor: '', idealColor: '', prosConsColor: ''
            }
        },
        presetColors: ['#ffffff', '#000000', '#3b82f6', '#ec4899', '#eab308', '#22c55e', '#a855f7', '#f97316'],
        tempColor: '#ffffff', targetColorKey: '',
        tagInput: '', selectedProfile: null, zoomImageSrc: '',
        isEditMode: false, changePasswordMode: false, inputPassword: '',
        adminEmail: '', adminPassword: '', adminSearch: '', isAdminLoggedIn: false,
        adminPermissions: { canDelete: false, canPromote: false },
        adminDeleteTargetId: null,
        currentRoom: '18411807017845862', // 나나방 프로필용 고정 방 코드
        currentRoomName: '나나방 프로필',
        pendingAction: null,
        toast: { show: false, message: '', type: 'success' },
        toastTimeout: null,
        isUploading: false,
        uploadProgress: 0,

        init() {
            AOS.init({ once: true, duration: 350, offset: 30, easing: 'ease-out' });
            
            // 토큰 복구 시 자동 로그인 상태로 유지 (페이지 리프레시 대응)
            const token = localStorage.getItem('adminToken');
            if (token) {
                this.isAdminLoggedIn = true;
                this.adminPermissions = { canDelete: true, canPromote: true };
            }

            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'light') {
                this.isDark = false;
                document.documentElement.classList.remove('dark');
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                this.isDark = true;
                document.documentElement.classList.add('dark');
                document.documentElement.setAttribute('data-theme', 'dark');
            }

            this.loadProfiles();

            const params = new URLSearchParams(window.location.search);
            const profileId = params.get('profile');
            if (profileId) {
                this.pendingProfileId = profileId;
            }
        },

        toggleTheme() {
            this.isDark = !this.isDark;
            localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
            if (this.isDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.setAttribute('data-theme', 'light');
            }
        },

        applySafeColor(color) {
            if (!color) return null;
            const c = color.toLowerCase();
            if (!this.isDark && (c === '#ffffff' || c === '#e2e8f0' || c === '#cbd5e1')) return null;
            if (this.isDark && (c === '#000000')) return null;
            return c;
        },

        async resizeAndCompressImage(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement("canvas");
                        const MAX_WIDTH = 800;
                        const MAX_HEIGHT = 800;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0, width, height);

                        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
                        resolve(dataUrl);
                    };
                    img.onerror = reject;
                    img.src = event.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        },

        async uploadFile(event, fieldPath) {
            const file = event.target.files[0];
            if (!file) return;
            
            this.isUploading = true;
            this.uploadProgress = 0;

            try {
                if (file.type.startsWith("image/")) {
                    const compressedBase64 = await this.resizeAndCompressImage(file);
                    this.uploadProgress = 100;
                    
                    if (fieldPath === 'image') this.formData.image = compressedBase64;
                    else if (fieldPath === 'deco.bgImage') this.formData.deco.bgImage = compressedBase64;
                    else if (fieldPath === 'deco.customEffectUrl') this.formData.deco.customEffectUrl = compressedBase64;
                    
                    this.showToast('파일 업로드 완료!');
                } else {
                    if (file.size > 4 * 1024 * 1024) {
                        this.showToast('미디어 파일은 4MB를 초과할 수 없습니다.', 'error');
                        event.target.value = '';
                        this.isUploading = false;
                        return;
                    }
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    this.uploadProgress = 100;
                    if (fieldPath === 'deco.bgImage') this.formData.deco.bgImage = base64;
                    else if (fieldPath === 'deco.bgmUrl') this.formData.deco.bgmUrl = base64;
                    
                    this.showToast('파일 업로드 완료!');
                }
            } catch (err) {
                console.error(err);
                this.showToast('업로드 실패: ' + err.message, 'error');
            } finally {
                this.isUploading = false;
                event.target.value = '';
            }
        },

        get isSuperman() { return this.adminPermissions.canDelete && this.adminPermissions.canPromote; },

        openAdminFromRoomModal() { this.adminEmail = ''; this.adminPassword = ''; document.getElementById('admin_auth_modal').showModal(); },
        closeAdminAuth() { document.getElementById('admin_auth_modal').close(); },

        loadProfiles() {
            this.isLoading = true;
            fetch('/.netlify/functions/profiles')
                .then(res => res.json())
                .then(data => {
                    this.profiles = data.filter(p => p.roomCode === this.currentRoom);
                    this.isLoading = false;
                    if (this.pendingProfileId) {
                        const target = this.profiles.find(p => p.id === this.pendingProfileId);
                        if (target) {
                            this.pendingProfileId = null;
                            this.openDetailModal(target);
                        }
                    }
                })
                .catch(err => {
                    console.error("프로필 데이터 로드 오류:", err);
                    this.isLoading = false;
                });
        },

        adminLogin() {
            if(!this.adminEmail || !this.adminPassword) { this.showToast('입력해주세요', 'error'); return; }
            
            fetch('/.netlify/functions/profiles/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.adminEmail, password: this.adminPassword })
            })
            .then(async res => {
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || '로그인 실패');
                return result;
            })
            .then(data => {
                this.adminPermissions = data.adminPermissions;
                this.isAdminLoggedIn = true;
                localStorage.setItem('adminToken', data.token);
                document.getElementById('admin_auth_modal').close();
                document.getElementById('admin_modal').showModal();
            })
            .catch(err => {
                this.showToast(err.message, 'error');
            });
        },

        get filteredProfiles() { 
            return this.profiles.filter(p => { 
                const searchText = (p.nickname + p.mbti + (p.location || '') + (p.tags ? p.tags.join('') : '')).toLowerCase(); 
                return searchText.includes(this.search.toLowerCase()) && (this.filterType === 'all' || p.gender === this.filterType); 
            }); 
        },
        
        get filteredAdminProfiles() { 
            if (!this.adminSearch) return this.profiles; 
            return this.profiles.filter(p => p.nickname.toLowerCase().includes(this.adminSearch.toLowerCase())); 
        },

        openAdminAuth() { 
            if(this.isAdminLoggedIn) { 
                document.getElementById('admin_modal').showModal(); 
            } else { 
                this.adminEmail = ''; this.adminPassword = ''; 
                document.getElementById('admin_auth_modal').showModal(); 
            } 
        },
        
        adminLogout() {
            this.isAdminLoggedIn = false; 
            this.adminPermissions = { canDelete: false, canPromote: false }; 
            this.adminEmail = ''; 
            this.adminSearch = ''; 
            localStorage.removeItem('adminToken');
            document.getElementById('admin_modal').close(); 
            this.showToast('로그아웃 되었습니다.');
        },

        changeUserRole(profile, newRole) { 
            if(!this.adminPermissions.canPromote) { this.showToast('권한이 없습니다.', 'error'); return; } 
            
            const payload = {
                id: profile.id,
                role: newRole,
                decoAllowed: (newRole === '방장' || newRole === '부방장' || !!profile.decoPurchased)
            };

            fetch('/.netlify/functions/profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify(payload)
            })
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || '실패');
                }
                this.showToast(`역할이 '${newRole}'(으)로 변경되었습니다.`);
                this.loadProfiles();
            })
            .catch(err => this.showToast(err.message, 'error'));
        },
        
        toggleDecoPurchased(profile) {
            if(!this.isSuperman) { this.showToast('슈퍼 관리자만 사용할 수 있습니다.', 'error'); return; }
            const newVal = !profile.decoPurchased;
            const payload = { id: profile.id, decoPurchased: newVal };
            if (newVal) payload.decoAllowed = true;
            
            fetch('/.netlify/functions/profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify(payload)
            })
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || '실패');
                }
                this.showToast(newVal ? '구매자 등록됨 ⭐' : '구매자 해제됨');
                this.loadProfiles();
            })
            .catch(err => this.showToast(err.message, 'error'));
        },
        
        applyRoleDecoUpdate(profile, promote) {
            if(!this.isSuperman) { this.showToast('슈퍼 관리자만 사용할 수 있습니다.', 'error'); return; }
            const newAllowed = promote ? true : !!profile.decoPurchased;
            
            fetch('/.netlify/functions/profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ id: profile.id, decoAllowed: newAllowed })
            })
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || '실패');
                }
                this.showToast(promote ? '역할 연동 완료 ✅' : `역할 해제 (${profile.decoPurchased ? '구매자 유지' : '꾸미기 비활성화'})`);
                this.loadProfiles();
            })
            .catch(err => this.showToast(err.message, 'error'));
        },
        
        get filteredAdminPurchasedProfiles() {
            if (!this.adminSearch) return this.profiles;
            return this.profiles.filter(p => p.nickname.toLowerCase().includes(this.adminSearch.toLowerCase()));
        },
        
        forceDelete(id) { 
            if(!this.adminPermissions.canDelete) { this.showToast('권한이 없습니다.', 'error'); return; } 
            this.adminDeleteTargetId = id; 
            document.getElementById('admin_delete_modal').showModal(); 
        },
        
        confirmForceDelete() { 
            if (this.adminDeleteTargetId) { 
                fetch(`/.netlify/functions/profiles?id=${this.adminDeleteTargetId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                    }
                })
                .then(async res => {
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || '삭제 실패');
                    }
                    this.showToast('삭제되었습니다.'); 
                    this.adminDeleteTargetId = null; 
                    document.getElementById('admin_delete_modal').close(); 
                    this.loadProfiles();
                })
                .catch(err => this.showToast(err.message, 'error'));
            } 
        },

        resetUserPassword(profile) {
            if(!this.adminPermissions.canDelete) { this.showToast('권한이 없습니다.', 'error'); return; }
            if(!confirm(`정말 "${profile.nickname}" 유저의 비밀번호를 1111로 초기화하시겠습니까?`)) return;

            const updatedPayload = {
                ...profile,
                password: "1111"
            };

            fetch('/.netlify/functions/profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken') || '1111'}`
                },
                body: JSON.stringify(updatedPayload)
            })
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || '초기화 실패');
                }
                this.showToast('비밀번호가 1111로 초기화되었습니다.', 'success');
                this.loadProfiles();
            })
            .catch(err => this.showToast(err.message, 'error'));
        },

        updateTags() { 
            if(this.tagInput) {
                this.formData.tags = this.tagInput.split(/[\s,]+/).filter(t => t.length > 0 && t !== '#').map(t => t.replace('#', '')); 
            } else {
                this.formData.tags = []; 
            }
        },
        
        openColorPicker(key) { this.targetColorKey = key; this.tempColor = this.formData.deco[key] || ''; document.getElementById('color_modal').showModal(); },
        applyColor() { if(this.targetColorKey) this.formData.deco[this.targetColorKey] = this.tempColor; document.getElementById('color_modal').close(); },

        inferBgTypeFromUrl() {
            if (!this.formData.deco) this.formData.deco = {};
            const url = (this.formData.deco.bgImage || '').toLowerCase();
            if (!url) { this.formData.deco.bgType = 'image'; return; }
            if (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov') || url.includes('data:video/mp4')) this.formData.deco.bgType = 'video';
            else this.formData.deco.bgType = 'image';
        },

        getLocationBadgeClass(loc) {
            if (!loc) return 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-none';
            
            const usaLocs = ['미서', '미중', '미동'];
            const krLocs = ['서울', '경기', '인천', '전북', '충북', '대구', '부산', '광주', '대전', '울산', '세종', '강원', '충남', '전남', '경북', '경남', '제주'];
            
            if (usaLocs.includes(loc) || usaLocs.some(u => loc.includes(u))) {
                return 'bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-500 text-white border-none font-extrabold shadow-[0_3px_10px_rgba(56,189,248,0.35)]';
            } else if (krLocs.includes(loc) || krLocs.some(k => loc.includes(k))) {
                return 'bg-gradient-to-r from-pink-400 via-rose-400 to-red-400 text-white border-none font-extrabold shadow-[0_3px_10px_rgba(244,63,94,0.35)]';
            } else {
                return 'bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-500 text-white border-none font-extrabold shadow-[0_3px_10px_rgba(168,85,247,0.35)]';
            }
        },

        openWriteModal() {
            this.isEditMode = false; this.changePasswordMode = false;
            this.writeTab = 'basic';
            this.formData = { nickname: '', mbti: '', birth: '', height: '', bloodType: '', location: '', gender: 'male', marriageStatus: '미혼', role: '일반', intro: '', drinkSmoke: '', longDistance: '', idealType: '', prosCons: '', image: '', password: '', tags: [], images: [], decoAllowed: false, userId: '', deco: { font: 'Pretendard', boxOpacity: 50, boxBlur: 16, bgImage: '', bgType: 'image', bgmUrl: '', effect: 'none', customEffectUrl: '', customEffectType: 'falling', customEffectSpeed: 5, bgOpacity: 50, nameColor: '', bubbleColor: '', drinkColor: '', distanceColor: '', idealColor: '', prosConsColor: '' } };
            this.tagInput = ''; document.getElementById('write_modal').showModal();
        },

        openDetailModal(profile) {
            this.galleryIndex = 0;
            this.selectedProfile = profile;
            
            const youtubePlayer = document.getElementById('bgm-player-youtube');
            const audioPlayer = document.getElementById('bgm-player-audio');
            if (youtubePlayer) youtubePlayer.src = '';
            if (audioPlayer) { audioPlayer.pause(); audioPlayer.src = ''; }

            if (profile.deco && profile.deco.bgmUrl) {
                let videoId = this.getYoutubeId(profile.deco.bgmUrl);
                
                if (videoId && !profile.deco.bgmUrl.startsWith('data:audio')) {
                    if (youtubePlayer) {
                        youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1`;
                    }
                } else {
                    if (audioPlayer) {
                        audioPlayer.src = profile.deco.bgmUrl;
                        audioPlayer.play().catch(e => console.log("Audio autoplay was blocked by the browser:", e));
                    }
                }
            }

            setTimeout(() => { document.getElementById('detail_modal').showModal(); if (profile.deco && profile.deco.effect) { this.renderEffects(profile.deco.effect, profile.deco); } }, 50);
        },

        closeDetailModal() {
            document.getElementById('detail_modal').close();
            setTimeout(() => {
                const youtubePlayer = document.getElementById('bgm-player-youtube');
                const audioPlayer = document.getElementById('bgm-player-audio');
                if (youtubePlayer) youtubePlayer.src = '';
                if (audioPlayer) { audioPlayer.pause(); audioPlayer.src = ''; }
                const container = document.getElementById('particle-container'); if(container) container.innerHTML = '';
                this.selectedProfile = null;
            }, 300);
        },

        renderEffects(type, decoData) {
            const container = document.getElementById('particle-container');
            if(!container || type === 'none') { if(container) container.innerHTML = ''; return; }
            container.innerHTML = ''; 
            
            let count = 25;
            if (type === 'snow') count = 50; 
            else if (type === 'rain') count = 80; 
            else if (type === 'sakura') count = 30; 
            else if (type === 'fireflies') count = 15;
            else if (type === 'bubbles') count = 25;
            else if (type === 'stars') count = 40;
            else if (type === 'confetti') count = 60;

            for (let i = 0; i < count; i++) {
                const el = document.createElement('div'); el.classList.add('particle');
                const randPos = Math.random() * 100; const scale = Math.random() * 0.5 + 0.5; const delay = Math.random() * 5; const duration = Math.random() * 5 + 5;
                el.style.left = `${randPos}%`; el.style.animationDelay = `-${delay}s`; el.style.transform = `scale(${scale})`;
                
                if (type === 'snow') { el.classList.add('particle-snow'); el.style.width = el.style.height = `${Math.random() * 5 + 3}px`; el.style.animationDuration = `${duration}s`; } 
                else if (type === 'rain') { el.classList.add('particle-rain'); el.style.animationDuration = `${Math.random() * 0.3 + 0.5}s`; el.style.opacity = Math.random() * 0.5 + 0.3; }
                else if (type === 'sakura') { el.classList.add('particle-sakura'); el.style.animationDuration = `${duration + 2}s`; }
                else if (type === 'fireflies') { el.classList.add('particle-firefly'); el.style.top = `${Math.random() * 100}%`; el.style.setProperty('--move-x', `${Math.random() * 100 - 50}px`); el.style.setProperty('--move-y', `${Math.random() * 100 - 50}px`); el.style.animationDuration = `${Math.random() * 10 + 10}s`; }
                else if (type === 'bubbles') { 
                    el.classList.add('particle-bubble'); el.style.width = el.style.height = `${Math.random() * 15 + 10}px`; el.style.animationDuration = `${duration + 5}s`; 
                }
                else if (type === 'stars') { 
                    el.classList.add('particle-star'); el.style.width = el.style.height = `${Math.random() * 8 + 4}px`; el.style.animationDuration = `${duration}s`; el.style.boxShadow = `0 0 ${Math.random()*10+5}px white`; 
                }
                else if (type === 'confetti') { 
                    el.classList.add('particle-confetti'); el.style.width = `${Math.random() * 8 + 4}px`; el.style.height = `${Math.random() * 15 + 8}px`; 
                    const colors = ['#ff0a54', '#ff477e', '#ff7096', '#ff85a1', '#fbb1bd', '#f9bec7']; 
                    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; el.style.animationDuration = `${duration}s`; 
                }
                else if (type === 'custom' && decoData.customEffectUrl) {
                    el.style.backgroundImage = `url('${decoData.customEffectUrl}')`; el.style.width = '40px'; el.style.height = '40px';
                    const speedVal = decoData.customEffectSpeed || 5; const baseSpeed = 11 - speedVal; el.style.animationDuration = `${Math.random() * 2 + baseSpeed}s`;
                    if (decoData.customEffectType === 'float') { el.classList.add('particle-custom-float'); el.style.top = `${Math.random() * 90}%`; } 
                    else if (decoData.customEffectType === 'rising') { el.classList.add('particle-custom-rising'); }
                    else if (decoData.customEffectType === 'side') { el.classList.add('particle-custom-side'); el.style.top = `${Math.random() * 90}%`; el.style.left = `-10%`; }
                    else if (decoData.customEffectType === 'pulse') { el.classList.add('particle-custom-pulse'); el.style.top = `${Math.random() * 90}%`; el.style.animationDuration = `${Math.random() * 1 + (baseSpeed/4)}s`; }
                    else if (decoData.customEffectType === 'spin') { el.classList.add('particle-custom-spin'); }
                    else if (decoData.customEffectType === 'wiggle') { el.classList.add('particle-custom-wiggle'); }
                    else { el.classList.add('particle-custom-falling'); }
                }
                container.appendChild(el);
            }
        },

        openZoomModal(src) { this.zoomImageSrc = src || this.getRandomAvatar(this.selectedProfile.nickname, this.selectedProfile.gender); document.getElementById('zoom_modal').showModal(); },
        
        openEditModal() {
            this.isEditMode = true; this.changePasswordMode = false;
            this.writeTab = 'basic';
            this.formData = JSON.parse(JSON.stringify(this.selectedProfile));
            if(!this.formData.deco) this.formData.deco = {};
            const defaults = { font: 'Pretendard', boxOpacity: 50, boxBlur: 16, bgImage: '', bgType: 'image', bgmUrl: '', effect: 'none', customEffectUrl: '', customEffectType: 'falling', customEffectSpeed: 5, bgOpacity: 50, nameColor: '', bubbleColor: '', drinkColor: '', distanceColor: '', idealColor: '', prosConsColor: '' };
            this.formData.deco = { ...defaults, ...this.formData.deco };
            if (!this.formData.images) this.formData.images = [];
            if (!this.formData.userId) this.formData.userId = '';
            this.galleryIndex = 0;
            this.tagInput = this.formData.tags ? this.formData.tags.join(' ') : '';
            this.closeDetailModal(); document.getElementById('write_modal').showModal();
        },

        submitProfile() {
            if (!this.formData.nickname || !this.formData.mbti || !this.formData.gender || !this.formData.marriageStatus || !this.formData.location) { 
                this.writeTab = 'basic';
                this.showToast('기본 정보(닉네임, MBTI, 성별, 혼인여부, 사는 곳)를 모두 입력해주세요!', 'error'); 
                return; 
            }
            if (!this.isEditMode && !this.formData.password) { 
                this.writeTab = 'security';
                this.showToast('비밀번호를 설정해주세요.', 'error'); 
                return; 
            }
            this.isUploading = true;
            this.inferBgTypeFromUrl();

            const data = { 
                ...this.formData, 
                birth: '',
                userId: '',
                roomCode: this.currentRoom,
                inputPassword: this.isEditMode ? this.formData.password : undefined
            };

            const url = '/.netlify/functions/profiles';
            const headers = {
                'Content-Type': 'application/json'
            };
            if (this.isAdminLoggedIn) {
                headers['Authorization'] = `Bearer ${localStorage.getItem('adminToken')}`;
            }

            fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            })
            .then(async res => {
                const result = await res.json();
                if (!res.ok) {
                    const msg = result.error + (result.details ? ` (${result.details})` : '');
                    throw new Error(msg || '저장 오류');
                }
                return result;
            })
            .then(() => {
                this.showToast(this.isEditMode ? '수정 완료!' : '등록 완료!');
                document.getElementById('write_modal').close();
                this.loadProfiles();
            })
            .catch(err => {
                this.showToast(err.message, 'error');
            })
            .finally(() => {
                this.isUploading = false;
            });
        },

        promptPassword(action) { this.pendingAction = action; this.inputPassword = ''; document.getElementById('password_modal').showModal(); },
        
        verifyPassword() {
            if (this.inputPassword === this.selectedProfile.password) {
                document.getElementById('password_modal').close();
                if (this.pendingAction === 'delete') this.deleteProfile();
                else if (this.pendingAction === 'edit') this.openEditModal();
            } else { this.showToast('비밀번호 불일치', 'error'); }
        },

        deleteProfile() {
            if (!this.selectedProfile) return;
            fetch(`/.netlify/functions/profiles?id=${this.selectedProfile.id}`, {
                method: 'DELETE',
                headers: {
                    'X-Profile-Password': this.inputPassword
                }
            })
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || '삭제 실패');
                }
                this.closeDetailModal();
                this.showToast('프로필이 삭제되었습니다.');
                this.loadProfiles();
            })
            .catch(err => this.showToast(err.message, 'error'));
        },

        getAge(birthStr) { if (!birthStr) return 0; const birth = new Date(birthStr); const today = new Date(); let age = today.getFullYear() - birth.getFullYear(); if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--; return age; },
        getBirthDate(birthStr) { if (!birthStr) return ''; const date = new Date(birthStr); return `${date.getMonth() + 1}.${date.getDate()}`; },
        getRandomAvatar(seed, gender) { let url = `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`; if (gender === 'female') { url += "&beardProbability=0&hair=variant12,variant16,variant22,variant26,variant29,variant36,variant39,variant43&glassesProbability=30"; } else { url += "&beardProbability=100&beard=variant02,variant03,variant05,variant06&glassesProbability=30"; } return url; },
        
        getContrastWarning(hexColor) {
            if (!hexColor || hexColor.length < 7) return null;
            try {
                const r = parseInt(hexColor.slice(1, 3), 16) / 255;
                const g = parseInt(hexColor.slice(3, 5), 16) / 255;
                const b = parseInt(hexColor.slice(5, 7), 16) / 255;
                const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                if (this.isDark && lum < 0.04) return '이 색은 다크 배경에서 보이지 않을 수 있어요';
                if (!this.isDark && lum > 0.88) return '이 색은 라이트 배경에서 보이지 않을 수 있어요';
            } catch(e) {}
            return null;
        },

        hasDetailedProfile(profile) {
            if (!profile) return false;
            const fields = [profile.drinkSmoke, profile.longDistance, profile.idealType, profile.prosCons, profile.intro];
            const filledCount = fields.filter(val => val && val.trim && val.trim().length > 0).length;
            return filledCount >= 3;
        },

        getProfileImages(profile) {
            if (!profile) return [this.getRandomAvatar('default', 'male')];
            const imgs = (profile.images && profile.images.length > 0) ? [...profile.images] : [];
            if (profile.image && !imgs.includes(profile.image)) imgs.unshift(profile.image);
            if (imgs.length === 0) imgs.push(this.getRandomAvatar(profile.nickname, profile.gender));
            return imgs;
        },

        nextGalleryImage() {
            const imgs = this.getProfileImages(this.selectedProfile);
            this.galleryIndex = (this.galleryIndex + 1) % imgs.length;
        },

        prevGalleryImage() {
            const imgs = this.getProfileImages(this.selectedProfile);
            this.galleryIndex = (this.galleryIndex - 1 + imgs.length) % imgs.length;
        },

        setMainImage(imgUrl) {
            this.formData.image = imgUrl;
        },

        removeGalleryImage(index) {
            const removed = this.formData.images[index];
            this.formData.images.splice(index, 1);
            if (this.formData.image === removed) {
                this.formData.image = this.formData.images[0] || '';
            }
        },

        async uploadGalleryImage(event) {
            const file = event.target.files[0];
            if (!file) return;
            const maxImages = this.formData.decoAllowed ? 5 : 3;
            if (this.formData.images.length >= maxImages) {
                this.showToast(`사진은 최대 ${maxImages}장까지 추가할 수 있어요.`, 'error');
                event.target.value = '';
                return;
            }
            this.isUploading = true;
            this.uploadProgress = 0;

            try {
                const compressedBase64 = await this.resizeAndCompressImage(file);
                this.uploadProgress = 100;
                this.formData.images.push(compressedBase64);
                if (!this.formData.image) this.formData.image = compressedBase64;
                this.showToast('사진이 추가되었어요!');
            } catch (err) {
                console.error(err);
                this.showToast('업로드 실패: ' + err.message, 'error');
            } finally {
                this.isUploading = false;
                event.target.value = '';
            }
        },

        showToast(msg, type = 'success') {
            this.toast.message = msg; this.toast.type = type; this.toast.show = true; 
            setTimeout(() => { const toastContainer = document.getElementById('global_toast_container'); if (toastContainer) { const openDialogs = document.querySelectorAll('dialog[open]'); if (openDialogs.length > 0) { openDialogs[openDialogs.length - 1].appendChild(toastContainer); } else { document.body.appendChild(toastContainer); } } }, 10);
            if (this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => { this.toast.show = false; }, 3000); 
        },
        getYoutubeId(url) { if (!url) return ''; let videoId = url.trim(); try { if (videoId.includes('youtube.com/watch')) { const u = new URL(videoId); const v = u.searchParams.get('v'); if (v) return v; } else if (videoId.includes('youtu.be/')) { const u = new URL(videoId); const path = u.pathname.replace('/', ''); if (path) return path; } } catch (e) {} return videoId; },

        isNewMember(dateStr) {
            if (!dateStr) return false;
            const created = new Date(dateStr);
            if (isNaN(created.getTime())) return false;
            const cutOffDate = new Date('2026-06-23T11:00:00Z');
            if (created < cutOffDate) return false;
            const now = new Date();
            const diffMs = now.getTime() - created.getTime();
            return diffMs >= -3600000 && diffMs < (3 * 24 * 60 * 60 * 1000);
        },

        formatDate(dateStr) {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '-';
            const yy = String(date.getFullYear()).slice(-2);
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yy}.${mm}.${dd}`;
        }
    }
}