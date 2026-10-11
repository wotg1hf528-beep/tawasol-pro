/**
 * Tawasol Pro - Main Application Logic
 * هذا الملف يتحكم بالواجهات، الأزرار، والحركات فقط.
 * (سيتم ربط البيانات والتشفير في ملف database.js)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================================================
    // 1. نظام إدارة الواجهات والإشعارات (UI & Toasts Manager)
    // ==========================================================================
    window.UI = {
        showScreen: (screenId) => {
            document.querySelectorAll('.screen-overlay, #app-main').forEach(el => el.classList.add('hidden'));
            document.getElementById(screenId).classList.remove('hidden');
        },
        openModal: (modalId) => {
            document.getElementById(modalId).classList.remove('hidden');
        },
        closeModals: () => {
            document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
        },
        showToast: (message, type = 'info') => {
            const container = document.getElementById('toast-rack');
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.style.cssText = `
                background: var(--bg-surface); border-left: 4px solid var(--primary);
                padding: 15px 20px; border-radius: 8px; box-shadow: var(--shadow-lg);
                margin-bottom: 10px; font-size: 14px; font-weight: bold;
                animation: slideInLeft 0.3s ease, fadeOut 0.3s ease 3s forwards;
            `;
            if(type === 'error') toast.style.borderLeftColor = 'var(--danger)';
            if(type === 'success') toast.style.borderLeftColor = 'var(--accent)';
            
            toast.innerText = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3500);
        }
    };

    // ==========================================================================
    // 2. نظام شاشة القفل (PIN Lock System)
    // ==========================================================================
    const PinSystem = {
        currentPin: '',
        boxes: document.querySelectorAll('.pin-box'),
        
        init: function() {
            document.querySelectorAll('.num-btn[data-num]').forEach(btn => {
                btn.addEventListener('click', (e) => this.addDigit(e.target.dataset.num));
            });
            document.getElementById('btn-pin-clear').addEventListener('click', () => this.clear());
            document.getElementById('btn-pin-submit').addEventListener('click', () => this.submit());
        },
        addDigit: function(num) {
            if (this.currentPin.length < 4) {
                this.currentPin += num;
                this.updateUI();
            }
        },
        clear: function() {
            this.currentPin = '';
            this.updateUI();
        },
        updateUI: function() {
            this.boxes.forEach((box, index) => {
                if (index < this.currentPin.length) {
                    box.value = '●';
                    box.classList.add('filled');
                } else {
                    box.value = '';
                    box.classList.remove('filled');
                }
            });
        },
        submit: function() {
            if (this.currentPin.length !== 4) {
                UI.showToast('الرجاء إدخال 4 أرقام', 'error');
                return;
            }
            // فحص مبدئي (سيتم استبداله بالتحقق من قاعدة البيانات)
            const savedPin = localStorage.getItem('tw_pin');
            if (!savedPin) {
                // لا يوجد حساب مسجل مسبقاً، اذهب للتسجيل
                UI.showScreen('screen-auth');
            } else if (this.currentPin === savedPin) {
                // الرمز صحيح
                UI.showScreen('app-main');
                UI.showToast('تم فك التشفير بنجاح', 'success');
            } else {
                UI.showToast('الرمز غير صحيح!', 'error');
                this.clear();
            }
        }
    };
    PinSystem.init();

    // ==========================================================================
    // 3. نظام التنقل الجانبي والسفلي (Navigation)
    // ==========================================================================
    const NavSystem = {
        init: function() {
            const navItems = document.querySelectorAll('.nav-item');
            const viewPanes = document.querySelectorAll('.view-pane');

            navItems.forEach(item => {
                item.addEventListener('click', function() {
                    // إزالة التفعيل من الكل
                    navItems.forEach(nav => nav.classList.remove('active'));
                    viewPanes.forEach(pane => pane.classList.remove('active'));
                    
                    // تفعيل العنصر المضغوط
                    this.classList.add('active');
                    const targetId = this.getAttribute('data-target');
                    document.getElementById(targetId).classList.add('active');
                });
            });

            // زر العودة في الموبايل (للخروج من المحادثة)
            document.getElementById('btn-back-to-list').addEventListener('click', () => {
                document.body.classList.remove('app-main-chat-active');
            });
        }
    };
    NavSystem.init();

    // ==========================================================================
    // 4. نظام شريط الكتابة الذكي (Smart Input Area)
    // ==========================================================================
    const InputSystem = {
        input: document.getElementById('message-input'),
        actionBtn: document.getElementById('btn-action-main'),
        micIcon: document.querySelector('.icon-mic'),
        sendIcon: document.querySelector('.icon-send'),
        attachBtn: document.getElementById('btn-toggle-attach'),
        attachPopup: document.getElementById('attach-popup'),
        
        init: function() {
            // توسيع شريط الكتابة تلقائياً
            this.input.addEventListener('input', () => {
                this.input.style.height = 'auto';
                this.input.style.height = (this.input.scrollHeight) + 'px';
                this.toggleActionBtn();
            });

            // فتح/غلق قائمة المرفقات
            this.attachBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.attachPopup.classList.toggle('hidden');
            });

            // إخفاء المرفقات عند الضغط خارجها
            document.addEventListener('click', (e) => {
                if(!this.attachPopup.classList.contains('hidden') && e.target !== this.attachBtn) {
                    this.attachPopup.classList.add('hidden');
                }
            });
        },
        toggleActionBtn: function() {
            // إذا كان هناك نص، أظهر زر الإرسال، وإلا أظهر المايك
            if (this.input.value.trim().length > 0) {
                this.micIcon.classList.add('hidden');
                this.sendIcon.classList.remove('hidden');
            } else {
                this.micIcon.classList.remove('hidden');
                this.sendIcon.classList.add('hidden');
                this.input.style.height = 'auto'; // إعادة الحجم
            }
        }
    };
    InputSystem.init();

    // ==========================================================================
    // 5. إدارة النوافذ المنبثقة (Modals & Theme)
    // ==========================================================================
    // إغلاق النوافذ
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', UI.closeModals);
    });

    // فتح الإعدادات
    document.getElementById('btn-global-settings').addEventListener('click', () => {
        UI.openModal('modal-settings');
    });

    // تغيير المظهر (Dark / Light Mode)
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('tw_theme', isLight ? 'light' : 'dark');
    });

    // استعادة المظهر المحفوظ
    if(localStorage.getItem('tw_theme') === 'light') {
        document.body.classList.add('light-theme');
    }

    // ==========================================================================
    // 6. محاكي فتح محادثة (للواجهة فقط حالياً)
    // ==========================================================================
    window.openDummyChat = function(name, avatar) {
        document.getElementById('active-chat-area').classList.remove('empty-selection');
        document.getElementById('active-chat-ui').classList.remove('hidden');
        document.querySelector('.no-chat-selected').classList.add('hidden');
        
        document.getElementById('active-chat-name').innerText = name;
        document.getElementById('active-chat-avatar').innerText = avatar;
        
        // للموبايل: إخفاء القوائم وإظهار الدردشة
        document.body.classList.add('app-main-chat-active');
    };

    // ==========================================================================
    // 7. التهيئة الأولية للتطبيق (Startup Logic)
    // ==========================================================================
    const checkInitialAuth = () => {
        const hasAccount = localStorage.getItem('tw_user');
        if (hasAccount) {
            // إذا كان لديه حساب، أظهر شاشة الـ PIN
            UI.showScreen('screen-lock');
        } else {
            // إذا لم يكن لديه حساب، أظهر شاشة التسجيل
            UI.showScreen('screen-auth');
        }
    };
    
    // تشغيل الفحص عند بدء التطبيق
    checkInitialAuth();

    // إضافة أنميشن ديناميكي للـ CSS عبر JS
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; visibility: hidden; } }
    `;
    document.head.appendChild(styleSheet);
});

