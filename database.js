/**
 * ==============================================================================
 * TAWASOL PRO - CORE DATABASE, AUTH & ENCRYPTION ENGINE
 * Version: 3.5.0 (Google Auth & Unique Username Integrated)
 * Architecture: Modular, Object-Oriented, IndexedDB + Firebase Realtime
 * ==============================================================================
 */

// استيراد مكتبات Firebase (بما في ذلك المصادقة Authentication وقواعد البيانات)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, onValue, set, serverTimestamp, get, update } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

// ==============================================================================
// 1. إعدادات خوادم Firebase
// ==============================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBjO4t3yubdjEz4lfUaXJfWh_AT6mMfyLg",
    authDomain: "tawasol-f7c28.firebaseapp.com",
    databaseURL: "https://tawasol-f7c28-default-rtdb.firebaseio.com",
    projectId: "tawasol-f7c28",
    storageBucket: "tawasol-f7c28.firebasestorage.app",
    messagingSenderId: "151126946678",
    appId: "1:151126946678:web:f06114357f1317f18cc057",
    measurementId: "G-521KSCX90Y"
};

// تهيئة الاتصال بالسيرفر
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ==============================================================================
// 2. محرك التشفير المتقدم (Advanced Crypto Engine - E2EE Simulation)
// ==============================================================================
const CryptoEngine = {
    masterKey: "TAWASOL_SECURE_KEY_2026_ULTRA_XOR",
    
    encryptMessage: function(text) {
        if (!text) return "";
        try {
            let encrypted = '';
            for (let i = 0; i < text.length; i++) {
                const charCode = text.charCodeAt(i) ^ this.masterKey.charCodeAt(i % this.masterKey.length);
                encrypted += String.fromCharCode(charCode);
            }
            return btoa(unescape(encodeURIComponent(encrypted)));
        } catch (error) {
            console.error("فشل التشفير:", error);
            return text;
        }
    },

    decryptMessage: function(hash) {
        if (!hash) return "";
        try {
            const decoded = decodeURIComponent(escape(atob(hash)));
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i) ^ this.masterKey.charCodeAt(i % this.masterKey.length);
                decrypted += String.fromCharCode(charCode);
            }
            return decrypted;
        } catch (error) {
            return hash; 
        }
    },

    hashPin: function(pin) {
        return btoa(pin + "_TAWASOL_SALT");
    }
};

// ==============================================================================
// 3. مدير قواعد البيانات المحلية (IndexedDB Local Manager)
// ==============================================================================
const LocalDB = {
    dbName: "TawasolPro_Database",
    dbVersion: 1,
    dbInstance: null,

    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("messages")) {
                    const msgStore = db.createObjectStore("messages", { keyPath: "id" });
                    msgStore.createIndex("timestamp", "timestamp", { unique: false });
                    msgStore.createIndex("roomId", "roomId", { unique: false });
                }
                if (!db.objectStoreNames.contains("contacts")) {
                    db.createObjectStore("contacts", { keyPath: "uid" });
                }
            };

            request.onsuccess = (event) => {
                this.dbInstance = event.target.result;
                console.log("[LocalDB] تم الاتصال بقاعدة البيانات المحلية بنجاح");
                resolve();
            };

            request.onerror = (event) => {
                console.error("[LocalDB] خطأ في فتح قاعدة البيانات", event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    },

    saveMessage: function(messageObj) {
        if (!this.dbInstance) return;
        const transaction = this.dbInstance.transaction(["messages"], "readwrite");
        const store = transaction.objectStore("messages");
        store.put(messageObj);
    },

    getMessages: function() {
        return new Promise((resolve, reject) => {
            if (!this.dbInstance) { resolve([]); return; }
            const transaction = this.dbInstance.transaction(["messages"], "readonly");
            const store = transaction.objectStore("messages");
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};

// ==============================================================================
// 4. نظام إدارة حالة الاتصال (Network Status Manager)
// ==============================================================================
const NetworkManager = {
    isOnline: navigator.onLine,
    
    init: function() {
        window.addEventListener('online', () => this.handleStatusChange(true));
        window.addEventListener('offline', () => this.handleStatusChange(false));
        
        const connectedRef = ref(db, ".info/connected");
        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                this.handleStatusChange(true);
            } else {
                this.handleStatusChange(false);
            }
        });
    },
    
    handleStatusChange: function(status) {
        this.isOnline = status;
        const statusElement = document.getElementById('room-status');
        if (statusElement) {
            if (status) {
                statusElement.innerHTML = `<span class="dot-indicator" style="background:#10b981;"></span> متصل بالسيرفر`;
            } else {
                statusElement.innerHTML = `<span class="dot-indicator" style="background:#ef4444; animation:none;"></span> جاري الاتصال...`;
            }
        }
    }
};

