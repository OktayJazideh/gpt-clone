/**
 * Chat History Manager
 * سیستم مدیریت کامل تاریخچه چت با پشتیبانی از JSON
 */

class ChatHistoryManager {
    constructor() {
        this.storageKey = 'chatHistory';
        this.version = '1.0.0';
        this.initialize();
    }

    /**
     * مقداردهی اولیه
     */
    initialize() {
        // اگر localStorage خالی است، داده‌های نمونه بسازیم
        const existing = this.getAll();
        if (existing.length === 0) {
            this.createSampleChats();
        }
    }

    /**
     * دریافت تمام چت‌ها
     */
    getAll() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('خطا در خواندن تاریخچه:', error);
            return [];
        }
    }

    /**
     * ذخیره تمام چت‌ها
     */
    saveAll(chats) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(chats));
            this.syncToFile();
            return true;
        } catch (error) {
            console.error('خطا در ذخیره تاریخچه:', error);
            return false;
        }
    }

    /**
     * ایجاد چت جدید
     */
    createChat(firstMessage, model = 'GapGPT-5 Lite') {
        const chat = {
            id: this.generateId(),
            title: this.generateTitle(firstMessage),
            model: model,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPinned: false,
            isArchived: false,
            tags: [],
            metadata: {
                messageCount: 0,
                totalTokens: 0,
                lastActivity: new Date().toISOString()
            }
        };

        const chats = this.getAll();
        chats.unshift(chat);
        this.saveAll(chats);

        console.log('✅ چت جدید ساخته شد:', chat.id);
        return chat;
    }

    /**
     * دریافت یک چت با ID
     */
    getChatById(chatId) {
        const chats = this.getAll();
        const chat = chats.find(c => c.id === chatId);
        
        if (!chat) {
            console.warn('چت با این ID یافت نشد:', chatId);
            return null;
        }

        return chat;
    }

    /**
     * لود کردن چت (برای نمایش در صفحه)
     */
    loadChat(chatId) {
        const chat = this.getChatById(chatId);
        
        if (!chat) {
            return null;
        }

        // آپدیت زمان آخرین فعالیت
        chat.metadata.lastActivity = new Date().toISOString();
        this.updateChat(chatId, chat);

        console.log('📖 چت لود شد:', chat.title);
        return chat;
    }

    /**
     * افزودن پیام به چت
     */
    addMessage(chatId, content, role = 'user') {
        const chats = this.getAll();
        const chat = chats.find(c => c.id === chatId);

        if (!chat) {
            console.error('چت یافت نشد:', chatId);
            return false;
        }

        const message = {
            id: this.generateId(),
            role: role,
            content: content,
            timestamp: new Date().toISOString(),
            tokens: this.estimateTokens(content)
        };

        chat.messages.push(message);
        chat.updatedAt = new Date().toISOString();
        chat.metadata.messageCount = chat.messages.length;
        chat.metadata.totalTokens += message.tokens;
        chat.metadata.lastActivity = new Date().toISOString();

        this.saveAll(chats);
        console.log('💬 پیام اضافه شد به چت:', chatId);
        return true;
    }

    /**
     * آپدیت چت
     */
    updateChat(chatId, updates) {
        const chats = this.getAll();
        const index = chats.findIndex(c => c.id === chatId);

        if (index === -1) {
            console.error('چت یافت نشد:', chatId);
            return false;
        }

        chats[index] = { ...chats[index], ...updates, updatedAt: new Date().toISOString() };
        this.saveAll(chats);
        console.log('✏️ چت آپدیت شد:', chatId);
        return true;
    }

    /**
     * تغییر نام چت
     */
    renameChat(chatId, newTitle) {
        return this.updateChat(chatId, { title: newTitle });
    }

    /**
     * پین کردن/برداشتن پین چت
     */
    togglePin(chatId) {
        const chat = this.getChatById(chatId);
        if (!chat) return false;

        return this.updateChat(chatId, { isPinned: !chat.isPinned });
    }

    /**
     * آرشیو کردن/خارج کردن از آرشیو
     */
    toggleArchive(chatId) {
        const chat = this.getChatById(chatId);
        if (!chat) return false;

        return this.updateChat(chatId, { isArchived: !chat.isArchived });
    }

    /**
     * حذف چت
     */
    deleteChat(chatId) {
        let chats = this.getAll();
        const beforeLength = chats.length;
        
        chats = chats.filter(c => c.id !== chatId);
        
        if (chats.length === beforeLength) {
            console.error('چت یافت نشد:', chatId);
            return false;
        }

        this.saveAll(chats);
        console.log('🗑️ چت حذف شد:', chatId);
        return true;
    }

    /**
     * حذف تمام چت‌ها (بدون confirm - باید از خارج مدیریت شود)
     */
    deleteAllChats() {
        this.saveAll([]);
        console.log('🗑️ تمام چت‌ها حذف شدند');
        return true;
    }

    /**
     * جستجو در چت‌ها
     */
    search(query) {
        if (!query || query.trim() === '') {
            return this.getAll();
        }

        const chats = this.getAll();
        const searchLower = query.toLowerCase().trim();

        return chats.filter(chat => {
            // جستجو در عنوان
            if (chat.title.toLowerCase().includes(searchLower)) {
                return true;
            }

            // جستجو در محتوای پیام‌ها
            if (chat.messages && chat.messages.length > 0) {
                return chat.messages.some(msg => 
                    msg.content.toLowerCase().includes(searchLower)
                );
            }

            // جستجو در تگ‌ها
            if (chat.tags && chat.tags.length > 0) {
                return chat.tags.some(tag => 
                    tag.toLowerCase().includes(searchLower)
                );
            }

            return false;
        });
    }

    /**
     * فیلتر پیشرفته چت‌ها
     */
    filter(options = {}) {
        let chats = this.getAll();

        // فیلتر بر اساس پین شده
        if (options.pinned !== undefined) {
            chats = chats.filter(c => c.isPinned === options.pinned);
        }

        // فیلتر بر اساس آرشیو شده
        if (options.archived !== undefined) {
            chats = chats.filter(c => c.isArchived === options.archived);
        }

        // فیلتر بر اساس مدل
        if (options.model) {
            chats = chats.filter(c => c.model === options.model);
        }

        // فیلتر بر اساس تاریخ
        if (options.dateFrom) {
            chats = chats.filter(c => new Date(c.createdAt) >= new Date(options.dateFrom));
        }

        if (options.dateTo) {
            chats = chats.filter(c => new Date(c.createdAt) <= new Date(options.dateTo));
        }

        // فیلتر بر اساس تگ
        if (options.tag) {
            chats = chats.filter(c => c.tags && c.tags.includes(options.tag));
        }

        return chats;
    }

    /**
     * دریافت چت‌های دسته‌بندی شده بر اساس زمان
     */
    getCategorizedChats() {
        const chats = this.getAll().filter(c => !c.isArchived);
        const grouped = {
            pinned: [],
            today: [],
            yesterday: [],
            lastWeek: [],
            lastMonth: [],
            older: []
        };

        chats.forEach(chat => {
            if (chat.isPinned) {
                grouped.pinned.push(chat);
            } else {
                const category = this.getTimeCategory(chat.createdAt);
                grouped[category].push(chat);
            }
        });

        return grouped;
    }

    /**
     * دریافت آمار چت‌ها
     */
    getStatistics() {
        const chats = this.getAll();
        
        return {
            total: chats.length,
            active: chats.filter(c => !c.isArchived).length,
            archived: chats.filter(c => c.isArchived).length,
            pinned: chats.filter(c => c.isPinned).length,
            totalMessages: chats.reduce((sum, c) => sum + (c.messages?.length || 0), 0),
            totalTokens: chats.reduce((sum, c) => sum + (c.metadata?.totalTokens || 0), 0),
            byModel: this.getModelStatistics(chats)
        };
    }

    /**
     * Export به JSON
     */
    exportToJSON() {
        const chats = this.getAll();
        const exportData = {
            version: this.version,
            exportDate: new Date().toISOString(),
            totalChats: chats.length,
            chats: chats
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('📥 تاریخچه چت export شد');
        return true;
    }

    /**
     * Import از JSON
     */
    importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (!data.chats || !Array.isArray(data.chats)) {
                        throw new Error('فرمت فایل نامعتبر است');
                    }

                    // آپشن: merge یا replace
                    const shouldReplace = confirm('آیا می‌خواهید چت‌های فعلی را جایگزین کنید؟\n(Cancel = ادغام با چت‌های فعلی)');
                    
                    if (shouldReplace) {
                        this.saveAll(data.chats);
                    } else {
                        const existing = this.getAll();
                        const merged = [...data.chats, ...existing];
                        this.saveAll(merged);
                    }

                    console.log('📤 تاریخچه چت import شد:', data.chats.length, 'چت');
                    resolve(data.chats.length);
                } catch (error) {
                    console.error('خطا در import:', error);
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
            reader.readAsText(file);
        });
    }

    /**
     * سینک با فایل JSON (برای آینده - نیاز به backend دارد)
     */
    async syncToFile() {
        // این قسمت برای استفاده در آینده با backend است
        // در صورت نیاز می‌توان با API سرور ارتباط برقرار کرد
        
        const chats = this.getAll();
        const syncData = {
            version: this.version,
            lastUpdated: new Date().toISOString(),
            totalChats: chats.length,
            chats: chats
        };

        // ذخیره موقت در sessionStorage برای دیباگ
        sessionStorage.setItem('chatHistorySync', JSON.stringify(syncData));
        
        return syncData;
    }

    // ==================== توابع کمکی ====================

    /**
     * تولید ID یکتا
     */
    generateId() {
        return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * تولید عنوان از پیام اول
     */
    generateTitle(message) {
        if (!message) return 'گفتگوی جدید';
        const cleanMessage = message.trim();
        return cleanMessage.substring(0, 50) + (cleanMessage.length > 50 ? '...' : '');
    }

    /**
     * تخمین تعداد توکن‌ها
     */
    estimateTokens(text) {
        // تخمین ساده: حدود 4 کاراکتر = 1 توکن
        return Math.ceil(text.length / 4);
    }

    /**
     * دریافت دسته‌بندی زمانی
     */
    getTimeCategory(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays <= 7) return 'lastWeek';
        if (diffDays <= 30) return 'lastMonth';
        return 'older';
    }

    /**
     * دریافت آمار بر اساس مدل
     */
    getModelStatistics(chats) {
        const modelStats = {};
        
        chats.forEach(chat => {
            const model = chat.model || 'Unknown';
            if (!modelStats[model]) {
                modelStats[model] = 0;
            }
            modelStats[model]++;
        });

        return modelStats;
    }

    /**
     * ایجاد چت‌های نمونه (برای تست)
     */
    createSampleChats() {
        const samples = [
            {
                title: 'سلام و احوالپرسی',
                daysAgo: 0,
                messages: [
                    { role: 'user', content: 'سلام، چطوری؟' },
                    { role: 'assistant', content: 'سلام! من یک هوش مصنوعی هستم و آماده کمک به شما هستم.' }
                ]
            },
            {
                title: 'کمک برای کدنویسی پایتون',
                daysAgo: 1,
                messages: [
                    { role: 'user', content: 'چطور یک لیست در پایتون بسازم؟' },
                    { role: 'assistant', content: 'برای ساخت لیست در پایتون می‌توانید از [] استفاده کنید.' }
                ]
            },
            {
                title: 'تولید تصویر هوش مصنوعی',
                daysAgo: 3,
                messages: []
            }
        ];

        samples.forEach(sample => {
            const chat = this.createChat(sample.title);
            chat.createdAt = new Date(Date.now() - sample.daysAgo * 86400000).toISOString();
            
            sample.messages.forEach(msg => {
                this.addMessage(chat.id, msg.content, msg.role);
            });
        });
    }
}

// ایجاد instance سراسری
window.chatHistoryManager = new ChatHistoryManager();

// Export برای استفاده در ماژول‌های دیگر
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatHistoryManager;
}
