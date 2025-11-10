# سیستم مدیریت تاریخچه چت

## فایل‌های ایجاد شده:

1. **chatHistory.json** - فایل ذخیره‌سازی اصلی چت‌ها
2. **chatHistoryManager.js** - کلاس مدیریت چت‌ها
3. **chatIntegration.js** - یکپارچه‌سازی با رابط کاربری

## نحوه استفاده:

### 1. اضافه کردن اسکریپت‌ها به HTML

```html
<!-- قبل از بستن تگ body -->
<script src="chatHistoryManager.js"></script>
<script src="chatIntegration.js"></script>
```

### 2. قابلیت‌های موجود:

✅ **ایجاد چت جدید**
✅ **لود کردن چت با کلیک**
✅ **جستجو در چت‌ها**
✅ **تغییر نام چت**
✅ **پین کردن/برداشتن پین**
✅ **آرشیو کردن چت**
✅ **حذف چت**
✅ **Export به JSON**
✅ **Import از JSON**
✅ **دسته‌بندی بر اساس زمان**

### 3. استفاده از API:

```javascript
// دریافت تمام چت‌ها
const chats = chatHistoryManager.getAll();

// ایجاد چت جدید
const newChat = chatHistoryManager.createChat('سلام دنیا');

// افزودن پیام
chatHistoryManager.addMessage(chatId, 'محتوای پیام', 'user');

// لود کردن چت
const chat = chatHistoryManager.loadChat(chatId);

// جستجو
const results = chatHistoryManager.search('کلمه کلیدی');

// Export
chatHistoryManager.exportToJSON();
```

## ساختار چت:

```json
{
  "id": "unique-id",
  "title": "عنوان چت",
  "model": "GapGPT-5 Lite",
  "messages": [],
  "createdAt": "2024-11-10T...",
  "updatedAt": "2024-11-10T...",
  "isPinned": false,
  "isArchived": false,
  "tags": [],
  "metadata": {
    "messageCount": 0,
    "totalTokens": 0,
    "lastActivity": "2024-11-10T..."
  }
}
```

## ذخیره‌سازی:

- داده‌ها در localStorage ذخیره می‌شوند
- همزمان با sessionStorage هم sync می‌شوند
- قابلیت Export/Import برای backup