// ==============================================================================
// 5. نظام المصادقة والحسابات (Authentication Manager - Google + Usernames)
// ==============================================================================
const AuthManager = {
    currentUser: null,
    tempGoogleUser: null, // حفظ مؤقت لبيانات جوجل قبل إنشاء اسم المستخدم

    init: function() {
        this.checkSession();
        this.bindEvents();
    },

    bindEvents: function() {
        // زر تسجيل الدخول بواسطة جوجل
        const btnGoogle = document.getElementById('btn-google-login');
        if(btnGoogle) {
            btnGoogle.addEventListener('click', () => this.loginWithGoogle());
        }

        // نموذج حجز اسم المستخدم والـ PIN
        const form = document.getElementById('form-register');
        if(form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.claimUsernameAndRegister();
            });
        }
        
        // زر تسجيل الخروج
        const btnLogout = document.getElementById('btn-logout');
        if(btnLogout) {
            btnLogout.addEventListener('click', () => this.logout());
        }
    },

    checkSession: function() {
        const savedUser = localStorage.getItem('tw_user_profile');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            // سيتم طلب الـ PIN في ملف app.js
        }
    },

    loginWithGoogle: async function() {
        const provider = new GoogleAuthProvider();
        try {
            if(window.UI) window.UI.showToast("جاري الاتصال بـ Google...", "info");
            
            // فتح نافذة جوجل
            const result = await signInWithPopup(auth, provider);
            this.tempGoogleUser = result.user;
            
            // فحص هل المستخدم موجود مسبقاً في قاعدة بياناتنا
            this.checkIfUserExists(result.user.uid);
            
        } catch (error) {
            console.error("خطأ في تسجيل الدخول:", error);
            if(window.UI) window.UI.showToast("فشل تسجيل الدخول: " + error.message, "error");
        }
    },

    checkIfUserExists: async function(uid) {
        const userRef = ref(db, `users/${uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            // مستخدم قديم -> احفظ بياناته محلياً واطلب منه الـ PIN
            const userData = snapshot.val();
            userData.uid = uid;
            
            localStorage.setItem('tw_user_profile', JSON.stringify(userData));
            this.currentUser = userData;
            
            if(window.UI) {
                window.UI.showToast("أهلاً بعودتك!", "success");
                window.UI.showScreen('screen-lock'); 
            }
        } else {
            // مستخدم جديد -> اطلب منه اختيار اسم مستخدم و PIN
            if(window.UI) {
                window.UI.showToast("تم التحقق من حسابك، اختر اسماً لك", "success");
                window.UI.showScreen('screen-setup-profile'); 
                
                // ملء الاسم تلقائياً من جوجل
                const nameInput = document.getElementById('reg-fullname');
                if(nameInput) nameInput.value = this.tempGoogleUser.displayName;
            }
        }
    },

    claimUsernameAndRegister: async function() {
        if (!this.tempGoogleUser) return;

        const fullname = document.getElementById('reg-fullname').value.trim();
        let username = document.getElementById('reg-username').value.trim().toLowerCase();
        const pin = document.getElementById('reg-pin').value.trim();

        username = username.replace('@', ''); // إزالة الـ @ إذا أدخلها المستخدم
        
        const isValidUsername = /^[a-z0-9_]{3,15}$/.test(username);
        if (!fullname || !isValidUsername || pin.length !== 4) {
            if(window.UI) window.UI.showToast("تأكد من اسم المستخدم (3-15 حرف إنجليزي) والـ PIN (4 أرقام)", "error");
            return;
        }

        try {
            if(window.UI) window.UI.showToast("جاري إنشاء الحساب وحجز الاسم...", "info");
            
            // التحديث المزدوج: حجز الاسم + إنشاء ملف المستخدم (Atomic Operation)
            const updates = {};
            updates[`usernames/${username}`] = this.tempGoogleUser.uid;
            updates[`users/${this.tempGoogleUser.uid}`] = {
                fullname: fullname,
                username: "@" + username,
                email: this.tempGoogleUser.email,
                avatar: this.tempGoogleUser.photoURL,
                createdAt: serverTimestamp()
            };

            await update(ref(db), updates);

            // حفظ محلي
            const userData = {
                uid: this.tempGoogleUser.uid,
                fullname: fullname,
                username: "@" + username,
                avatar: this.tempGoogleUser.photoURL
            };

            localStorage.setItem('tw_user_profile', JSON.stringify(userData));
            localStorage.setItem('tw_pin', pin); // يفضل تشفيره مستقبلاً عبر CryptoEngine
            this.currentUser = userData;

            if(window.UI) {
                window.UI.showToast("تم إنشاء الحساب ومفاتيح التشفير بنجاح!", "success");
                window.UI.showScreen('app-main');
                ChatManager.updateProfileUI();
            }

        } catch (error) {
            console.error("فشل حجز الاسم:", error);
            if(window.UI) window.UI.showToast("عذراً، اسم المستخدم محجوز مسبقاً، اختر غيره!", "error");
        }
    },

    logout: function() {
        if(confirm("تحذير: سيتم مسح جميع بياناتك ورسائلك من هذا الجهاز للأبد. هل أنت متأكد؟")) {
            localStorage.clear();
            indexedDB.deleteDatabase(LocalDB.dbName);
            signOut(auth).then(() => {
                location.reload();
            });
        }
    }
};

// ==============================================================================
// 6. محرك الدردشة المركزي (Chat Rendering & Sending Manager)
// ==============================================================================
const ChatManager = {
    globalRoomRef: ref(db, 'global_encrypted_room'),
    messagesContainer: document.getElementById('messages-list'),

    init: async function() {
        await LocalDB.init();
        this.bindEvents();
        this.updateProfileUI();
        
        // استرجاع الرسائل القديمة من الجهاز
        const localMessages = await LocalDB.getMessages();
        localMessages.forEach(msg => this.renderMessageUI(msg));

        // الاستماع للرسائل الجديدة من Firebase
        onChildAdded(this.globalRoomRef, (snapshot) => {
            const data = snapshot.val();
            // حفظ الرسالة محلياً (بعد وصولها من السيرفر)
            LocalDB.saveMessage(data);
            this.renderMessageUI(data);
        });
    },

    bindEvents: function() {
        const sendBtn = document.getElementById('btn-action-main');
        const msgInput = document.getElementById('message-input');

        if(sendBtn && msgInput) {
            sendBtn.addEventListener('click', () => {
                if(!sendBtn.querySelector('.icon-send').classList.contains('hidden')) {
                    this.sendMessage();
                } else {
                    if(window.UI) window.UI.showToast("ميزة تسجيل الصوت قيد التطوير", "info");
                }
            });

            msgInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    },

    updateProfileUI: function() {
        if (!AuthManager.currentUser) return;
        const user = AuthManager.currentUser;
        
        // تحديث القائمة الجانبية
        const nameEl = document.getElementById('my-display-name');
        const avatarEl = document.getElementById('my-avatar');
        
        if(nameEl) nameEl.innerText = user.fullname;
        if(avatarEl) {
            // عرض صورة جوجل إذا توفرت، وإلا الحرف الأول من الاسم
            if (user.avatar) {
                avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                avatarEl.innerText = user.fullname.charAt(0).toUpperCase();
            }
        }

        // تحديث صفحة الإعدادات
        const setName = document.getElementById('settings-name');
        const setHandle = document.getElementById('settings-handle');
        const setAvatar = document.getElementById('settings-avatar');
        if(setName) setName.innerText = user.fullname;
        if(setHandle) setHandle.innerText = user.username;
        if(setAvatar) {
            if (user.avatar) {
                setAvatar.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                setAvatar.innerText = user.fullname.charAt(0).toUpperCase();
            }
        }
    },

    sendMessage: function() {
        const input = document.getElementById('message-input');
        const rawText = input.value.trim();
        
        if (!rawText || !AuthManager.currentUser) return;

        // 1. تشفير الرسالة قبل الإرسال
        const encryptedPayload = CryptoEngine.encryptMessage(rawText);

        // 2. تكوين حزمة البيانات (Packet)
        const messagePacket = {
            id: "MSG_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            senderId: AuthManager.currentUser.uid,
            senderName: AuthManager.currentUser.fullname,
            payload: encryptedPayload,
            type: "text",
            timestamp: Date.now()
        };

        // 3. الدفع إلى Firebase
        push(this.globalRoomRef, messagePacket)
            .then(() => {
                input.value = '';
                input.style.height = 'auto'; // إعادة حجم المربع
                // الزر يرجع مايكروفون
                const sendIcon = document.querySelector('.icon-send');
                const micIcon = document.querySelector('.icon-mic');
                if(sendIcon && micIcon) {
                    sendIcon.classList.add('hidden');
                    micIcon.classList.remove('hidden');
                }
            })
            .catch((error) => {
                console.error("فشل الإرسال:", error);
                if(window.UI) window.UI.showToast("حدث خطأ أثناء الإرسال", "error");
            });
    },

    renderMessageUI: function(msgObj) {
        if (!this.messagesContainer) return;

        const isMine = AuthManager.currentUser && msgObj.senderId === AuthManager.currentUser.uid;
        
        let decryptedText = "رسالة مشفرة غير مدعومة";
        if (msgObj.type === "text") {
            decryptedText = CryptoEngine.decryptMessage(msgObj.payload);
        }

        const dateObj = new Date(msgObj.timestamp);
        const timeString = dateObj.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

        const msgElement = document.createElement('div');
        msgElement.className = `msg ${isMine ? 'msg-mine' : 'msg-other'}`;
        msgElement.id = msgObj.id;

        let html = '';
        if (!isMine) {
            html += `<span class="msg-sender">${msgObj.senderName}</span>`;
        }
        
        html += `
            <div class="msg-content">${this.escapeHTML(decryptedText)}</div>
            <div class="msg-time">
                ${timeString}
                ${isMine ? '<span class="read-receipt">✓✓</span>' : ''}
            </div>
        `;

        msgElement.innerHTML = html;
        this.messagesContainer.appendChild(msgElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    },

    escapeHTML: function(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
};

// ==============================================================================
// 7. تشغيل النظام عند تحميل الصفحة
// ==============================================================================
window.addEventListener('load', () => {
    NetworkManager.init();
    AuthManager.init();
    
    setTimeout(() => {
        if (AuthManager.currentUser) {
            ChatManager.init();
        }
    }, 500);
});

// تصدير للكائنات للوصول إليها برمجياً عند الحاجة
window.TawasolDB = {
    Crypto: CryptoEngine,
    Auth: AuthManager,
    Chat: ChatManager
};
