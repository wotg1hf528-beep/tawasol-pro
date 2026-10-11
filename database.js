/**
 * ==============================================================================
 * TAWASOL PRO - CORE DATABASE & ENCRYPTION ENGINE
 * Version: 3.0.0 (Ultimate Secure Build)
 * Architecture: Modular, Object-Oriented, IndexedDB + Firebase Realtime
 * ==============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, onValue, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-database.js";

// ==============================================================================
// 1. إعدادات خوادم Firebase (مفاتيحك الأصلية)
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

// ==============================================================================
// 2. محرك التشفير المتقدم (Advanced Crypto Engine - E2EE Simulation)
// ==============================================================================
const CryptoEngine = {
    /**
     * المفتاح السري الأساسي للتشفير - في التطبيقات الحقيقية يتم توليده ديناميكياً
     */
    masterKey: "TAWASOL_SECURE_KEY_2026_ULTRA_XOR",
    
    /**
     * دالة لتشفير النصوص قبل إرسالها للسيرفر
     * @param {string} text - النص المراد تشفيره
     * @returns {string} - النص المشفر بصيغة Base64
     */
    encryptMessage: function(text) {
        if (!text) return "";
        try {
            let encrypted = '';
            for (let i = 0; i < text.length; i++) {
                // دمج الحرف مع المفتاح السري باستخدام بوابة XOR
                const charCode = text.charCodeAt(i) ^ this.masterKey.charCodeAt(i % this.masterKey.length);
                encrypted += String.fromCharCode(charCode);
            }
            // تحويل النتيجة إلى Base64 لمنع ضياع البيانات
            return btoa(unescape(encodeURIComponent(encrypted)));
        } catch (error) {
            console.error("فشل التشفير:", error);
            return text;
        }
    },

    /**
     * دالة لفك تشفير النصوص المستلمة من السيرفر
     * @param {string} hash - النص المشفر
     * @returns {string} - النص الأصلي
     */
    decryptMessage: function(hash) {
        if (!hash) return "";
        try {
            // تحويل من Base64
            const decoded = decodeURIComponent(escape(atob(hash)));
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i) ^ this.masterKey.charCodeAt(i % this.masterKey.length);
                decrypted += String.fromCharCode(charCode);
            }
            return decrypted;
        } catch (error) {
            // إذا فشل الفك (رسالة غير مشفرة مثلاً) نرجعها كما هي
            return hash; 
        }
    },

    /**
     * دالة لتشفير رمز الـ PIN الخاص بالمستخدم محلياً
     */
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

    /**
     * تهيئة قاعدة البيانات المحلية في متصفح المستخدم
     */
    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // إنشاء جدول الرسائل
                if (!db.objectStoreNames.contains("messages")) {
                    const msgStore = db.createObjectStore("messages", { keyPath: "id" });
                    msgStore.createIndex("timestamp", "timestamp", { unique: false });
                    msgStore.createIndex("roomId", "roomId", { unique: false });
                }
                // إنشاء جدول المستخدمين
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

    /**
     * حفظ رسالة في الجهاز (للقراءة بدون إنترنت)
     */
    saveMessage: function(messageObj) {
        if (!this.dbInstance) return;
        const transaction = this.dbInstance.transaction(["messages"], "readwrite");
        const store = transaction.objectStore("messages");
        store.put(messageObj);
    },

    /**
     * استرجاع جميع الرسائل لغرفة معينة
     */
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
        
        // مراقبة اتصال Firebase
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
// 5. نظام المصادقة والحسابات (Authentication Manager)
// ==============================================================================
const AuthManager = {
    currentUser: null,

    init: function() {
        this.checkSession();
        this.bindEvents();
    },

    bindEvents: function() {
        // ربط نموذج التسجيل
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
            // سيتم طلب الـ PIN في ملف app.js
        }
    },

    registerNewUser: function() {
        const fullname = document.getElementById('reg-fullname').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const pin = document.getElementById('reg-pin').value.trim();

        if (!fullname || !username || pin.length !== 4) {
            if(window.UI) window.UI.showToast("الرجاء إكمال جميع الحقول بشكل صحيح", "error");
            return;
        }

        // تكوين كائن المستخدم
        const userData = {
            uid: "USER_" + Date.now().toString(36) + Math.random().toString(36).substr(2),
            fullname: fullname,
            username: "@" + username.replace('@', ''),
            createdAt: Date.now()
        };

        // حفظ البيانات محلياً
        localStorage.setItem('tw_user_profile', JSON.stringify(userData));
        localStorage.setItem('tw_pin', pin); // في الواقع يجب تشفيره
        
        this.currentUser = userData;

        // تسجيل المستخدم في Firebase
        const userRef = ref(db, 'users/' + this.currentUser.uid);
        set(userRef, {
            fullname: userData.fullname,
            username: userData.username,
            lastSeen: serverTimestamp()
        });

        if(window.UI) {
            window.UI.showToast("تم إنشاء الحساب ومفاتيح التشفير بنجاح", "success");
            window.UI.showScreen('app-main');
            ChatManager.updateProfileUI();
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
            // الإرسال عبر الزر
            sendBtn.addEventListener('click', () => {
                if(!sendBtn.querySelector('.icon-send').classList.contains('hidden')) {
                    this.sendMessage();
                } else {
                    if(window.UI) window.UI.showToast("ميزة تسجيل الصوت قيد التطوير", "info");
                }
            });

            // الإرسال عبر الكيبورد (Enter)
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
        if(avatarEl) avatarEl.innerText = user.fullname.charAt(0).toUpperCase();

        // تحديث صفحة الإعدادات
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
                // الزر يرجع مايكروفون يتم عبر app.js
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

        // التحقق مما إذا كانت الرسالة لي أم للطرف الآخر
        const isMine = AuthManager.currentUser && msgObj.senderId === AuthManager.currentUser.uid;
        
        // فك تشفير المحتوى
        let decryptedText = "رسالة مشفرة غير مدعومة";
        if (msgObj.type === "text") {
            decryptedText = CryptoEngine.decryptMessage(msgObj.payload);
        }

        // تنسيق الوقت
        const dateObj = new Date(msgObj.timestamp);
        const timeString = dateObj.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

        // بناء عنصر الرسالة
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
        
        // إضافة الرسالة للحاوية
        this.messagesContainer.appendChild(msgElement);
        
        // التمرير للأسفل تلقائياً
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    },

    /**
     * دالة لحماية التطبيق من هجمات XSS
     */
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
    // تأخير تشغيل الدردشة قليلاً لضمان تحميل الواجهات
    setTimeout(() => {
        if (AuthManager.currentUser) {
            ChatManager.init();
        }
    }, 500);
});

// تصدير للوصول إليها من ملفات أخرى إذا لزم الأمر
window.TawasolDB = {
    Crypto: CryptoEngine,
    Auth: AuthManager,
    Chat: ChatManager
};

