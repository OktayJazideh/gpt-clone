/**
 * Chat Integration
 * یکپارچه‌سازی ChatHistoryManager با رابط کاربری
 */

$(document).ready(function() {
    // استفاده از chatHistoryManager که در chatHistoryManager.js ساخته شده
    const chatManager = window.chatHistoryManager;
    
    if (!chatManager) {
        console.error('❌ ChatHistoryManager یافت نشد! مطمئن شوید که chatHistoryManager.js لود شده است.');
        return;
    }

    // ================== بارگذاری و نمایش چت‌ها ==================
    
    /**
     * رندر کردن چت‌های سایدبار
     */
    function renderSidebarChats() {
        if (!chatManager) {
            console.error('❌ chatManager not initialized');
            return;
        }
        
        const categorized = chatManager.getCategorizedChats();
        const $chatList = $('.chat-list');
        $chatList.empty();

        // ترتیب دسته‌بندی
        const categories = {
            pinned: 'پین شده',
            today: 'امروز',
            yesterday: 'دیروز',
            lastWeek: 'هفت روز قبل',
            lastMonth: 'سی روز قبل',
            older: 'قدیمی‌تر'
        };

        // رندر هر دسته
        Object.keys(categories).forEach(catKey => {
            const chats = categorized[catKey];
            
            if (chats && chats.length > 0) {
                const categoryHtml = `
                    <div class="chat-group">
                        <div class="chat-group-header px-3 py-2 text-muted small">${categories[catKey]}</div>
                        ${chats.map(chat => createChatItemHtml(chat, catKey === 'pinned')).join('')}
                    </div>
                `;
                $chatList.append(categoryHtml);
            }
        });

        console.log('✅ چت‌های سایدبار رندر شدند');
    }

    /**
     * ساخت HTML برای یک آیتم چت
     */
    function createChatItemHtml(chat, isPinned) {
        const pinIcon = isPinned ? '<i class="bi bi-pin-fill text-primary" style="font-size: 11px;"></i>' : '';
        const pinAction = isPinned ? 
            '<i class="bi bi-pin-angle"></i><span>برداشتن پین</span>' : 
            '<i class="bi bi-pin"></i><span>پین کردن</span>';

        return `
            <div class="chat-item px-3 py-2 d-flex align-items-center gap-2 position-relative" data-chat-id="${chat.id}" style="cursor: pointer;">
                ${pinIcon}
                <div class="avatar rounded" style="width: 32px; height: 32px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;">
                    <img src="/model_icons/gapgpt-icon-v3.png" alt="${chat.model}" style="width: 24px; height: 24px; border-radius: 4px;" onerror="this.style.display='none'">
                </div>
                <div class="chat-item-text flex-grow-1">${chat.title}</div>
                <div class="chat-actions" style="opacity: 0; transition: opacity 0.2s; margin-left: auto;">
                    <i class="bi bi-three-dots-vertical" style="cursor: pointer;"></i>
                </div>
                <div class="chat-context-menu" style="display: none; position: absolute; right: 90px; top: 100%; background: rgb(44, 44, 44); border-radius: 8px; min-width: 180px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000;">
                    <div class="list-group list-group-flush">
                        <div class="list-group-item list-group-item-action d-flex align-items-center gap-2 chat-action-rename" style="cursor: pointer; background: transparent; border: none; color: white; padding: 8px 12px;">
                            <i class="bi bi-pencil"></i>
                            <span>تغییر نام</span>
                        </div>
                        <div class="list-group-item list-group-item-action d-flex align-items-center gap-2 chat-action-pin" style="cursor: pointer; background: transparent; border: none; color: white; padding: 8px 12px;">
                            ${pinAction}
                        </div>
                        <div class="list-group-item list-group-item-action d-flex align-items-center gap-2 chat-action-archive" style="cursor: pointer; background: transparent; border: none; color: white; padding: 8px 12px;">
                            <i class="bi bi-archive"></i>
                            <span>آرشیو</span>
                        </div>
                        <div class="list-group-item list-group-item-action d-flex align-items-center gap-2 chat-action-delete" style="cursor: pointer; background: transparent; border: none; color: #dc3545; padding: 8px 12px;">
                            <i class="bi bi-trash"></i>
                            <span>حذف</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ================== کلیک روی چت ==================
    
    let currentLoadedChatId = null;

    /**
     * لود کردن چت و نمایش پیام‌ها
     */
    $(document).on('click', '.chat-item', function(e) {
        // اگر روی منو یا اکشن‌ها کلیک شده، چیزی نکن
        if ($(e.target).closest('.chat-actions, .chat-context-menu').length) {
            return;
        }

        const chatId = $(this).data('chat-id');
        
        // تشخیص اینکه در صفحه اصلی هستیم یا نه
        const isMainPage = $('#chatMessagesContainer').length > 0 && $('.startup-container').length > 0;
        
        if (isMainPage) {
            // اگر در صفحه اصلی هستیم، چت رو مستقیم لود کن
            loadChatMessages(chatId);
        } else {
            // اگر در صفحه دیگری هستیم، به صفحه اصلی redirect کن با chat ID
            window.location.href = `index.html?chat=${chatId}`;
            console.log('🔄 انتقال به صفحه اصلی برای لود چت:', chatId);
        }
    });

    /**
     * تابع لود کردن پیام‌های چت
     */
    function loadChatMessages(chatId) {
        const chat = chatManager.loadChat(chatId);
        
        if (!chat) {
            console.error('چت یافت نشد:', chatId);
            return;
        }

        currentLoadedChatId = chatId;

        // مخفی کردن صفحه اگر هنوز در حالت اولیه است
        if ($('.startup-features').length > 0) {
            $('.startup-features').removeClass('d-flex').addClass('d-none');
            $('.startup-header').hide();
            $('.mobile-chips').removeClass('d-flex').addClass('d-none');
            $('#chatMessagesContainer').show();
            
            // انتقال فرم به پایین
            const sidebarWidth = $('.sidebar-drawer').hasClass('collapsed') ? 0 : 300;
            $('.startup-container')
                .addClass('chat-input-footer')
                .css({
                    'position': 'fixed',
                    'bottom': '0',
                    'right': sidebarWidth + 'px',
                    'left': '0',
                    'max-width': 'none',
                    'margin': '0',
                    'padding': '20px',
                    'z-index': '100'
                });
            
            $('.input-suggestions-container').css({
                'max-width': '900px',
                'margin': '0 auto'
            });
        }

        // نمایش پیام‌های چت
        renderChatMessages(chat);

        // هایلایت کردن چت فعال
        $('.chat-item').removeClass('bg-primary bg-opacity-10');
        $(`.chat-item[data-chat-id="${chatId}"]`).addClass('bg-primary bg-opacity-10');

        // آپدیت وضعیت چیپس‌ها
        if (window.updateChipsVisibility) {
            window.updateChipsVisibility();
        }

        console.log('✅ چت لود شد:', chat.title, '- تعداد پیام‌ها:', chat.messages.length);
    }

    /**
     * رندر کردن پیام‌های چت
     */
    function renderChatMessages(chat) {
        const $container = $('#chatMessagesContainer');
        $container.empty();

        if (!chat.messages || chat.messages.length === 0) {
            $container.html('<div class="text-center text-muted py-5">هنوز پیامی در این چت وجود ندارد</div>');
            return;
        }

        chat.messages.forEach((msg, index) => {
            const isUser = msg.role === 'user';
            const messageHtml = createMessageHtml(msg, index, isUser);
            $container.append(messageHtml);
        });

        // Scroll به آخرین پیام
        $container.scrollTop($container[0].scrollHeight);
    }

    /**
     * ساخت HTML برای یک پیام
     */
    function createMessageHtml(msg, index, isUser) {
        let actionsHtml = '';
        
        if (isUser) {
            actionsHtml = `
                <div class="message-actions d-flex gap-1 mt-2" style="justify-content: flex-start;">
                    <button class="btn btn-sm btn-link text-white-50 p-1 copy-message-btn" data-content="${escapeHtml(msg.content)}" title="کپی">
                        <i class="bi bi-clipboard" style="font-size: 14px;"></i>
                    </button>
                </div>
            `;
        } else {
            actionsHtml = `
                <div class="message-actions d-flex gap-1 mt-2" style="justify-content: flex-end;">
                    <button class="btn btn-sm btn-link text-white-50 p-1 copy-message-btn" data-content="${escapeHtml(msg.content)}" title="کپی">
                        <i class="bi bi-clipboard" style="font-size: 14px;"></i>
                    </button>
                    <button class="btn btn-sm btn-link text-white-50 p-1 like-message-btn" title="لایک">
                        <i class="bi bi-hand-thumbs-up" style="font-size: 14px;"></i>
                    </button>
                    <button class="btn btn-sm btn-link text-white-50 p-1 dislike-message-btn" title="دیسلایک">
                        <i class="bi bi-hand-thumbs-down" style="font-size: 14px;"></i>
                    </button>
                </div>
            `;
        }

        return `
            <div class="message-item mb-4 d-flex ${isUser ? 'justify-content-start' : 'justify-content-end'}">
                <div style="max-width: 70%;">
                    <div class="message-bubble ${isUser ? 'rounded-5' : ''}" style="${isUser ? 'background-color: rgb(47, 47, 47); padding:10px 20px; color: white;' : 'color: var(--text-primary);'}">
                        <div class="message-content" style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(msg.content)}</div>
                    </div>
                    ${actionsHtml}
                </div>
            </div>
        `;
    }

    // ================== اکشن‌های پیام ==================
    
    $(document).on('click', '.copy-message-btn', function() {
        const text = $(this).data('content');
        navigator.clipboard.writeText(text).then(() => {
            $(this).find('i').removeClass('bi-clipboard').addClass('bi-check');
            setTimeout(() => {
                $(this).find('i').removeClass('bi-check').addClass('bi-clipboard');
            }, 2000);
        });
    });

    $(document).on('click', '.like-message-btn', function() {
        $(this).toggleClass('text-success');
    });

    $(document).on('click', '.dislike-message-btn', function() {
        $(this).toggleClass('text-danger');
    });

    // ================== اکشن‌های چت (حذف، تغییر نام، پین، آرشیو) ==================
    
    let chatToDelete = null;
    let chatToRename = null;

    // حذف چت
    $(document).on('click', '.chat-action-delete', function(e) {
        e.stopPropagation();
        chatToDelete = $(this).closest('.chat-item').data('chat-id');
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteChatModal'));
        deleteModal.show();
    });

    $('#confirmDeleteBtn').on('click', function() {
        if (chatToDelete) {
            chatManager.deleteChat(chatToDelete);
            renderSidebarChats();
            
            // اگر چت فعلی حذف شد، صفحه رو ریست کن
            if (currentLoadedChatId === chatToDelete) {
                $('#chatMessagesContainer').empty();
                currentLoadedChatId = null;
            }
            
            chatToDelete = null;
            const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteChatModal'));
            deleteModal.hide();
            
            console.log('✅ چت حذف شد');
        }
    });

    // تغییر نام چت
    $(document).on('click', '.chat-action-rename', function(e) {
        e.stopPropagation();
        chatToRename = $(this).closest('.chat-item').data('chat-id');
        const chat = chatManager.getChatById(chatToRename);
        
        if (chat) {
            $('#chatNewName').val(chat.title);
            const renameModal = new bootstrap.Modal(document.getElementById('renameChatModal'));
            renameModal.show();
            
            $('#renameChatModal').on('shown.bs.modal', function() {
                $('#chatNewName').focus().select();
            });
        }
    });

    $('#confirmRenameBtn').on('click', function() {
        if (chatToRename) {
            const newName = $('#chatNewName').val().trim();
            
            if (newName) {
                chatManager.renameChat(chatToRename, newName);
                renderSidebarChats();
                
                console.log('✅ نام چت تغییر کرد:', newName);
            }
            
            chatToRename = null;
            const renameModal = bootstrap.Modal.getInstance(document.getElementById('renameChatModal'));
            renameModal.hide();
        }
    });

    // پین کردن چت
    $(document).on('click', '.chat-action-pin', function(e) {
        e.stopPropagation();
        const chatId = $(this).closest('.chat-item').data('chat-id');
        chatManager.togglePin(chatId);
        renderSidebarChats();
        console.log('✅ وضعیت پین تغییر کرد');
    });

    // آرشیو کردن چت
    $(document).on('click', '.chat-action-archive', function(e) {
        e.stopPropagation();
        const chatId = $(this).closest('.chat-item').data('chat-id');
        chatManager.toggleArchive(chatId);
        renderSidebarChats();
        console.log('✅ چت آرشیو شد');
    });

    // ================== جستجوی چت ==================
    
    let searchTimeout = null;

    // اضافه کردن فیلد جستجو
    function addSearchField() {
        if ($('#chatSearchInput').length > 0) return;

        const searchHtml = `
            <div class="chat-search px-3 py-2" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div class="input-group">
                    <input type="text" class="form-control" id="chatSearchInput" placeholder="جستجو در چت‌ها..." style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white;">
                    <button class="btn btn-outline-secondary" type="button" id="clearSearchBtn" style="display: none;">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
        `;

        $('.drawer-header').after(searchHtml);
    }

    // دکمه جستجو در هدر سایدبار
    $('.drawer-header .btn-link:has(.bi-search)').on('click', function() {
        addSearchField();
        $('#chatSearchInput').focus();
    });

    // جستجو در چت‌ها
    $(document).on('input', '#chatSearchInput', function() {
        const query = $(this).val();
        
        if (query.trim()) {
            $('#clearSearchBtn').show();
        } else {
            $('#clearSearchBtn').hide();
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    // پاک کردن جستجو
    $(document).on('click', '#clearSearchBtn', function() {
        $('#chatSearchInput').val('');
        $(this).hide();
        renderSidebarChats();
    });

    /**
     * انجام جستجو
     */
    function performSearch(query) {
        if (!query.trim()) {
            renderSidebarChats();
            return;
        }

        const results = chatManager.search(query);
        const $chatList = $('.chat-list');
        $chatList.empty();

        if (results.length === 0) {
            $chatList.html('<div class="text-center text-muted py-4">نتیجه‌ای یافت نشد</div>');
            return;
        }

        const resultsHtml = `
            <div class="chat-group">
                <div class="chat-group-header px-3 py-2 text-muted small">نتایج جستجو (${results.length})</div>
                ${results.map(chat => createChatItemHtml(chat, chat.isPinned)).join('')}
            </div>
        `;

        $chatList.append(resultsHtml);
        console.log('🔍 جستجو انجام شد:', results.length, 'نتیجه');
    }

    // ================== Export/Import JSON ==================
    
    // دکمه Export
    $(document).on('click', '#exportChatsBtn', function() {
        chatManager.exportToJSON();
    });

    // دکمه Import
    $(document).on('click', '#importChatsBtn', function() {
        const fileInput = $('<input type="file" accept=".json" style="display: none;">');
        
        fileInput.on('change', function() {
            const file = this.files[0];
            if (file) {
                chatManager.importFromJSON(file)
                    .then(count => {
                        alert(`✅ ${count} چت با موفقیت import شد`);
                        renderSidebarChats();
                    })
                    .catch(error => {
                        alert('❌ خطا در import فایل: ' + error.message);
                    });
            }
        });
        
        fileInput.trigger('click');
    });

    // دکمه حذف همه گفت‌وگوها
    $(document).on('click', '#deleteAllConversationsBtn', function() {
        if (confirm('⚠️ آیا مطمئن هستید که می‌خواهید تمام گفت‌وگوها را حذف کنید؟\n\nاین عمل غیرقابل بازگشت است!\n\nتوصیه می‌شود قبل از حذف، یک Export از چت‌ها بگیرید.')) {
            if (confirm('⚠️ آخرین هشدار! آیا واقعاً می‌خواهید ادامه دهید؟')) {
                chatManager.deleteAllChats();
                renderSidebarChats();
                $('#chatMessagesContainer').empty();
                currentLoadedChatId = null;
                
                alert('✅ تمام گفت‌وگوها حذف شدند');
                console.log('🗑️ تمام چت‌ها حذف شدند');
            }
        }
    });

    // ================== کمکی ==================
    
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // ================== آماده‌سازی اولیه ==================
    
    // Export تابع renderSidebarChats برای استفاده در app.js
    window.renderSidebarChats = renderSidebarChats;
    
    // رندر اولیه چت‌ها
    renderSidebarChats();

    // نمایش آمار در کنسول
    const stats = chatManager.getStatistics();
    console.log('📊 آمار چت‌ها:', stats);

    console.log('✅ Chat Integration آماده است');
});
