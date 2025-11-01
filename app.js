$(document).ready(function() {
    let attachedFiles = [];
    let currentChatId = null;
    
    // Chat History Management
    function getChatHistory() {
        const history = localStorage.getItem('chatHistory');
        return history ? JSON.parse(history) : [];
    }
    
    function saveChatHistory(history) {
        localStorage.setItem('chatHistory', JSON.stringify(history));
    }
    
    function createNewChat(firstMessage) {
        const chat = {
            id: Date.now().toString(),
            title: firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : ''),
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const history = getChatHistory();
        history.unshift(chat);
        saveChatHistory(history);
        currentChatId = chat.id;
        
        return chat;
    }
    
    function addMessageToChat(chatId, message, role) {
        const history = getChatHistory();
        const chat = history.find(c => c.id === chatId);
        
        if (chat) {
            chat.messages.push({
                role: role,
                content: message,
                timestamp: new Date().toISOString()
            });
            chat.updatedAt = new Date().toISOString();
            saveChatHistory(history);
        }
    }
    
    function getTimeCategory(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'امروز';
        if (diffDays === 1) return 'دیروز';
        if (diffDays <= 7) return 'هفت روز قبل';
        if (diffDays <= 30) return 'سی روز قبل';
        return 'قدیمی‌تر';
    }
    
    // نمایش پیام‌ها در صفحه چت
    function renderMessages(chatId) {
        const history = getChatHistory();
        const chat = history.find(c => c.id === chatId);
        
        if (!chat || !chat.messages) return;
        
        const $container = $('#chatMessagesContainer');
        $container.empty();
        
        chat.messages.forEach((msg, index) => {
            const isUser = msg.role === 'user';
            
            let actionsHtml = '';
            if (isUser) {
                // اکشن‌های پیام کاربر: ویرایش و کپی
                actionsHtml = `
                    <div class="message-actions d-flex gap-1 mt-2" style="justify-content: flex-start;">
                        <button class="btn btn-sm btn-link text-white-50 p-1 edit-message-btn" data-index="${index}" title="ویرایش">
                            <i class="bi bi-pencil" style="font-size: 14px;"></i>
                        </button>
                        <button class="btn btn-sm btn-link text-white-50 p-1 copy-message-btn" data-content="${msg.content.replace(/"/g, '&quot;')}" title="کپی">
                            <i class="bi bi-clipboard" style="font-size: 14px;"></i>
                        </button>
                    </div>
                `;
            } else {
                // اکشن‌های پیام هوش مصنوعی: لایک، دیسلایک، ریجنریت و کپی
                actionsHtml = `
                    <div class="message-actions d-flex gap-1 mt-2" style="justify-content: flex-end;">
                        <button class="btn btn-sm btn-link text-white-50 p-1 copy-message-btn" data-content="${msg.content.replace(/"/g, '&quot;')}" title="کپی">
                            <i class="bi bi-clipboard" style="font-size: 14px;"></i>
                        </button>
                        <button class="btn btn-sm btn-link text-white-50 p-1 regenerate-message-btn" data-index="${index}" title="تولید مجدد">
                            <i class="bi bi-arrow-clockwise" style="font-size: 14px;"></i>
                        </button>
                        <button class="btn btn-sm btn-link text-white-50 p-1 like-message-btn" data-index="${index}" title="لایک">
                            <i class="bi bi-hand-thumbs-up" style="font-size: 14px;"></i>
                        </button>
                        <button class="btn btn-sm btn-link text-white-50 p-1 dislike-message-btn" data-index="${index}" title="دیسلایک">
                            <i class="bi bi-hand-thumbs-down" style="font-size: 14px;"></i>
                        </button>
                    </div>
                `;
            }
            
            const messageHtml = `
                <div class="message-item mb-4 d-flex ${isUser ? 'justify-content-start' : 'justify-content-end'}">
                    <div style="max-width: 70%;">
                        <div class="message-bubble ${isUser ? 'rounded-5' : ''}" style="${isUser ? 'background-color: rgb(47, 47, 47); padding:10px 20px; color: white;' : 'color: var(--text-primary);'}">
                            <div class="message-content" style="white-space: pre-wrap; word-wrap: break-word;">${msg.content}</div>
                        </div>
                        ${actionsHtml}
                    </div>
                </div>
            `;
            $container.append(messageHtml);
        });
        
        // Scroll به آخرین پیام
        $container.scrollTop($container[0].scrollHeight);
        
        // اتصال رویدادها
        $(document).off('click', '.copy-message-btn').on('click', '.copy-message-btn', function() {
            const text = $(this).data('content');
            navigator.clipboard.writeText(text);
        });
        
        $(document).off('click', '.edit-message-btn').on('click', '.edit-message-btn', function() {
            const idx = $(this).data('index');
            const history = getChatHistory();
            const chat = history.find(c => c.id === currentChatId);
            if (!chat) return;
            const msg = chat.messages[idx];
            if (!msg || msg.role !== 'user') return;
            
            // قرار دادن متن در textarea برای ادیت
            $('.input-wrapper textarea').val(msg.content).focus().trigger('input');
            // حذف پیام قبلی از چت
            chat.messages.splice(idx, 1);
            saveChatHistory(history);
            renderMessages(currentChatId);
        });
        
        $(document).off('click', '.regenerate-message-btn').on('click', '.regenerate-message-btn', function() {
            const idx = $(this).data('index');
            console.log('Regenerate for message index:', idx);
            
            if (isGenerating) return; // اگر در حال تولید هست، برگرد
            
            const history = getChatHistory();
            const chat = history.find(c => c.id === currentChatId);
            if (!chat) return;
            
            // حذف پاسخ قبلی و تولید جدید
            chat.messages.splice(idx, 1);
            saveChatHistory(history);
            renderMessages(currentChatId);
            
            // پیدا کردن پیام کاربر قبل از این پاسخ
            const userMessage = chat.messages[idx - 1];
            const userMessageText = userMessage ? userMessage.content : 'درخواست قبلی';
            
            // تغییر حالت به generating
            isGenerating = true;
            $('#sendMessageBtn').show();
            $('#voiceBtn').hide();
            $('#soundwaveBtn').hide();
            updateSendButtonState();
            
            // تولید پاسخ جدید
            currentGenerationTimeout = setTimeout(() => {
                const newResponse = 'پاسخ جدید برای: "' + userMessageText + '"';
                addMessageToChat(currentChatId, newResponse, 'assistant');
                renderMessages(currentChatId);
                
                // برگرداندن حالت عادی
                isGenerating = false;
                currentGenerationTimeout = null;
                updateSendButtonState();
            }, 3000);
        });
        
        $(document).off('click', '.like-message-btn').on('click', '.like-message-btn', function() {
            $(this).toggleClass('text-success');
        });
        
        $(document).off('click', '.dislike-message-btn').on('click', '.dislike-message-btn', function() {
            $(this).toggleClass('text-danger');
        });
    }
    
    function renderChatHistory() {
        const history = getChatHistory();
        const grouped = {};
        
        // جداسازی چت‌های آرشیو شده، پین شده و عادی
        const archivedChats = history.filter(chat => chat.isArchived);
        const pinnedChats = history.filter(chat => !chat.isArchived && chat.isPinned);
        const normalChats = history.filter(chat => !chat.isArchived && !chat.isPinned);
        
        // گروه‌بندی چت‌های عادی بر اساس تاریخ
        normalChats.forEach(chat => {
            const category = getTimeCategory(chat.createdAt);
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(chat);
        });
        
        // پاک کردن لیست قبلی
        $('.chat-list').empty();
        
        // چت‌های آرشیو شده فقط از تنظیمات قابل دسترسی هستند
        
        // نمایش چت‌های پین شده در بالا
        if (pinnedChats.length > 0) {
            const pinnedHtml = `
                <div class="chat-group">
                    <div class="chat-group-header px-3 py-2 text-muted small">پین شده</div>
                    ${pinnedChats.map(chat => `
                        <div class="chat-item px-3 py-2 d-flex align-items-center gap-2 position-relative" data-chat-id="${chat.id}" style="cursor: pointer;">
                            <i class="bi bi-pin-fill text-primary" style="font-size: 11px;"></i>

                            <div class="avatar rounded" style="width: 32px; height: 32px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;">
                                <img src="/model_icons/gapgpt-icon-v3.png" alt="GapGPT" style="width: 24px; height: 24px; border-radius: 4px;" onerror="this.style.display='none'">
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
                                        <i class="bi bi-pin-angle"></i>
                                        <span>برداشتن پین</span>
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
                    `).join('')}
                </div>
            `;
            $('.chat-list').append(pinnedHtml);
        }
        
        // نمایش چت‌ها بر اساس دسته‌بندی
        const categories = ['امروز', 'دیروز', 'هفت روز قبل', 'سی روز قبل', 'قدیمی‌تر'];
        
        categories.forEach(category => {
            if (grouped[category] && grouped[category].length > 0) {
                const groupHtml = `
                    <div class="chat-group">
                        <div class="chat-group-header px-3 py-2 text-muted small">${category}</div>
                        ${grouped[category].map(chat => `
                            <div class="chat-item px-3 py-2 d-flex align-items-center gap-2 position-relative" data-chat-id="${chat.id}" style="cursor: pointer;">
                                <div class="avatar rounded" style="width: 32px; height: 32px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;">
                                    <img src="/model_icons/gapgpt-icon-v3.png" alt="GapGPT" style="width: 24px; height: 24px; border-radius: 4px;" onerror="this.style.display='none'">
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
                                            <i class="bi bi-pin"></i>
                                            <span>پین کردن</span>
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
                        `).join('')}
                    </div>
                `;
                $('.chat-list').append(groupHtml);
            }
        });
    }
    
    // بارگذاری هیستوری بعد از لود صفحه
    // اضافه چت تستی اگر هیستوری خالی است
    let history = getChatHistory();
    if (history.length === 0) {
        const testChats = [
            {
                id: Date.now().toString(),
                title: 'سلام و احوالپرسی',
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isPinned: false
            },
            {
                id: (Date.now() + 1).toString(),
                title: 'کمک برای کدنویسی',
                messages: [],
                createdAt: new Date(Date.now() - 86400000).toISOString(), // دیروز
                updatedAt: new Date(Date.now() - 86400000).toISOString(),
                isPinned: false
            },
            {
                id: (Date.now() + 2).toString(),
                title: 'تولید تصویر',
                messages: [],
                createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 روز پیش
                updatedAt: new Date(Date.now() - 172800000).toISOString(),
                isPinned: false
            }
        ];
        saveChatHistory(testChats);
    }
    
    renderChatHistory();
    
    // Chat Actions
    $(document).on('click', '.chat-actions', function(e) {
        e.stopPropagation();
        console.log('Chat actions clicked');
        const menu = $(this).siblings('.chat-context-menu');
        $('.chat-context-menu').not(menu).hide();
        menu.toggle();
        console.log('Menu toggled, visible:', menu.is(':visible'));
    });
    
    // بستن منو با کلیک بیرون
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.chat-actions').length && !$(e.target).closest('.chat-context-menu').length) {
            $('.chat-context-menu').hide();
        }
    });
    
    // پین کردن
    $(document).on('click', '.chat-action-pin', function(e) {
        e.stopPropagation();
        console.log('Pin action clicked');
        const chatId = String($(this).closest('.chat-item').data('chat-id'));
        console.log('Chat ID:', chatId);
        const history = getChatHistory();
        const chat = history.find(c => String(c.id) === chatId);
        
        if (chat) {
            chat.isPinned = !chat.isPinned;
            console.log('Chat pinned status:', chat.isPinned);
            saveChatHistory(history);
            renderChatHistory();
        } else {
            console.error('Chat not found:', chatId);
        }
    });
    
    // حذف کردن
    let chatToDelete = null;
    
    $(document).on('click', '.chat-action-delete', function(e) {
        e.stopPropagation();
        console.log('Delete action clicked');
        chatToDelete = String($(this).closest('.chat-item').data('chat-id'));
        console.log('Chat to delete:', chatToDelete);
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteChatModal'));
        deleteModal.show();
    });
    
    $('#confirmDeleteBtn').on('click', function() {
        if (chatToDelete) {
            let history = getChatHistory();
            history = history.filter(c => String(c.id) !== chatToDelete);
            saveChatHistory(history);
            renderChatHistory();
            chatToDelete = null;
            
            const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteChatModal'));
            deleteModal.hide();
        }
    });
    
    // آرشیو کردن
    $(document).on('click', '.chat-action-archive', function(e) {
        e.stopPropagation();
        console.log('Archive action clicked');
        const chatId = String($(this).closest('.chat-item').data('chat-id'));
        console.log('Chat to archive:', chatId);
        const history = getChatHistory();
        const chat = history.find(c => String(c.id) === chatId);
        
        if (chat) {
            chat.isArchived = true;
            console.log('Chat archived');
            saveChatHistory(history);
            renderChatHistory();
        }
    });
    
    // خروج از آرشیو
    $(document).on('click', '.chat-action-unarchive', function(e) {
        e.stopPropagation();
        console.log('Unarchive action clicked');
        const chatId = String($(this).closest('.chat-item').data('chat-id'));
        console.log('Chat to unarchive:', chatId);
        const history = getChatHistory();
        const chat = history.find(c => String(c.id) === chatId);
        
        if (chat) {
            chat.isArchived = false;
            console.log('Chat unarchived');
            saveChatHistory(history);
            renderChatHistory();
            renderArchivedChatsModal(); // به‌روزرسانی مودال آرشیو
        }
    });
    
    // فانکشن رندر کردن چت‌های آرشیو شده در مودال
    function renderArchivedChatsModal() {
        const history = getChatHistory();
        const archivedChats = history.filter(chat => chat.isArchived);
        const $archivedList = $('#archivedChatsList');
        
        if (archivedChats.length === 0) {
            $archivedList.html('<p class="text-muted text-center py-4">هیچ گفت‌وگوی آرشیو شده‌ای وجود ندارد</p>');
            return;
        }
        
        const archivedHtml = archivedChats.map(chat => `
            <div class="archived-chat-item p-3 mb-2 rounded d-flex align-items-center gap-3" style="background-color: rgba(255,255,255,0.05);" data-chat-id="${chat.id}">
                <div class="avatar rounded" style="width: 40px; height: 40px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;">
                    <img src="/model_icons/gapgpt-icon-v3.png" alt="GapGPT" style="width: 32px; height: 32px; border-radius: 4px;" onerror="this.style.display='none'">
                </div>
                <div class="flex-grow-1">
                    <div class="fw-semibold">${chat.title}</div>
                    <div class="text-muted small">${new Date(chat.createdAt).toLocaleDateString('fa-IR')}</div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-light archived-chat-rename" data-chat-id="${chat.id}" title="تغییر نام">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary archived-chat-unarchive" data-chat-id="${chat.id}" title="خروج از آرشیو">
                        <i class="bi bi-archive"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger archived-chat-delete" data-chat-id="${chat.id}" title="حذف">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        $archivedList.html(archivedHtml);
    }
    
    // باز کردن مودال آرشیو شده‌ها
    $('.settings-item button:contains("مدیریت")').on('click', function() {
        renderArchivedChatsModal();
        const archivedModal = new bootstrap.Modal(document.getElementById('archivedChatsModal'));
        archivedModal.show();
    });
    
    // خروج از آرشیو از داخل مودال
    $(document).on('click', '.archived-chat-unarchive', function(e) {
        e.stopPropagation();
        const chatId = String($(this).data('chat-id'));
        const history = getChatHistory();
        const chat = history.find(c => String(c.id) === chatId);
        
        if (chat) {
            chat.isArchived = false;
            saveChatHistory(history);
            renderChatHistory();
            renderArchivedChatsModal();
        }
    });
    
    // حذف چت آرشیو شده
    $(document).on('click', '.archived-chat-delete', function(e) {
        e.stopPropagation();
        const chatId = String($(this).data('chat-id'));
        chatToDelete = chatId;
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteChatModal'));
        deleteModal.show();
        
        // به‌روزرسانی مودال آرشیو بعد از حذف
        $('#deleteChatModal').on('hidden.bs.modal', function() {
            renderArchivedChatsModal();
        });
    });
    
    // تغییر نام چت آرشیو شده
    let chatToRename = null;
    
    $(document).on('click', '.archived-chat-rename', function(e) {
        e.stopPropagation();
        const chatId = String($(this).data('chat-id'));
        const history = getChatHistory();
        const chat = history.find(c => String(c.id) === chatId);
        
        if (chat) {
            chatToRename = chatId;
            $('#chatNewName').val(chat.title);
            const renameModal = new bootstrap.Modal(document.getElementById('renameChatModal'));
            renameModal.show();
            
            // فوکوس روی اینپوت بعد از باز شدن مودال
            $('#renameChatModal').on('shown.bs.modal', function() {
                $('#chatNewName').focus().select();
            });
        }
    });
    
    // تغییر نام
    $(document).on('click', '.chat-action-rename', function(e) {
        e.stopPropagation();
        console.log('Rename action clicked');
        const chatItem = $(this).closest('.chat-item');
        const chatId = String(chatItem.data('chat-id'));
        console.log('Chat to rename:', chatId);
        const history = getChatHistory();
        const chat = history.find(c => String(c.id) === chatId);
        
        if (chat) {
            chatToRename = chatId;
            $('#chatNewName').val(chat.title);
            const renameModal = new bootstrap.Modal(document.getElementById('renameChatModal'));
            renameModal.show();
            
            // فوکوس روی اینپوت بعد از باز شدن مودال
            $('#renameChatModal').on('shown.bs.modal', function() {
                $('#chatNewName').focus().select();
            });
        }
    });
    
    
    // Package Purchase Section Navigation
    $('.upgrade-section').on('click', function() {
        $('#chat-section').hide();
        $('#package-purchase-section').show();
    });
    
    // Toggle between personal and organizational plans
    $('.plan-btn-container button').on('click', function() {
        $('.plan-btn-container button').removeClass('selected-mode-btn').addClass('default-mode-btn');
        $(this).removeClass('default-mode-btn').addClass('selected-mode-btn');
    });

    // اضافه کردن نمایشگر فایل‌ها
    function addFileDisplay() {
        if ($('.files-preview').length === 0) {
            $('.input-wrapper').prepend('<div class="files-preview d-flex flex-wrap gap-2 mb-3"></div>');
        }
    }

    // نمایش فایل در پیش‌نمایش
    function displayFile(file) {
        addFileDisplay();
        
        const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const fileSize = (file.size / 1024).toFixed(2);
        const fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
        
        let fileIcon = 'bi-file-earmark';
        if (file.type.startsWith('image/')) fileIcon = 'bi-file-image';
        else if (file.type.startsWith('video/')) fileIcon = 'bi-file-play';
        else if (file.type.includes('pdf')) fileIcon = 'bi-file-pdf';
        else if (file.type.includes('word')) fileIcon = 'bi-file-word';
        else if (file.type.includes('excel') || file.type.includes('spreadsheet')) fileIcon = 'bi-file-excel';
        
        const fileHTML = `
            <div class="file-item rounded-3 p-2 d-flex align-items-center gap-2" data-file-id="${fileId}">
                <i class="bi ${fileIcon} fs-5"></i>
                <div class="file-info">
                    <div class="file-name text-white" style="font-size: 0.85rem;">${fileName}</div>
                    <div class="file-size text-muted" style="font-size: 0.75rem;">${fileSize} KB</div>
                </div>
                <button class="btn btn-sm btn-close btn-close-white ms-auto remove-file" type="button"></button>
            </div>
        `;
        
        $('.files-preview').append(fileHTML);
        attachedFiles.push({ id: fileId, file: file });
    }

    // حذف فایل
    $(document).on('click', '.remove-file', function() {
        const fileItem = $(this).closest('.file-item');
        const fileId = fileItem.data('file-id');
        
        attachedFiles = attachedFiles.filter(f => f.id !== fileId);
        fileItem.remove();
        
        if (attachedFiles.length === 0) {
            $('.files-preview').remove();
        }
    });

    // Drag & Drop
    const $textarea = $('.input-wrapper');
    
    $textarea.on('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('drag-active');
    });

    $textarea.on('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-active');
    });

    $textarea.on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-active');
        
        const files = e.originalEvent.dataTransfer.files;
        
        if (files.length > 0) {
            $.each(files, function(index, file) {
                displayFile(file);
            });
        }
    });

    // Paste
    $(document).on('paste', function(e) {
        const items = e.originalEvent.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) {
                    displayFile(file);
                }
            }
        }
    });

    // دکمه انتخاب فایل
    $('.btn-outline-light.btn-sm.rounded-circle:first').on('click', function() {
        const fileInput = $('<input type="file" multiple style="display: none;">');
        
        fileInput.on('change', function() {
            const files = this.files;
            $.each(files, function(index, file) {
                displayFile(file);
            });
        });
        
        fileInput.trigger('click');
    });

    // Temp Chat Button Toggle
    let isTempChatActive = false;
    
    $('.temp-chat-trigger').on('click', function(e) {
        e.stopPropagation();
        isTempChatActive = !isTempChatActive;
        
        if (isTempChatActive) {
            // اکتیو کردن دکمه
            $(this).css({
                'background-color': 'rgba(97, 94, 235, 0.2)',
                'color': 'rgb(97, 94, 235)',
                'border-radius': '50%',
                'padding': '8px'
            });
            
            // تغییر عنوان
            $('#mainTitle').text('گفت‌و‌گوی موقت');
            
            // نمایش توضیحات
            $('#tempChatDescription').fadeIn(300);
            
            // مخفی کردن چیپس‌ها
            $('.startup-features').addClass('hide-chips');
            $('.mobile-chips').addClass('hide-chips');
        } else {
            // غیرفعال کردن دکمه
            $(this).css({
                'background-color': 'transparent',
                'color': 'white',
                'padding': '8px'
            });
            
            // برگرداندن عنوان
            $('#mainTitle').text('چطور می‌توانم به شما کمک کنم؟');
            
            // مخفی کردن توضیحات
            $('#tempChatDescription').fadeOut(300);
            
            // نمایش چیپس‌ها
            $('.startup-features').removeClass('hide-chips');
            $('.mobile-chips').removeClass('hide-chips');
        }
    });
    
    // Toggle between voice/soundwave and send button based on input
    $('#chatTextarea').on('input', function() {
        const hasText = $(this).val().trim().length > 0;
        
        if (hasText) {
            // مخفی کردن دکمه صدا و soundwave
            $('#voiceBtn').hide();
            $('#soundwaveBtn').hide();
            // نمایش دکمه ارسال
            $('#sendMessageBtn').show();
        } else {
            // نمایش دکمه صدا و soundwave
            $('#voiceBtn').show();
            $('#soundwaveBtn').show();
            // مخفی کردن دکمه ارسال
            $('#sendMessageBtn').hide();
        }
    });

    // ارسال فرم
    let isFirstMessage = true;
    let isGenerating = false;
    let currentGenerationTimeout = null;
    
    function sendMessage() {
        // اگر در حال تولید پاسخ است، نباید پیام جدید بفرستیم
        if (isGenerating) {
            return;
        }
        
        const message = $('.input-wrapper textarea').val().trim();
        
        if (message || attachedFiles.length > 0) {
            console.log('پیام:', message);
            console.log('فایل‌های پیوست:', attachedFiles);
            
            // اگر اولین پیام است
            if (isFirstMessage) {
                // ایجاد چت جدید
                createNewChat(message);
                
                // حذف چیپس‌ها و هدر
                $('.startup-features').remove();
                $('.startup-header').remove();
                
                // نمایش container پیام‌ها
                $('#chatMessagesContainer').show();
                
                // محاسبه right بر اساس وضعیت سایدبار
                const sidebarWidth = $('.sidebar-drawer').hasClass('collapsed') ? 0 : 300;
                
                // انتقال فرم به پایین
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
                        'z-index': '100',
                        'transition': 'right 0.2s ease'
                    });
                
                $('.input-suggestions-container')
                    .css({
                        'max-width': '900px',
                        'margin': '0 auto'
                    });
                
                // به‌روزرسانی هیستوری
                renderChatHistory();
                
                // نمایش دکمه اشتراک‌گذاری
                $('#shareBtn').fadeIn(300);
                
                isFirstMessage = false;
            }
            
            // ذخیره پیام کاربر
            if (currentChatId) {
                addMessageToChat(currentChatId, message, 'user');
                renderMessages(currentChatId);
                
                // پاک کردن فرم
                $('.input-wrapper textarea').val('');
                attachedFiles = [];
                $('.files-preview').remove();
                
                // تغییر حالت به generating
                isGenerating = true;
                
                // نمایش دکمه send و تغییر به stop
                $('#sendMessageBtn').show();
                $('#voiceBtn').hide();
                $('#soundwaveBtn').hide();
                updateSendButtonState();
                
                // شبیه‌سازی پاسخ API
                currentGenerationTimeout = setTimeout(() => {
                    const assistantResponse = 'من پیام شما را دریافت کردم: "' + message + '"';
                    addMessageToChat(currentChatId, assistantResponse, 'assistant');
                    renderMessages(currentChatId);
                    console.log('API Response:', assistantResponse);
                    
                    // برگرداندن حالت عادی
                    isGenerating = false;
                    currentGenerationTimeout = null;
                    updateSendButtonState();
                }, 3000); // زمان بیشتر برای نمایش بهتر loading
            }
        }
    }
    // تابع به‌روزرسانی حالت دکمه ارسال
    function updateSendButtonState() {
        const $sendBtn = $('#sendMessageBtn');
        
        if (isGenerating) {
            // تغییر به دکمه Stop
            $sendBtn.html('<i class="bi bi-stop-fill" style="font-size: 20px; font-weight: bold;"></i>');
            $sendBtn.css('border-radius', '8px'); // تغییر به مربع
            $sendBtn.show();
            
            // غیرفعال کردن textarea
            $('#chatTextarea').prop('disabled', true).css('opacity', '0.6');
        } else {
            // برگرداندن به دکمه Send
            $sendBtn.html('<i class="bi bi-arrow-up" style="font-size: 20px; font-weight: bold;"></i>');
            $sendBtn.css('border-radius', '50%'); // برگرداندن به دایره
            $sendBtn.hide();
            
            // نمایش دکمه‌های صدا
            $('#voiceBtn').show();
            $('#soundwaveBtn').show();
            
            // فعال کردن textarea
            $('#chatTextarea').prop('disabled', false).css('opacity', '1');
        }
    }
    
    // ارسال با کلیک روی دکمه
    $('#sendMessageBtn').on('click', function() {
        if (isGenerating) {
            // متوقف کردن تولید پاسخ
            if (currentGenerationTimeout) {
                clearTimeout(currentGenerationTimeout);
                currentGenerationTimeout = null;
            }
            
            // اضافه کردن پیام جزئی که تا الان تولید شده
            if (currentChatId) {
                const partialResponse = 'پاسخ متوقف شد توسط کاربر...';
                addMessageToChat(currentChatId, partialResponse, 'assistant');
                renderMessages(currentChatId);
            }
            
            isGenerating = false;
            updateSendButtonState();
            console.log('تولید پاسخ متوقف شد');
        } else {
            sendMessage();
        }
    });

    // ارسال با اینتر (Shift+Enter برای خط جدید)
    $('#chatTextarea').on('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isGenerating) {
                sendMessage();
            }
        }
    });

    // === Sidebar Functions ===
    
    // گفت‌وگو جدید
    $('.drawer-header .btn-link:last').on('click', function() {
        console.log('شروع گفت‌وگو جدید');
        $('.input-wrapper textarea').val('');
        attachedFiles = [];
        $('.files-preview').remove();
        $('.input-wrapper textarea').focus();
    });

    // کلیک روی لیست مدل‌ها
    $('.drawer-item').eq(0).on('click', function() {
        console.log('باز کردن لیست مدل‌ها');
        // اینجا می‌تونی مودال یا صفحه جدید باز کنی
    });

    // کلیک روی جستجو در دستیار‌ها
    $('.drawer-item').eq(1).on('click', function() {
        console.log('جستجو در دستیار‌ها');
        // اینجا می‌تونی صفحه جستجو باز کنی
    });
    
    // دکمه اشتراک‌گذاری
    $('#shareBtn').on('click', function() {
        console.log('اشتراک‌گذاری گفت‌و‌گو');
        // اینجا می‌توانید لینک اشتراک‌گذاری یا مودال را نمایش دهید
    });

    // کلیک روی چت هیستوری
    $(document).on('click', '.chat-item', function(e) {
        // جلوگیری از باز شدن چت وقتی روی action button کلیک می‌شود
        if ($(e.target).closest('.chat-actions').length || $(e.target).closest('.chat-context-menu').length) {
            return;
        }
        
        const chatTitle = $(this).find('.chat-item-text').text();
        console.log('باز کردن چت:', chatTitle);
        // اینجا می‌تونی چت رو باز کنی
    });

    // کلیک روی ارتقا بسته
    $('.upgrade-section').on('click', function() {
        console.log('باز کردن صفحه ارتقا');
        // اینجا می‌تونی به صفحه ارتقا هدایت کنی
    });

    // دکمه جستجو در هدر
    $('.drawer-header .btn-link').eq(1).on('click', function() {
        console.log('باز کردن جستجو');
        // اینجا می‌تونی فیلد جستجو نمایش بدی
    });

    // Sidebar Toggle (Desktop) - دکمه فیکس در گوشه
    $('#sidebarToggle').click(function() {
        const isClosed = $('.sidebar-drawer').hasClass('collapsed');
        
        if (isClosed) {
            // باز کردن سایدبار
            $('.sidebar-drawer').removeClass('collapsed');
            $(this).hide();
            
            // تنظیم کانتنت و فرم footer (فقط در دسکتاپ)
            if ($(window).width() > 768) {
                $('.main-content').css('margin-right', '300px');
                $('.chat-input-footer').css('right', '300px');
                $('#desktopSidebarToggle').hide();
            }
        }
    });
    
    // Desktop Sidebar Toggle in Navbar
    $('#desktopSidebarToggle').click(function() {
        // باز کردن سایدبار
        $('.sidebar-drawer').removeClass('collapsed');
        $(this).hide();
        
        // تنظیم کانتنت و فرم footer (فقط در دسکتاپ)
        if ($(window).width() > 768) {
            $('.main-content').css('margin-right', '300px');
            $('.chat-input-footer').css('right', '300px');
        }
    });
    
    // Mobile Menu Icon Toggle
    $('#mobileMenuIcon').click(function() {
        $('.sidebar-drawer').removeClass('collapsed');
        $('#sidebarOverlay').addClass('show');
    });
    
    // دکمه بستن سایدبار
    $('.drawer-header .btn-link').first().click(function() {
        $('.sidebar-drawer').addClass('collapsed');
        $('#sidebarOverlay').removeClass('show');
        
        // تنظیم کانتنت و فرم footer و نمایش دکمه toggle (فقط در دسکتاپ)
        if ($(window).width() > 768) {
            $('#sidebarToggle').show();
            $('#desktopSidebarToggle').show();
            $('.main-content').css('margin-right', '0');
            $('.chat-input-footer').css('right', '0');
        }
    });
    
    // بستن سایدبار با کلیک روی overlay
    $('#sidebarOverlay').click(function() {
        $('.sidebar-drawer').addClass('collapsed');
        $(this).removeClass('show');
        
        if ($(window).width() > 768) {
            $('#sidebarToggle').show();
            $('#desktopSidebarToggle').show();
            $('.main-content').css('margin-right', '0');
            $('.chat-input-footer').css('right', '0');
        }
    });

    // Model Menu Toggle
    $('#modelSelector').click(function(e) {
        e.stopPropagation();
        const menu = $('#modelMenu');
        const arrow = $('.model-arrow');
        
        menu.toggleClass('show');
        arrow.toggleClass('rotated');
    });

    // Close model menu when clicking outside
    $(document).click(function(e) {
        const menu = $('#modelMenu');
        const selector = $('#modelSelector');
        
        if (!menu.is(e.target) && menu.has(e.target).length === 0 && 
            !selector.is(e.target) && selector.has(e.target).length === 0) {
            menu.removeClass('show');
            $('.model-arrow').removeClass('rotated');
        }
    });

    // Model menu item click handlers
    $('.model-item-clickable').click(function(e) {
        e.stopPropagation();
        
        // Remove active state from all items
        $('.model-item-clickable').removeClass('model-item-active');
        
        // Add active state to clicked item
        $(this).addClass('model-item-active');
        
        // Update selected model text
        const modelName = $(this).find('.fw-bold').first().text();
        $('.model-selector .model').text(modelName);
        
        // Close menu
        $('#modelMenu').removeClass('show');
        $('.model-arrow').removeClass('rotated');
        
        console.log('Model selected:', modelName);
    });

    // Tools Menu Toggle
    $('#toolsMenuBtn').click(function(e) {
        e.stopPropagation();
        $('#toolsMenu').toggleClass('show');
    });

    // Close tools menu when clicking outside
    $(document).click(function(e) {
        const toolsMenu = $('#toolsMenu');
        const toolsBtn = $('#toolsMenuBtn');
        
        if (!toolsMenu.is(e.target) && toolsMenu.has(e.target).length === 0 && 
            !toolsBtn.is(e.target) && toolsBtn.has(e.target).length === 0) {
            toolsMenu.removeClass('show');
        }
    });

    // Tools menu item click handlers
    $('.tools-menu-item').click(function(e) {
        e.stopPropagation();
        
        const toolName = $(this).find('span').text();
        console.log('Tool selected:', toolName);
        
        // Close menu
        $('#toolsMenu').removeClass('show');
        
        // You can add specific functionality for each tool here
    });

    // Search Dialog
    // دکمه جستجو در سایدبار
    $('.drawer-header .btn-link').eq(1).click(function() {
        $('#searchBackdrop').addClass('show');
        $('#searchDialog').addClass('show');
        setTimeout(function() {
            $('#searchInput').focus();
        }, 100);
    });

    // بستن مودال با کلیک روی backdrop
    $('#searchBackdrop').click(function() {
        $('#searchBackdrop').removeClass('show');
        $('#searchDialog').removeClass('show');
    });

    // جلوگیری از بستن با کلیک درون مودال
    $('#searchDialog').click(function(e) {
        e.stopPropagation();
    });

    // بستن با ESC
    $(document).keydown(function(e) {
        if (e.key === 'Escape' && $('#searchDialog').hasClass('show')) {
            $('#searchBackdrop').removeClass('show');
            $('#searchDialog').removeClass('show');
            // پاک کردن ورودی جستجو
            $('#searchInput').val('');
            $('.search-empty-state').show();
            $('#searchResults').hide();
            $('#searchNoResults').hide();
        }
    });
    
    // جستجو در گفت‌و‌گوها
    $('#searchInput').on('input', function() {
        const searchTerm = $(this).val().trim().toLowerCase();
        
        if (!searchTerm) {
            // نمایش حالت خالی
            $('.search-empty-state').show();
            $('#searchResults').hide();
            $('#searchNoResults').hide();
            return;
        }
        
        // جستجو در چت‌ها
        const history = getChatHistory();
        const results = [];
        
        history.forEach(chat => {
            // جستجو در عنوان
            const titleMatch = chat.title.toLowerCase().includes(searchTerm);
            
            // جستجو در متن پیام‌ها
            let messageMatches = [];
            if (chat.messages && chat.messages.length > 0) {
                chat.messages.forEach((msg, index) => {
                    if (msg.content.toLowerCase().includes(searchTerm)) {
                        messageMatches.push({
                            index: index,
                            content: msg.content,
                            role: msg.role
                        });
                    }
                });
            }
            
            if (titleMatch || messageMatches.length > 0) {
                results.push({
                    chat: chat,
                    titleMatch: titleMatch,
                    messageMatches: messageMatches
                });
            }
        });
        
        // نمایش نتایج
        if (results.length > 0) {
            displaySearchResults(results, searchTerm);
            $('.search-empty-state').hide();
            $('#searchResults').show();
            $('#searchNoResults').hide();
        } else {
            $('.search-empty-state').hide();
            $('#searchResults').hide();
            $('#searchNoResults').show();
        }
    });
    
    // نمایش نتایج جستجو
    function displaySearchResults(results, searchTerm) {
        const $resultsList = $('#searchResultsList');
        $resultsList.empty();
        
        results.forEach(result => {
            const chat = result.chat;
            let resultHtml = `
                <div class="search-result-item p-3 mb-2" data-chat-id="${chat.id}" style="cursor: pointer; background-color: rgba(255,255,255,0.05); border-radius: 8px; transition: background-color 0.2s;">
                    <div class="d-flex align-items-start gap-2">
                        <div class="avatar rounded" style="width: 32px; height: 32px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <img src="/model_icons/gapgpt-icon-v3.png" alt="GapGPT" style="width: 24px; height: 24px; border-radius: 4px;" onerror="this.style.display='none'">
                        </div>
                        <div class="flex-grow-1">
                            <div class="fw-semibold mb-1">${highlightText(chat.title, searchTerm)}</div>
            `;
            
            // نمایش تعداد پیام‌های پیدا شده
            if (result.messageMatches.length > 0) {
                resultHtml += `<div class="text-muted small mb-1">${result.messageMatches.length} پیام پیدا شد</div>`;
                
                // نمایش اولین پیام مچ شده
                const firstMatch = result.messageMatches[0];
                const snippet = getTextSnippet(firstMatch.content, searchTerm, 100);
                resultHtml += `<div class="text-muted small" style="opacity: 0.7;">${highlightText(snippet, searchTerm)}</div>`;
            }
            
            resultHtml += `
                        </div>
                    </div>
                </div>
            `;
            
            $resultsList.append(resultHtml);
        });
        
        // کلیک روی نتیجه جستجو
        $('.search-result-item').on('click', function() {
            const chatId = $(this).data('chat-id');
            console.log('باز کردن چت:', chatId);
            // بستن دیالوگ جستجو
            $('#searchBackdrop').removeClass('show');
            $('#searchDialog').removeClass('show');
            // اینجا می‌تونید چت رو باز کنید
        });
        
        // Hover effect
        $('.search-result-item').hover(
            function() {
                $(this).css('background-color', 'rgba(255,255,255,0.1)');
            },
            function() {
                $(this).css('background-color', 'rgba(255,255,255,0.05)');
            }
        );
    }
    
    // Highlight متن جستجو شده
    function highlightText(text, searchTerm) {
        if (!searchTerm) return text;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark style="background-color: rgb(97, 94, 235); color: white; padding: 2px 4px; border-radius: 3px;">$1</mark>');
    }
    
    // گرفتن snippet از متن
    function getTextSnippet(text, searchTerm, maxLength) {
        const lowerText = text.toLowerCase();
        const lowerSearchTerm = searchTerm.toLowerCase();
        const index = lowerText.indexOf(lowerSearchTerm);
        
        if (index === -1) return text.substring(0, maxLength) + '...';
        
        const start = Math.max(0, index - 30);
        const end = Math.min(text.length, index + searchTerm.length + 70);
        
        let snippet = text.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        
        return snippet;
    }
    
    // دکمه داخل سایدبار برای بستن
    $('.drawer-header .btn-link').eq(0).on('click', function() {
        $('.sidebar-drawer').addClass('collapsed');
        $('#sidebarOverlay').removeClass('show');
        
        // تنظیم کانتنت و فرم footer و نمایش دکمه toggle (فقط در دسکتاپ)
        if ($(window).width() > 768) {
            $('#sidebarToggle').show();
            $('.main-content').css('margin-right', '0');
            $('.chat-input-footer').css('right', '0');
        }
    });

    // === User Menu Functions ===
    
    // باز/بستن منوی کاربری
    $('.user-menu-trigger').on('click', function(e) {
        e.stopPropagation();
        const $menu = $('#userMenu');
        
        if ($menu.hasClass('show')) {
            // بستن منو
            $menu.removeClass('show');
            setTimeout(function() {
                $menu.hide();
            }, 300); // زمان انیمیشن fade
        } else {
            // باز کردن منو
            $menu.show();
            setTimeout(function() {
                $menu.addClass('show');
            }, 10);
        }
    });

    // بستن منو با کلیک بیرون از منو
    $(document).on('click', function(e) {
        const $menu = $('#userMenu');
        if (!$(e.target).closest('.user-menu').length && !$(e.target).hasClass('user-menu-trigger')) {
            if ($menu.hasClass('show')) {
                $menu.removeClass('show');
                setTimeout(function() {
                    $menu.hide();
                }, 300);
            }
        }
    });

    // جلوگیری از بسته شدن منو با کلیک داخل منو
    $('#userMenu').on('click', function(e) {
        e.stopPropagation();
    });

    // بستن منو بعد از کلیک روی گزینه‌ها
    $('#userMenu .list-group-item-action').on('click', function(e) {
        e.preventDefault();
        const actionText = $(this).find('.menu-label').text().trim();
        console.log('کلیک روی:', actionText);
        
        // بستن منو با انیمیشن
        const $menu = $('#userMenu');
        $menu.removeClass('show');
        setTimeout(function() {
            $menu.hide();
        }, 300);
        
        // اینجا می‌تونی عملیات مربوط به هر گزینه رو اضافه کنی
    });

    // === Temporary Chat Functions ===
    
    let tempChatEnabled = false;
    
    // باز/بستن منوی Temporary Chat
    $('.temp-chat-trigger').on('click', function(e) {
        e.stopPropagation();
        const $menu = $('#tempChatMenu');
        const $userMenu = $('#userMenu');
        
        // بستن منوی کاربری اگر باز بود
        if ($userMenu.hasClass('show')) {
            $userMenu.removeClass('show');
            setTimeout(function() {
                $userMenu.hide();
            }, 300);
        }
        
        if ($menu.hasClass('show')) {
            // بستن منو
            $menu.removeClass('show');
            setTimeout(function() {
                $menu.hide();
            }, 300);
        } else {
            // باز کردن منو
            $menu.show();
            setTimeout(function() {
                $menu.addClass('show');
            }, 10);
        }
    });

    // تغییر وضعیت سوییچ
    $('#tempChatSwitch').on('change', function() {
        tempChatEnabled = $(this).is(':checked');
        
        if (tempChatEnabled) {
            $('.temp-chat-trigger').addClass('active');
            console.log('چت موقت فعال شد');
        } else {
            $('.temp-chat-trigger').removeClass('active');
            console.log('چت موقت غیرفعال شد');
        }
    });

    // بستن منوی temp chat با کلیک بیرون
    $(document).on('click', function(e) {
        const $menu = $('#tempChatMenu');
        if (!$(e.target).closest('.temp-chat-menu').length && 
            !$(e.target).hasClass('temp-chat-trigger') &&
            !$(e.target).closest('.temp-chat-trigger').length) {
            if ($menu.hasClass('show')) {
                $menu.removeClass('show');
                setTimeout(function() {
                    $menu.hide();
                }, 300);
            }
        }
    });

    // جلوگیری از بسته شدن منو با کلیک داخل منو
    $('#tempChatMenu').on('click', function(e) {
        e.stopPropagation();
    });

    // لینک "بیشتر بدانید"
    $('.temp-chat-learn-more').on('click', function(e) {
        e.preventDefault();
        console.log('باز کردن صفحه اطلاعات چت موقت');
        // اینجا می‌تونی به صفحه راهنما هدایت کنی
    });

    // بستن منوی temp chat وقتی منوی user باز میشه
    $('.user-menu-trigger').on('click', function() {
        const $tempMenu = $('#tempChatMenu');
        if ($tempMenu.hasClass('show')) {
            $tempMenu.removeClass('show');
            setTimeout(function() {
                $tempMenu.hide();
            }, 300);
        }
    });

    // === Settings Modal Functions ===
    
    // باز کردن مودال تنظیمات
    $('#userMenu .list-group-item-action').filter(function() {
        return $(this).find('.menu-label').text().trim() === 'تنظیمات';
    }).on('click', function(e) {
        e.preventDefault();
        
        // بستن منوی کاربری
        const $userMenu = $('#userMenu');
        $userMenu.removeClass('show');
        setTimeout(function() {
            $userMenu.hide();
        }, 300);
        
        // باز کردن مودال با تب عمومی
        const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
        settingsModal.show();
    });

    // باز کردن مودال با تب شخصی‌سازی
    $('#userMenu .list-group-item-action').filter(function() {
        return $(this).find('.menu-label').text().trim() === 'شخصی‌سازی';
    }).on('click', function(e) {
        e.preventDefault();
        
        // بستن منوی کاربری
        const $userMenu = $('#userMenu');
        $userMenu.removeClass('show');
        setTimeout(function() {
            $userMenu.hide();
        }, 300);
        
        // باز کردن مودال
        const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
        settingsModal.show();
        
        // تغییر به تب شخصی‌سازی بعد از باز شدن مودال
        $('#settingsModal').one('shown.bs.modal', function() {
            $('.settings-menu-item').removeClass('active');
            $('.settings-menu-item[data-tab="personalize"]').addClass('active');
            $('.settings-tab').hide();
            $('#tab-personalize').show();
        });
    });

    // تعویض تب‌های تنظیمات
    $('.settings-menu-item').on('click', function(e) {
        e.preventDefault();
        
        // حذف active از همه آیتم‌ها
        $('.settings-menu-item').removeClass('active');
        $(this).addClass('active');
        
        // پنهان کردن همه تب‌ها
        $('.settings-tab').hide();
        
        // نمایش تب مورد نظر
        const tabId = $(this).data('tab');
        $('#tab-' + tabId).show();
    });

    // بستن مودال با کلیک بیرون (خود Bootstrap این قابلیت رو داره)
    // با data-bs-backdrop="true" (پیش‌فرض)

    // ریست کردن تب به عمومی وقتی مودال بسته میشه
    $('#settingsModal').on('hidden.bs.modal', function() {
        $('.settings-menu-item').removeClass('active');
        $('.settings-menu-item[data-tab="general"]').addClass('active');
        $('.settings-tab').hide();
        $('#tab-general').show();
    });

    // === Personalization Tab Functions ===
    
    // کلیک روی چیپ‌های شخصیت
    $(document).on('click', '.personality-chip', function() {
        const chipText = $(this).text();
        const $textarea = $('.instruction-section textarea');
        const currentValue = $textarea.val();
        
        if (chipText !== '...') {
            // اضافه کردن متن چیپ به textarea
            const newValue = currentValue ? currentValue + ', ' + chipText : chipText;
            $textarea.val(newValue);
            console.log('چیپ اضافه شد:', chipText);
        }
    });

    // === FAQ Functions ===
    
    // دیتای سوالات
    const faqData = {
        packages: {
            title: 'بسته‌ها و خرید',
            questions: [
                {
                    q: 'فعال شدن بسته چه مدت زمان می‌برد؟',
                    a: 'به محض تکمیل فرآیند خرید، بستهٔ شما به‌صورت خودکار فعال می‌شود و امکان استفاده بلافاصله فراهم است.'
                },
                {
                    q: 'آیا حساب‌ها شخصی و اختصاصی هستند یا اشتراکی؟',
                    a: 'حساب‌ها کاملاً شخصی و اختصاصی هستند. حتی در نسخهٔ رایگان نیز تنها خودِ شما به تاریخچهٔ گفتگوهای خود دسترسی دارید.'
                },
                {
                    q: 'حریم خصوصی در گپ‌جی‌پی‌تی چگونه است و آیا به محتوای چت‌ها دسترسی دارید؟',
                    a: `محتوای گفتگو صرفاً به‌منظور نمایش تاریخچه به شما در پایگاه داده امن و خصوصی ذخیره می‌شود و با حذف گفتگو، محتوای آن بلافاصله از پایگاه داده پاک می‌شود.

                    همچنین با استفاده از قابلیت چت موقت، می‌توانید بدون ذخیره‌سازی محتوا گفتگو کنید.
                    
                    برای مطالعهٔ توضیحات کامل قوانین و حریم خصوصی، لطفاً به صفحهٔ «قوانین و حریم خصوصی» مراجعه فرمایید: https://gapgpt.app/rules">https://gapgpt.app/rules`
                },
                {
                    q: `تفاوت گپ‌جی‌پی‌تی با چت‌جی‌پی‌تی چیست؟`,
                    a: `ما یک تیم کوچک از دانشجویان دانشگاه شریف هستیم که دسترسی به انواع مدل‌های هوش مصنوعی را برای شما فراهم می‌کنیم. تفاوت‌های کلیدی ما عبارت‌اند از:

                    کیفیت یکسان: ما از APIهای رسمی شرکت‌های سازنده مانند OpenAI استفاده می‌کنیم، بنابراین کیفیت پاسخ‌ها تفاوتی با سرویس‌های اصلی ندارد.
                    زیرساخت داخلی: با میزبانی زیرساخت‌ها در ایران، هزینه‌ها کاهش یافته و قیمت‌گذاری متناسب با شرایط داخلی ارائه می‌شود.
                    پرداخت آسان: امکان پرداخت ریالی بدون نیاز به حساب‌های بین‌المللی فراهم است.
                    عدم نیاز به ابزار تحریم‌شکن: سرویس‌های ما بدون نیاز به VPN در دسترس هستند.
                    پشتیبانی فارسی: تیم پشتیبانی ما به زبان فارسی آمادهٔ پاسخگویی است.
                    شما می‌توانید برای اطمینان از کیفیت، پاسخ‌های دریافتی را با سرویس‌های اصلی مقایسه فرمایید.`
                },
                {
                    q: `چه تعداد تصویر می‌توانم تولید کنم؟`,
                    a: `پیام‌های متنی و تصویری در محاسبهٔ محدودیت مصرف تفاوتی ندارند و هر دو از سهمیهٔ کل پیام شما کسر می‌شوند. در بستهٔ پلاس تا ۵۰ پیام و در بستهٔ پرو تا ۱۵۰ پیام (شامل متن و تصویر) در هر سه ساعت قابل ارسال است.`
                },
                {
                    q: `آیا پس از خرید بستهٔ پلاس امکان ارتقا به پرو وجود دارد؟`,
                    a: `بله، ارتقای بسته در هر زمان امکان‌پذیر است. مبلغ باقیمانده از بستهٔ فعلی به‌صورت خودکار از هزینه ارتقا کسر می‌شود و تنها اختلاف قیمت پرداخت می‌گردد.`
                },
                {
                    q: `محدودیت حجم و تعداد فایل‌های قابل بارگذاری چیست؟`,
                    a: `با استفاده از گزینهٔ به‌علاوه می‌توانید فایل خود را برای پردازش بارگذاری کنید.

                    محدودیت‌های بارگذاری:
                    حداکثر حجم قابل آپلود برای هر فایل: ۵۰ MB
                    محدودیتی برای تعداد فایل‌های قابل آپلود وجود ندارد.
                    ✅ فایل‌های قابل پردازش:
                    فایل‌های متنی
                    تصاویر
                    کد‌ها
                    فایل‌های ویدئویی
                    فایل‌های فشرده شده`
                },
                {
                    q: `تفاوت بستهٔ پلاس و پرو چیست؟`,
                    a: `بستهٔ پلاس برای استفادهٔ روزمره و اقتصادی طراحی شده است و دسترسی به مدل‌های عمومی را با محدودیت ۵۰ پیام در هر سه ساعت فراهم می‌کند. بستهٔ پرو برای استفادهٔ حرفه‌ای مناسب است و با محدودیت ۱۵۰ پیام در هر سه ساعت، دسترسی به مدل‌های پیشرفتهٔ استدلال و تولید تصویر را نیز ارائه می‌دهد.

                    ارتقای پلاس به پرو در هر زمان امکان‌پذیر است و مابه‌التفاوت با لحاظ ماندهٔ زمان بستهٔ فعلی محاسبه می‌شود.`
                },
                {
                    q: `سیاست بازگشت وجه چگونه است؟`,
                    a: `در صورت نارضایتی، امکان لغو اشتراک و عودت ماندهٔ اعتبار وجود دارد. وجه به همان کارت بانکی استفاده‌شده در خرید بازگردانده می‌شود. فرایند از سمت ما حداکثر طی ۲۴ تا ۴۸ ساعت کاری انجام می‌شود و تسویهٔ بانکی ممکن است چند روز کاری زمان ببرد.`
                }
            ]
        },
        features: {
            title: 'امکانات و قابلیت‌ها',
            questions: [
                {
                    q: `آیا گپ‌جی‌پی‌تی API دارد؟`,
                    a:  `بله! گپ جی‌پی‌تی دارای API است که می‌توانید برای یکپارچه‌سازی قابلیت‌های هوش مصنوعی در اپلیکیشن‌ها و سرویس‌های خود از آن استفاده کنید.

                    برای اطلاعات بیشتر و شروع استفاده از API https://gapgpt.app/platform">اینجا کلیک کنید.`
                },
                {
                    q: `'چه امکاناتی در دسترس است؟'`,
                    a: `بله. حافظهٔ بلندمدت امکان شخصی‌سازی پاسخ‌ها بر اساس ترجیحات کاربر را فراهم می‌کند.

                    نحوهٔ کار:
                    
                    نگهداشت ترجیحات و اطلاعات غیرحساس بین گفتگوها
                    شناخت سبک نوشتاری برای ارائهٔ پاسخ‌های یکپارچه
                    شخصی‌سازی نتایج بر اساس سابقهٔ تعامل
                    برای مدیریت این قابلیت به مسیر «منوی بالا سمت چپ → تنظیمات → شخصی‌سازی → حافظه» مراجعه فرمایید. در حال حاضر این قابلیت فقط برای مدل GapGPT فعال است.`
                },
                {
                    q:  `آیا قابلیت‌های مدل میدجرنی در گپ‌جی‌پی‌تی در دسترس است؟`,
                    a: `بله، تمام قابلیت‌های پیشرفتهٔ میدجرنی در دسترس است، از جمله:

                    تبدیل تصویر به تصویر (Image to Image)
                    تکرار و ویرایش تصاویر
                    تنظیم دقیق ابعاد تصاویر
                    تنظیمات پیشرفته مانند Chaos و Quality
                    برای آشنایی بیشتر با پارامترها و قابلیت‌های پیشرفته، می‌توانید به https://docs.midjourney.com/docs/parameter-list">وبسایت رسمی میدجرنی مراجعه کنید.`
                },
                {
                    q: `منظور از «تفکر بیشتر» چیست؟`,
                    a: `تفکر بیشتر (Reasoning) یک قابلیت هوشمند است که به مدل اجازه می‌دهد:

                    زمان بیشتری برای تحلیل عمیق و پردازش دقیق صرف کند
                    پاسخ‌های حرفه‌ای‌تر و منطقی‌تری ارائه دهد
                    در موارد تخصصی مانند برنامه‌نویسی، ریاضیات و تحلیل‌های پیچیده عملکرد بهتری داشته باشد
                    راه‌حل‌های خلاقانه‌تری برای مسائل دشوار ارائه دهد
                    در بسته‌ی پلاس این قابلیت از مدل o3 mini استفاده می‌کند و در بسته‌ی پرو از مدل gpt-5 pro بهره می‌برد.
                    
                    پاسخ‌دهی در این حالت کمی کندتر است، اما کیفیت و دقت پاسخ‌ها به مراتب بالاتر خواهد بود.`
                },
                {
                    q: `کاوش عمیق (Deep Research) چگونه کار می‌کند؟`,
                    a: `کاوش عمیق (Deep Research) یک قابلیت پیشرفته است که برای تحقیقات جامع طراحی شده است:

                    موارد کاربرد:
                    تحقیقات علمی و آکادمیک
                    مقایسه‌ی تخصصی محصولات
                    تحلیل روندهای بازار
                    بررسی‌های عمیق موضوعی
                    نحوهٔ عملکرد:
                    جستجوی چندمرحله‌ای در منابع معتبر
                    تحلیل و ترکیب داده‌های به‌روز
                    ارائه‌ی نتایج با استناد به منابع
                    نکته: به دلیل عمق تحلیل و حجم داده‌ها، هر پاسخ ممکن است تا ۳۰ دقیقه زمان نیاز داشته باشد.
                    
                    این قابلیت در حال حاضر برای مشترکین بسته‌های پرو و سازمانی فعال است.`
                },
                {
                    q: `آیا در گپ‌جی‌پی‌تی به Canvas دسترسی دارم؟`,
                    a: `بله! قابلیت Canvas برای ویرایش پاسخ‌های مدل در دسترس است. این ابزار در واقع همان بخش Canvas در سایت چت جی‌پی‌تی است که به شما امکان می‌دهد:

                    ویرایش متن پاسخ‌ها
                    شخصی‌سازی فرمت و ظاهر
                    افزودن توضیحات
                    ساخت گزارش از پاسخ‌ها
                    برای اطلاعات بیشتر می‌توانید به https://openai.com/index/introducing-canvas/" rel="nofollow noopener">این لینک مراجعه کنید.`
                },
                {
                    q: `آیا در گپ‌جی‌پی‌تی به Artifacts (مانند Claude) دسترسی دارم؟`,
                    a: `بله! قابلیت Artifacts که امکان اجرای کامپوننت‌های HTML را فراهم می‌کند، در گپ‌جی‌پی‌تی نیز در دسترس است.

                    قابلیت‌های Artifacts:
                    نمایش محتوای تعاملی
                    اجرای کدهای HTML پویا
                    ایجاد رابط‌های کاربری ساده
                    برای فعال‌سازی این قابلیت در منوی ابزارها روی آن کلیک کنید.`
                },
                {
                    q: `منظور از دستیار (Custom GPT) چیست و چگونه کار می‌کند؟`,
                    a: `دستیار (Assistant) معادل قابلیت Custom GPT است که به شما اجازه می‌دهد مدل را با اطلاعات و دستورالعمل‌های اختصاصی خود شخصی‌سازی کنید.

                    برای مثال، می‌توانید اسناد یک پروژه یا محتوای یک کتاب را در اختیار دستیار قرار دهید تا پاسخ‌های خود را همواره بر اساس آن اطلاعات ارائه دهد. این کار با افزودن خودکار دستورالعمل‌ها و دانش شما به هر درخواست انجام می‌شود تا پاسخ‌ها دقیق و مرتبط باشند.
                    
                    برای اطلاعات بیشتر https://openai.com/index/introducing-gpts/"> اینجا رو مشاهده کنید.`
                },
                {
                    q: `حالت گفت‌وگوی صوتی چگونه فعال می‌شود و محدودیت‌ها چیست؟`,
                    a: `حالت گفتگوی صوتی در مدل GapGPT فعال است. برای استفاده، دکمهٔ حالت صوتی را در جعبهٔ گفتگو انتخاب کنید، سپس «شروع مکالمه» را بزنید و منتظر نمایش میکروفون سبز بمانید.

                    بستهٔ پلاس: ۵۰ پیام (متنی یا صوتی) در هر سه ساعت
                    بستهٔ پرو: ۱۵۰ پیام (متنی یا صوتی) در هر سه ساعت
                    در صورت بروز مشکل، دسترسی میکروفون در تنظیمات دستگاه/مرورگر و پایداری اتصال اینترنت را بررسی کنید.`
                },
                {
                    q: `آیا امکان تولید ویدئو فراهم است؟`,
                    a: `بله. در بستهٔ پرو، تولید ویدئو به‌صورت آزمایشی از طریق مدل‌های Kling v1.6 و Hunyuan فراهم است. محدودیت فعلی ۱۰ ویدئو در هفته و طول هر ویدئو حدود ۳ تا ۵ ثانیه است.`
                }
            ]
        },
        usage: {
            title: 'کاربردها',
            questions: [
                {
                    q: `آیا گپ‌جی‌پی‌تی قابلیت ترجمه دارد؟`,
                    a: `بله! سیستم ترجمه‌ی گپ‌جی‌پی‌تی بسیار قدرتمند و کاربردی است.

                    🔤 روش‌های ترجمه:
                    ارسال مستقیم متن برای ترجمه
                    آپلود و ترجمه کامل فایل متنی با استفاده از دستیار مترجم
                    ترجمه‌ی همزمان چندین پاراگراف با حفظ ساختار اصلی
                    ترجمه بین تمام زبان‌های اصلی دنیا
                    ویژگی‌های ترجمه:
                    حفظ ساختار و فرمت‌بندی متن اصلی
                    پشتیبانی از اصطلاحات تخصصی در حوزه‌های مختلف
                    ترجمه‌ی متون علمی، ادبی، رسمی و عمومی
                    حفظ لحن و سبک نوشتاری متن اصلی
                    برای نمونه می‌توانید https://gapgpt.app/share/85de76ec-a5ef-4736-9b4b-86a2d91c76b3"> این گفتگو را مشاهده کنید.
                    
                    `
                },
                {
                    q: `آیا گپ‌جی‌پی‌تی برای نگارش پست اینستاگرام کاربرد دارد؟`,
                    a: `بله، می‌توانید موضوع را مشخص کنید تا هوش مصنوعی چندین ایده به شما ارائه دهد. در نهایت، با انتخاب یکی از ایده‌ها، می‌توانید درخواست نگارش کپشن و تولید تصویر مرتبط را ثبت کنید.

                    برای مثال https://gapgpt.app/share/ba8962a0-cc4a-485b-ad4b-32cbb42e1aa0"> این گفتگو رو ببینید.`
                },
                {
                    q: `آیا می‌توانم با گپ‌جی‌پی‌تی پاورپوینت بسازم؟`,
                    a: `بله، مدل می‌تواند برای شما فایل پاورپوینت ایجاد کند. اگر مدل به‌صورت خودکار از ابزار مناسب استفاده نکرد، لطفاً در متن پیام خود ذکر کنید که از ابزار Code Interpreter استفاده نماید.

                    برای مثال https://gapgpt.app/share/399ef5d8-96eb-442b-83e1-0835527830f4"> این گفتگو از این قابلیت استفاده میکنه.`
                },
                {
                    q: `آیا می‌توانم از گپ‌جی‌پی‌تی برای طراحی لوگو استفاده کنم؟`,
                    a: `بله، می‌توانید از گپ‌جی‌پی‌تی برای طراحی لوگو استفاده کنید. اما توجه داشته باشید که مدل‌ها در تولید متن فارسی درون تصاویر همچنان با محدودیت‌هایی مواجه هستند و استفاده از متن انگلیسی نتایج بهتری به همراه خواهد داشت.

                    https://gapgpt.app/share/73811881-b637-450d-a85b-305daa571e96"> این گفتگو رو به عنوان نمونه ببینید.`
                },
                {
                    q: `آیا امکان ساخت بنر وجود دارد؟`,
                    a: `برای مثال میتونید https://gapgpt.app/share/a721333e-e396-4008-a50d-dad57cf4f813"> این گفتگو رو مشاهده کنید.`
                },
                {
                    q: `کدام مدل هوش مصنوعی برای زبان فارسی عملکرد بهتری دارد؟`,
                    a: `در حال حاضر مدل‌های o3 (مخصوص بسته‌ی پرو) و مدل Claude 3.7 Sonnet (قابل دسترس در هر دو بسته‌ی پلاس و پرو) قوی‌ترین مدل‌ها هستند و برای زبان فارسی هم عملکرد بهتری دارند.`
                }
            ]
        },
        payment: {
            title: 'درگاه پرداخت و فاکتور',
            questions: [
                {
                    q: `چرا سایت درگاه پرداخت باز نمی‌شود؟`,
                    a: `برای رفع این مشکل، لطفاً این مراحل را به ترتیب انجام دهید:

                    از خاموش بودن فیلترشکن و VPN مطمئن شوید
                    مرورگر خود را به‌روزرسانی کنید
                    صفحه را نوسازی کنید
                    از مرورگر دیگری مانند Chrome یا Firefox استفاده کنید
                    حافظهٔ نهان (Cache) مرورگر را پاک کنید
                    اگر بعد از انجام این مراحل همچنان مشکل دارید، لطفاً به پشتیبانی پیام دهید.`
                },
                {
                    q: `پرداخت انجام شده اما بستهٔ من فعال نشده است؛ چه باید کرد؟`,
                    a: `در چنین مواردی، ابتدا از بخش «تنظیمات» و سپس «پروفایل»، وضعیت بستهٔ فعال خود را بررسی فرمایید.

                    اگر بستهٔ خریداری‌شده در این بخش نمایش داده نمی‌شود، معمولاً مبلغ پرداخت‌شده طی ۹۶ ساعت به‌صورت خودکار توسط درگاه پرداخت به حساب شما بازگردانده می‌شود.
                    
                    چنانچه پس از گذشت ۹۶ ساعت مبلغ به حساب شما بازنگشت، لطفاً شماره کارتی که پرداخت با آن انجام شده است را برای پیگیری به کارشناسان پشتیبانی ارسال فرمایید.`
                },
                {
                    q: `چگونه می‌توانم فاکتور رسمی خرید خود را دریافت کنم؟`,
                    a: `شما می‌توانید پس از تکمیل خرید، فاکتور رسمی دریافت کنید.

                    برای این کار، لطفاً به مسیر زیر در پنل کاربری خود مراجعه کنید:
                    
                    آیکون پروفایل در بالا چپ صفحه-> تنظیمات -> وضعیت بسته
                    در این بخش، گزینه‌ای برای تکمیل اطلاعات لازم (مانند نام شرکت، کد اقتصادی و ...) و سپس دانلود فاکتور رسمی خرید شما وجود دارد. 🙏`
                }
            ]
        },
        errors: {
            title: 'محدودیت‌ها و خطاها',
            questions: [
                {
                    q: `با نمایش پیام محدودیت، چه زمانی می‌توانم دوباره از سامانه استفاده کنم؟`,
                    a: `محدودیت استفاده از سرویس به‌صورت شناور و بر اساس بازه‌های ۳ ساعته محاسبه می‌شود.

                    سقف استفاده:
                    بسته‌ی پلاس: ۵۰ پیام در هر ۳ ساعت
                    بسته‌ی پرو: ۱۵۰ پیام در هر ۳ ساعت
                    برای مثال، اگر در بستهٔ پرو ۸۰ پیام ساعت ۱۸:۰۰ و ۷۰ پیام ساعت ۲۰:۰۰ ارسال کرده باشید، سهمیهٔ ۸۰ پیام اول ساعت ۲۱:۰۰ و سهمیهٔ ۷۰ پیام دوم ساعت ۲۳:۰۰ برای شما آزاد خواهد شد.
                    
                    زمان دقیق رفع محدودیت در پیامی که سیستم نمایش می‌دهد، مشخص شده است.`
                },
                {
                    q: `در صورت دریافت پیام خطا چه اقدامی انجام دهم؟`,
                    a: `برای رفع خطا، لطفاً این مراحل را به ترتیب امتحان کنید:

                    از غیرفعال بودن فیلترشکن مطمئن شوید
                    صفحه را نوسازی کنید
                    از یک مرورگر دیگر استفاده کنید
                    یک گفتگوی جدید شروع کنید
                    اگر مشکل همچنان ادامه دارد:
                    
                    لینک گفتگوی مشکل‌دار را کپی کنید
                    آن را برای کارشناسان پشتیبانی ارسال کنید
                    کارشناسان ما در اسرع وقت موضوع را بررسی و برطرف خواهند کرد.`
                },
                {
                    q: `دلیل خطای ۴۰۴ یا باز نشدن لینک فایلِ ساخته‌شده چیست؟`,
                    a: `در مواردی ممکن است مدل پیوندی ایجاد کند که به فایل واقعی منتهی نشود. برای اطمینان از تولید صحیح فایل:

                    از گزینهٔ «ساخت فایل» در منوی سه‌نقطهٔ کنار جعبهٔ ورودی استفاده کنید.
                    ترجیحاً از مدل GapGPT استفاده کنید؛ برخی مدل‌ها هنوز در ویرایش/تولید فایل محدودیت دارند.`
                },
                {
                    q: `هر مدل چه میزان از سهمیه پیام را مصرف می‌کند؟`,
                    a: `هر پیام ارسالی به مدل‌های مختلف، معادل تعداد مشخصی از سهمیه پیام شما را مصرف می‌کند. در جدول زیر، میزان مصرف هر مدل آمده است:

                    مدل	میزان مصرف از سهمیه	بستهٔ در دسترس
                    o3-pro	۲۰ پیام	پرو
                    o1 / o3	۱۰ پیام	پرو
                    gpt-5-pro	۵ پیام	پرو
                    gpt-5-codex	۲ پیام	پلاس / پرو
                    opus-4 / opus-4.1	۷ پیام	پرو
                    o4-mini-high / o3-mini-high / sonnet3.7-thinking / grok-3-thinking	۶ پیام	پرو
                    grok-4	۴ پیام	پلاس / پرو
                    grok-4-fast	۱ پیام	پلاس / پرو
                    midjourney / flux-pro / imagen4	۴ پیام (تصویر)	پرو
                    o4-mini / o3-mini / o1-mini / sonnet3.7 / sonnet-4.5 / opus	۳ پیام	پلاس و پرو
                    gemini-2.5-flash-image	۳ پیام (تصویر)	پلاس و پرو
                    grok-3 / o4-mini	۲ پیام	پلاس و پرو
                    مدل‌های ویدئو (Kling/Hunyuan)	-	پرو (۱۰ ویدئو در هفته)
                    مدل‌های دیگر که در این لیست نیستند، ۱ واحد از سهمیه را مصرف می‌کنند.`
                }
            ]
        },
        team: {
            title: 'بسته‌های تیم و سازمانی',
            questions: [
                {
                    q: `بستهٔ تیم (Team) چیست و برای چه کسانی مناسب است؟`,
                    a: `بستهٔ تیم برای سازمان‌های کوچک و متوسط طراحی شده است. در این بسته، هزینه به‌ازای هر کاربر محاسبه می‌شود و ویژگی‌های زیر را ارائه می‌دهد:

                    ویژگی‌های کامل بستهٔ پرو: هر کاربر به تمام قابلیت‌های بستهٔ پرو دسترسی خواهد داشت.
                    سهمیهٔ پیام مشابه پرو: هر کاربر به‌صورت مستقل محدودیت ۱۵۰ پیام در هر سه ساعت را دارد.
                    حداقل ۲ کاربر: برای فعال‌سازی این بسته حداقل به دو کاربر نیاز است.
                    این بسته برای تیم‌هایی که به قابلیت‌های پیشرفتهٔ هوش مصنوعی نیاز دارند ولی نیازمند مدیریت متمرکز و سهمیهٔ پیام اشتراکی نیستند، ایده‌آل است.`
                },
                {
                    q: `بستهٔ سازمانی (Enterprise) چیست و چه ویژگی‌هایی دارد؟`,
                    a: `بستهٔ سازمانی برای کسب‌وکارها و سازمان‌های بزرگی طراحی شده است که به سهمیهٔ پیام بالا و ابزارهای مدیریتی پیشرفته نیاز دارند. قیمت‌گذاری در این بسته بر اساس «تعداد کل پیام» است و ویژگی‌های زیر را شامل می‌شود:

                    سهمیهٔ پیام اشتراکی: سهمیهٔ پیام بین تمام کاربران سازمان به اشتراک گذاشته می‌شود (برای مثال، ۲۰۰۰ پیام در هر سه ساعت برای ۱۰ تا ۲۰ کاربر).
                    پنل مدیریتی متمرکز: امکان مدیریت کاربران و تخصیص سهمیهٔ پیام برای هر یک وجود دارد.
                    امنیت و یکپارچه‌سازی: پشتیبانی از Single Sign-On (SSO) برای ورود امن و یکپارچه.
                    اشتراک‌گذاری دستیار: امکان ساخت و اشتراک‌گذاری دستیارهای سفارشی‌شده در سطح سازمان.
                    برای کسب اطلاعات بیشتر و دریافت پیش‌فاکتور، لطفاً به صفحهٔ https://gapgpt.app/enterprise">بستهٔ سازمانی مراجعه فرمایید.`
                }
            ]
        }
    };

    // کلیک روی دسته‌بندی‌ها
    $('.faq-category-item').on('click', function(e) {
        e.preventDefault();
        const category = $(this).data('category');
        const data = faqData[category];
        
        if (data) {
            // بروزرسانی عنوان
            $('.faq-category-title').text(data.title);
            
            // پاک کردن سوالات قبلی
            const $accordion = $('#faqQuestionsAccordion');
            $accordion.empty();
            
            // اضافه کردن سوالات جدید
            data.questions.forEach((item, index) => {
                const accordionItem = `
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq${category}${index}">
                                ${item.q}
                            </button>
                        </h2>
                        <div id="faq${category}${index}" class="accordion-collapse collapse" data-bs-parent="#faqQuestionsAccordion">
                            <div class="accordion-body">
                                <p>${item.a}</p>
                            </div>
                        </div>
                    </div>
                `;
                $accordion.append(accordionItem);
            });
            
            // تعویض نمایش
            $('.faq-categories').hide();
            $('.faq-details').show();
        }
    });

    // دکمه بازگشت
    $('#faqBackButton').on('click', function() {
        $('.faq-details').hide();
        $('.faq-categories').show();
    });
    
    // === Mobile Responsive ===
    
    // چک کردن اندازه صفحه در شروع
    function checkMobileView() {
        if ($(window).width() <= 768) {
            // در موبایل، سایدبار بسته باشد
            $('.sidebar-drawer').addClass('collapsed');
            $('#sidebarToggle').hide();
            $('#mobileMenuIcon').show();
            $('#sidebarOverlay').removeClass('show');
        } else {
            // در دسکتاپ، سایدبار باز باشد
            $('.sidebar-drawer').removeClass('collapsed');
            $('#sidebarOverlay').removeClass('show');
            $('#sidebarToggle').hide();
            $('#mobileMenuIcon').hide();
        }
    }
    
    // اجرای چک در شروع
    checkMobileView();
    
    // چک کردن هنگام تغییر اندازه پنجره
    $(window).on('resize', function() {
        checkMobileView();
    });
    
    // === Theme Switcher ===
    
    // بارگذاری تم ذخیره شده
    const savedTheme = localStorage.getItem('theme') || 'dark';
    
    if (savedTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        $('body').attr('data-theme', systemTheme);
    } else {
        $('body').attr('data-theme', savedTheme);
    }
    
    $('#themeSelector').val(savedTheme);
    
    // تغییر تم
    $('#themeSelector').on('change', function() {
        const theme = $(this).val();
        
        if (theme === 'system') {
            // تشخیص تم سیستم
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            $('body').attr('data-theme', systemTheme);
            localStorage.setItem('theme', 'system');
            localStorage.setItem('actualTheme', systemTheme);
        } else {
            $('body').attr('data-theme', theme);
            localStorage.setItem('theme', theme);
            localStorage.setItem('actualTheme', theme);
        }
        
        console.log('تم تغییر کرد به:', theme);
    });
    
    // گوش دادن به تغییرات تم سیستم
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const currentTheme = localStorage.getItem('theme');
        if (currentTheme === 'system') {
            const systemTheme = e.matches ? 'dark' : 'light';
            $('body').attr('data-theme', systemTheme);
            localStorage.setItem('actualTheme', systemTheme);
        }
    });
    
    // === Rename Chat Functions ===
    
    // تایید تغییر نام
    $('#confirmRenameBtn').on('click', function() {
        const newTitle = $('#chatNewName').val().trim();
        
        if (!newTitle) {
            // اگر فیلد خالی بود، فوکوس روی اینپوت
            $('#chatNewName').focus();
            return;
        }
        
        if (chatToRename) {
            const history = getChatHistory();
            const chat = history.find(c => String(c.id) === chatToRename);
            
            if (chat) {
                chat.title = newTitle;
                console.log('New title:', chat.title);
                saveChatHistory(history);
                renderChatHistory();
                renderArchivedChatsModal(); // بروزرسانی مودال آرشیو اگر باز است
            }
            
            chatToRename = null;
            
            // بستن مودال
            const renameModal = bootstrap.Modal.getInstance(document.getElementById('renameChatModal'));
            if (renameModal) {
                renameModal.hide();
            }
        }
    });
    
    // ارسال فرم با Enter
    $('#renameChatForm').on('submit', function(e) {
        e.preventDefault();
        $('#confirmRenameBtn').click();
    });
    
    // پاک کردن فیلد وقتی مودال بسته میشود
    $('#renameChatModal').on('hidden.bs.modal', function() {
        $('#chatNewName').val('');
        chatToRename = null;
    });
    
    // بستن مودال با Escape
    $('#chatNewName').on('keydown', function(e) {
        if (e.key === 'Escape') {
            const renameModal = bootstrap.Modal.getInstance(document.getElementById('renameChatModal'));
            if (renameModal) {
                renameModal.hide();
            }
        }
    });
    
    // === Delete All Chats Functions ===
    
    // باز کردن مودال حذف همه گفتگوها
    $('#deleteAllConversationsBtn').on('click', function() {
        // بستن مودال تنظیمات
        const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        if (settingsModal) {
            settingsModal.hide();
        }
        
        // ریست کردن چکباکس
        $('#deleteArchivedChatsCheckbox').prop('checked', false);
        
        // باز کردن مودال تایید حذف
        const deleteAllModal = new bootstrap.Modal(document.getElementById('deleteAllChatsModal'));
        deleteAllModal.show();
    });
    
    // تایید حذف همه گفتگوها
    $('#confirmDeleteAllBtn').on('click', function() {
        const includeArchived = $('#deleteArchivedChatsCheckbox').is(':checked');
        let history = getChatHistory();
        
        if (includeArchived) {
            // حذف همه گفتگوها شامل آرشیو شده
            history = [];
            console.log('تمام گفتگوها (شامل آرشیو) حذف شدند');
        } else {
            // حذف فقط گفتگوهای عادی و پین شده (نگهداری آرشیو شده‌ها)
            history = history.filter(chat => chat.isArchived);
            console.log('گفتگوهای عادی و پین شده حذف شدند، آرشیو حفظ شد');
        }
        
        // ذخیره تغییرات
        saveChatHistory(history);
        
        // بروزرسانی لیست چت
        renderChatHistory();
        
        // نمایش پیام موفقیت (اختیاری)
        console.log('حذف انجام شد. تعداد گفتگوهای باقیمانده:', history.length);
        
        // بستن مودال
        const deleteAllModal = bootstrap.Modal.getInstance(document.getElementById('deleteAllChatsModal'));
        if (deleteAllModal) {
            deleteAllModal.hide();
        }
    });
});
