/**
 * ==============================================================================
 * TAWASOL PRO - CORE DATABASE & ENCRYPTION ENGINE
 * Version: 3.1.0 (Google Auth + Unique Username Added)
 * Architecture: Modular, Object-Oriented, IndexedDB + Firebase Realtime
 * ==============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, onValue, set, serverTimestamp, get, update } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-database.js";
// إضافة مكتبة المصادقة
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // تهيئة المصادقة

// ==============================================================================
// 2. محرك التشفير المتقدم
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
// 3. مدير قواعد البيانات المحلية
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
// 4. نظام إدارة حالة الاتصال
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
// 5. نظام المصادقة والحسابات (تم التحديث لدعم جوجل)
// ==============================================================================
const AuthManager = {
    currentUser: null,
    tempGoogleUser: null, // يخزن بيانات جوجل مؤقتاً

    init: function() {
        this.checkSession();
        this.bindEvents();
    },

    bindEvents: function() {
        // ربط زر جوجل
        const btnGoogle = document.getElementById('btn-google-login');
        if(btnGoogle) {
            btnGoogle.addEventListener('click', () => this.loginWithGoogle());
        }

        // ربط نموذج التسجيل (الزر الأزرق)
        const form = document.getElementById('form-register');
        if(form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.registerNewUser();
            });
        }
        
        // ربط زر تسجيل الخروج
        const btnLogout = document.getElementById('btn-logout');
        if(btnLogout) {
            btnLogout.addEventListener('click', () => this.logout());
        }
    },

    checkSession: function() {
        const savedUser = localStorage.getItem('tw_user_profile');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
        }
    },

    loginWithGoogle: async function() {
        const provider = new GoogleAuthProvider();
        try {
            if(window.UI) window.UI.showToast("جاري فتح حساب Google...", "info");
            
            const result = await signInWithPopup(auth, provider);
            this.tempGoogleUser = result.user; // حفظ المستخدم
            
            if(window.UI) window.UI.showToast("تم ربط Google! أكمل البيانات في الأسفل واضغط إنشاء.", "success");
            
            // وضع اسم الشخص من جوجل في حقل "الاسم الكامل" لتسهيل العملية
            const nameInput = document.getElementById('reg-fullname');
            if(nameInput && this.tempGoogleUser.displayName) {
                nameInput.value = this.tempGoogleUser.displayName;
            }
            
        } catch (error) {
            console.error("خطأ Google:", error);
            if(window.UI) window.UI.showToast("فشل تسجيل الدخول بجوجل", "error");
        }
    },

    registerNewUser: async function() {
        // 1. التأكد أن المستخدم ضغط على زر جوجل أولاً
        if (!this.tempGoogleUser) {
            if(window.UI) window.UI.showToast("يجب الضغط على 'المتابعة باستخدام Google' أولاً!", "error");
            return;
        }

        const fullname = document.getElementById('reg-fullname').value.trim();
        const usernameInput = document.getElementById('reg-username').value.trim().toLowerCase();
        const pin = document.getElementById('reg-pin').value.trim();

        if (!fullname || !usernameInput || pin.length !== 4) {
            if(window.UI) window.UI.showToast("الرجاء إكمال جميع الحقول بشكل صحيح (PIN 4 أرقام)", "error");
            return;
        }

        const cleanUsername = usernameInput.replace('@', '');

        try {
            if(window.UI) window.UI.showToast("جاري التحقق من اسم المستخدم...", "info");

            // 2. التحقق من توفر اسم المستخدم
            const usernameRef = ref(db, `usernames/${cleanUsername}`);
            const snapshot = await get(usernameRef);

            // إذا كان الاسم موجوداً ومسجلاً لشخص آخر
            if (snapshot.exists() && snapshot.val() !== this.tempGoogleUser.uid) {
                if(window.UI) window.UI.showToast("اسم المستخدم هذا محجوز! الرجاء اختيار اسم آخر.", "error");
                return;
            }

            // 3. تحديث قاعدة البيانات (حجز الاسم + إنشاء الحساب)
            const updates = {};
            updates[`usernames/${cleanUsername}`] = this.tempGoogleUser.uid;
            updates[`users/${this.tempGoogleUser.uid}`] = {
                uid: this.tempGoogleUser.uid,
                fullname: fullname,
                username: "@" + cleanUsername,
                email: this.tempGoogleUser.email,
                createdAt: serverTimestamp()
            };

            await update(ref(db), updates);

            // 4. حفظ البيانات محلياً وتسجيل الدخول
            const userData = {
                uid: this.tempGoogleUser.uid,
                fullname: fullname,
                username: "@" + cleanUsername,
                createdAt: Date.now()
            };

            localStorage.setItem('tw_user_profile', JSON.stringify(userData));
            localStorage.setItem('tw_pin', pin); 
            
            this.currentUser = userData;

            if(window.UI) {
                window.UI.showToast("تم إنشاء الحساب والمفاتيح بنجاح!", "success");
                window.UI.showScreen('app-main');
                ChatManager.updateProfileUI();
            }

        } catch (error) {
            console.error(error);
            if(window.UI) window.UI.showToast("حدث خطأ أثناء الاتصال بقاعدة البيانات", "error");
        }
    },

    logout: function() {
        if(confirm("تحذير: سيتم مسح جميع بياناتك ورسائلك من هذا الجهاز للأبد. هل أنت متأكد؟")) {
            localStorage.clear();
            indexedDB.deleteDatabase(LocalDB.dbName);
            location.reload();
        }
    }
};

// ==============================================================================
// 6. محرك الدردشة المركزي
// ==============================================================================
const ChatManager = {
    globalRoomRef: ref(db, 'global_encrypted_room'),
    messagesContainer: document.getElementById('messages-list'),

    init: async function() {
        await LocalDB.init();
        this.bindEvents();
        this.updateProfileUI();
        
        const localMessages = await LocalDB.getMessages();
        localMessages.forEach(msg => this.renderMessageUI(msg));

        onChildAdded(this.globalRoomRef, (snapshot) => {
            const data = snapshot.val();
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
        
        const nameEl = document.getElementById('my-display-name');
        const avatarEl = document.getElementById('my-avatar');
        if(nameEl) nameEl.innerText = user.fullname;
        if(avatarEl) avatarEl.innerText = user.fullname.charAt(0).toUpperCase();

        const setName = document.getElementById('settings-name');
        const setHandle = document.getElementById('settings-handle');
        const setAvatar = document.getElementById('settings-avatar');
        if(setName) setName.innerText = user.fullname;
        if(setHandle) setHandle.innerText = user.username;
        if(setAvatar) setAvatar.innerText = user.fullname.charAt(0).toUpperCase();
    },

    sendMessage: function() {
        const input = document.getElementById('message-input');
        const rawText = input.value.trim();
        
        if (!rawText || !AuthManager.currentUser) return;

        const encryptedPayload = CryptoEngine.encryptMessage(rawText);

        const messagePacket = {
            id: "MSG_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            senderId: AuthManager.currentUser.uid,
            senderName: AuthManager.currentUser.fullname,
            payload: encryptedPayload,
            type: "text",
            timestamp: Date.now()
        };

        push(this.globalRoomRef, messagePacket)
            .then(() => {
                input.value = '';
                input.style.height = 'auto'; 
                document.querySelector('.icon-send').classList.add('hidden');
                document.querySelector('.icon-mic').classList.remove('hidden');
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

window.TawasolDB = {
    Crypto: CryptoEngine,
    Auth: AuthManager,
    Chat: ChatManager
};
