$(document).ready(function() {
    let attachedFiles = [];
    let currentChatId = null;
    let isSending = false; // حالت در حال ارسال پیام
    
    // استفاده از chatHistoryManager جدید
    const chatManager = window.chatHistoryManager;
    
    // ابزارهای کمکی نمایش چیپس‌ها
    function hideChips() {
        const startupFeatures = document.querySelector('.startup-features');
        const mobileChips = document.querySelector('.mobile-chips');
        if (startupFeatures) startupFeatures.style.setProperty('display', 'none', 'important');
        if (mobileChips) mobileChips.style.setProperty('display', 'none', 'important');
    }

    function showChipsBasedOnViewport() {
        const startupFeatures = document.querySelector('.startup-features');
        const mobileChips = document.querySelector('.mobile-chips');
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            if (startupFeatures) startupFeatures.style.setProperty('display', 'none', 'important');
            if (mobileChips) mobileChips.style.setProperty('display', 'block', 'important');
        } else {
            if (startupFeatures) startupFeatures.style.setProperty('display', 'flex', 'important');
            if (mobileChips) mobileChips.style.setProperty('display', 'none', 'important');
        }
    }

    // مدیریت نمایش چیپس‌ها بر اساس وضعیت چت
    function updateChipsVisibility() {
        const hasActiveChat = currentChatId && chatManager.getChatById(currentChatId) && 
                             chatManager.getChatById(currentChatId).messages.length > 0;
        if (hasActiveChat) {
            hideChips();
        } else {
            showChipsBasedOnViewport();
        }
        console.log('چیپس‌ها آپدیت شدند - چت فعال:', hasActiveChat);
    }

    // ================== Voice Chat Mode Variables ==================
    let isVoiceChatMode = false;
    let isVoiceChatRecording = false;
    let isVoiceChatPaused = false; // پاز/ادامه برای چت صوتی
    let voiceInactivityTimer = null; // تایمر سکوت برای تشخیص پایان صحبت
    let voiceChatTipsDismissed = false; // وضعیت نمایش بنر نکات چت صوتی
    
    // ================== Speech Recognition Setup ==================
    let recognition = null;
    let isRecording = false;
    let interimTranscript = '';
    let finalTranscript = '';
    
    // بررسی پشتیبانی مرورگر از Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // تنظیمات
        recognition.continuous = true; // ضبط مداوم
        recognition.interimResults = true; // نمایش نتایج موقت
        recognition.lang = 'fa-IR'; // زبان فارسی (می‌تونید تغییر بدید)
        recognition.maxAlternatives = 1;
        
        // رویداد شروع ضبط
        recognition.onstart = function() {
            console.log(' ضبط صدا شروع شد');
            isRecording = true;
            updateVoiceButtonState();
        };
        
        // رویداد دریافت نتیجه
        recognition.onresult = function(event) {
            interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // اگر در حالت چت صوتی هستیم، فقط متن را نمایش بده
            if (isVoiceChatMode) {
                const currentText = (finalTranscript + interimTranscript).trim();
                $('#voiceChatStatusText').text(currentText || 'در حال شنیدن...');
                ensurePendingVoiceMessageBubble();
                updatePendingVoiceMessageBubble(currentText || 'در حال شنیدن...', true);
                // اولین صحبت: محو کردن بنر نکات
                if (!voiceChatTipsDismissed && currentText.length > 0) {
                    voiceChatTipsDismissed = true;
                    $('#voiceChatTipsBanner').fadeOut(200);
                }
                // زمان‌سنج سکوت برای تشخیص پایان صحبت
                if (voiceInactivityTimer) clearTimeout(voiceInactivityTimer);
                voiceInactivityTimer = setTimeout(() => {
                    autoFinalizeVoiceUtterance();
                }, 1500);
            } else {
                // نمایش متن در textarea
                const $textarea = $('#chatTextarea');
                $textarea.val(finalTranscript + interimTranscript);
                $textarea.trigger('input'); // برای آپدیت ارتفاع
            }
            
            console.log('📝 متن شناسایی شده:', finalTranscript + interimTranscript);
        };
        
        // رویداد خطا
        recognition.onerror = function(event) {
            console.error('❌ خطا در ضبط صدا:', event.error);
            
            let errorMessage = 'خطا در ضبط صدا';
            switch(event.error) {
                case 'no-speech':
                    errorMessage = 'صدایی شناسایی نشد. لطفاً دوباره تلاش کنید.';
                    break;
                case 'audio-capture':
                    errorMessage = 'میکروفون یافت نشد. لطفاً میکروفون را فعال کنید.';
                    break;
                case 'not-allowed':
                    errorMessage = 'دسترسی به میکروفون رد شد. لطفاً دسترسی را مجاز کنید.';
                    break;
                case 'network':
                    errorMessage = 'خطا در اتصال به اینترنت';
                    break;
            }
            
            alert(errorMessage);
            stopRecording();
        };
        
        // رویداد پایان ضبط
        recognition.onend = function() {
            console.log('🛑 ضبط صدا متوقف شد');
            isRecording = false;
            updateVoiceButtonState();
            // اگر در حالت چت صوتی هستیم و پاز نیستیم، مجدد شروع به گوش دادن کن
            if (isVoiceChatMode && isVoiceChatRecording && !isVoiceChatPaused) {
                try {
                    recognition.start();
                    console.log('🔁 شروع مجدد شنیدن برای چت صوتی');
                } catch (e) {
                    console.warn('عدم امکان شروع مجدد بلافاصله:', e);
                }
            }
        };
    } else {
        console.warn('⚠️ مرورگر شما از Web Speech API پشتیبانی نمی‌کند');
    }
    
    // توابع کنترل ضبط
    function startRecording() {
        if (!recognition) {
            alert('مرورگر شما از تبدیل صدا به متن پشتیبانی نمی‌کند.\n\nلطفاً از Chrome، Edge یا Safari استفاده کنید.');
            return;
        }
        
        finalTranscript = $('#chatTextarea').val(); // حفظ متن قبلی
        interimTranscript = '';
        
        try {
            recognition.start();
            console.log('▶️ شروع ضبط...');
        } catch (error) {
            console.error('خطا در شروع ضبط:', error);
        }
    }
    
    function stopRecording() {
        if (recognition && isRecording) {
            recognition.stop();
            console.log('⏹️ توقف ضبط...');
        }
    }
    
    function updateVoiceButtonState() {
        const $voiceBtn = $('#voiceBtn');
        const $micIcon = $voiceBtn.find('i');
        const $textarea = $('#chatTextarea');
        const $inputWrapper = $('.input-wrapper');
        
        if (isRecording) {
            // حالت ضبط - تبدیل دکمه میکروفون به دکمه توقف
            $voiceBtn.removeClass('btn-outline-light').addClass('btn-danger recording-pulse');
            $micIcon.removeClass('bi-mic').addClass('bi-stop-circle-fill');
            $voiceBtn.attr('title', 'کلیک برای توقف ضبط');
            
            // تغییر حالت textarea
            $textarea.addClass('recording-mode');
            $inputWrapper.addClass('recording-active');
            
            // نمایش نمایشگر وضعیت ضبط با دکمه قطع
            showRecordingStatus();
        } else {
            // حالت عادی
            $voiceBtn.removeClass('btn-danger recording-pulse').addClass('btn-outline-light');
            $micIcon.removeClass('bi-stop-circle-fill').addClass('bi-mic');
            $voiceBtn.attr('title', 'تبدیل صدا به متن');
            
            // برگرداندن حالت عادی textarea
            $textarea.removeClass('recording-mode');
            $inputWrapper.removeClass('recording-active');
            
            // حذف نمایشگر وضعیت ضبط
            hideRecordingStatus();
            
            // دکمه میکروفون همیشه نمایش داده میشه
            $('#voiceBtn').show();
            
            // بررسی اینکه آیا متن داریم یا نه
            const hasText = $textarea.val().trim().length > 0;
            if (hasText) {
                // اگر متن داریم، soundwave رو مخفی کن و send رو نشون بده
                $('#soundwaveBtn').hide();
                $('#sendMessageBtn').show();
            } else {
                // اگر متن نداریم، soundwave رو نشون بده و send رو مخفی کن
                $('#soundwaveBtn').show();
                $('#sendMessageBtn').hide();
            }
        }
    }
    
    function showRecordingStatus() {
        // حذف نمایشگر قبلی اگر وجود داشته باشد
        $('.recording-status').remove();
        
        // ساخت نمایشگر جدید با دکمه قطع
        const $status = $(`
            <div class="recording-status">
                <div class="recording-status-dot"></div>
                <span>در حال ضبط صدا...</span>
                <div class="recording-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <button class="btn btn-sm btn-light recording-stop-btn" type="button" title="توقف ضبط">
                    <i class="bi bi-stop-circle-fill"></i>
                </button>
            </div>
        `);
        
        $('body').append($status);
        
        // اضافه کردن event handler به دکمه قطع
        $status.find('.recording-stop-btn').on('click', function() {
            stopRecording();
        });
        
        // انیمیشن ورود
        setTimeout(() => {
            $status.css('opacity', '1');
        }, 100);
    }
    
    function hideRecordingStatus() {
        const $status = $('.recording-status');
        
        if ($status.length) {
            $status.fadeOut(300, function() {
                $(this).remove();
            });
        }
    }
    
    // کلیک روی دکمه میکروفون
    $('#voiceBtn').on('click', function() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });
    
    // ================== Voice Chat Mode ==================
    // تنظیم موقعیت UI چت صوتی بر اساس سایدبار
    function updateVoiceChatPosition() {
        const sidebarWidth = $('.sidebar-drawer').hasClass('collapsed') ? 0 : 300;
        const $voiceChatUI = $('#voiceChatUI');
        
        if ($(window).width() > 768) {
            // در دسکتاپ
            $voiceChatUI.css('right', sidebarWidth + 'px');
        } else {
            // در موبایل
            $voiceChatUI.css('right', '0');
        }
    }
    
    // فعال کردن حالت چت صوتی
    function activateVoiceChatMode() {
        isVoiceChatMode = true;
        
        // مخفی کردن فرم اصلی
        $('.default-input').hide();
        
        // بررسی اینکه آیا قبلاً چتی داشتیم یا نه
        const hasExistingChat = currentChatId && chatManager.getChatById(currentChatId) && 
                                chatManager.getChatById(currentChatId).messages.length > 0;
        
        if (hasExistingChat) {
            // اگر چت داریم، هدر و چیپس‌ها رو مخفی کن
            const startupHeader = document.querySelector('.startup-header');
            if (startupHeader) startupHeader.style.setProperty('display', 'none', 'important');
            hideChips();
            // پیام‌ها رو نشون بده
            $('#chatMessagesContainer').show();
            renderMessages(currentChatId);
        } else {
            // اگر چت نداریم، هدر و چیپس‌ها رو نگه دار
            // فقط container پیام‌ها رو نشون بده (خالی)
            $('#chatMessagesContainer').show().empty();
        }
        
        // نمایش UI چت صوتی
        $('#voiceChatUI').fadeIn(300);
        
        // نمایش دکمه اشتراک‌گذاری
        $('#shareBtn').fadeIn(300);
        
        // نمایش بنر نکات چت صوتی
        voiceChatTipsDismissed = false;
        $('#voiceChatTipsBanner').stop(true, true).fadeIn(200);
        
        // تنظیم موقعیت بر اساس سایدبار
        updateVoiceChatPosition();
        
        console.log('✅ حالت چت صوتی فعال شد');
    }
    
    // غیرفعال کردن حالت چت صوتی
    function deactivateVoiceChatMode() {
        isVoiceChatMode = false;
        
        // توقف ضبط اگر در حال ضبط است
        if (isVoiceChatRecording) {
            stopVoiceChatRecording();
        }
        
        // مخفی کردن UI چت صوتی
        $('#voiceChatUI').fadeOut(300);
        // مخفی کردن بنر نکات
        $('#voiceChatTipsBanner').hide();
        voiceChatTipsDismissed = false;
        
        // نمایش فرم اصلی
        $('.default-input').fadeIn(300);
        
        // بررسی وضعیت چت
        const hasChat = currentChatId && chatManager.getChatById(currentChatId) && 
                        chatManager.getChatById(currentChatId).messages.length > 0;
        
        if (!hasChat) {
            // اگر چتی وجود ندارد، همه چیز رو برگردون به حالت اول
            $('#shareBtn').hide();
            
            const startupHeader = document.querySelector('.startup-header');
            if (startupHeader) startupHeader.style.removeProperty('display');
            showChipsBasedOnViewport();
            
            $('#chatMessagesContainer').hide();
            
            // برگرداندن فرم به حالت عادی
            $('.startup-container')
                .removeClass('chat-input-footer')
                .css({
                    'position': '',
                    'bottom': '',
                    'right': '',
                    'left': '',
                    'max-width': '',
                    'margin': '',
                    'padding': '',
                    'z-index': '',
                    'transition': ''
                });
            
            $('.input-suggestions-container')
                .css({
                    'max-width': '',
                    'margin': ''
                });
        } else {
            // اگر چت داریم، هدر و چیپس‌ها رو مخفی کن و چت رو نشون بده
            const startupHeader = document.querySelector('.startup-header');
            if (startupHeader) startupHeader.style.setProperty('display', 'none', 'important');
            hideChips();
            
            $('#chatMessagesContainer').show();
            
            // فرم رو در حالت transformed نگه دار
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
                    'z-index': '100',
                    'transition': 'right 0.2s ease'
                });
            
            $('.input-suggestions-container')
                .css({
                    'max-width': '900px',
                    'margin': '0 auto'
                });
        }
        
        console.log('❌ حالت چت صوتی غیرفعال شد');
    }
    
    // شروع ضبط در حالت چت صوتی
    function startVoiceChatRecording() {
        if (!recognition) {
            alert('مرورگر شما از تبدیل صدا به متن پشتیبانی نمی‌کند.\n\nلطفاً از Chrome، Edge یا Safari استفاده کنید.');
            return;
        }
        
        isVoiceChatRecording = true;
        isVoiceChatPaused = false;
        finalTranscript = '';
        interimTranscript = '';
        
        // تغییر UI
        const $btn = $('#startVoiceChatBtn');
        $btn.addClass('recording');
        $btn.find('span').text('پاز');
        $btn.find('i').removeClass('bi-mic-fill bi-play-fill').addClass('bi-pause-fill');
        
        $('#voiceChatStatusText').text('در حال شنیدن...');
        ensurePendingVoiceMessageBubble();
        updatePendingVoiceMessageBubble('در حال شنیدن...', true);
        
        try {
            recognition.start();
            console.log('🎤 شروع ضبط چت صوتی');
        } catch (error) {
            console.error('خطا در شروع ضبط:', error);
            stopVoiceChatRecording();
        }
    }
    
    // توقف ضبط در حالت چت صوتی
    function stopVoiceChatRecording() {
        if (recognition && isVoiceChatRecording) {
            recognition.stop();
            
            isVoiceChatRecording = false;
            isVoiceChatPaused = false;
            if (voiceInactivityTimer) {
                clearTimeout(voiceInactivityTimer);
                voiceInactivityTimer = null;
            }
            
            // برگرداندن UI به حالت عادی
            const $btn = $('#startVoiceChatBtn');
            $btn.removeClass('recording');
            $btn.find('span').text('شروع چت صوتی');
            $btn.find('i').removeClass('bi-pause-fill bi-play-fill').addClass('bi-mic-fill');
            
            $('#voiceChatStatusText').text('چت صوتی');
            
            console.log('⏹️ توقف ضبط چت صوتی');
            
            // ارسال پیام اگر متنی وجود دارد
            if (finalTranscript.trim().length > 0) {
                sendVoiceMessage(finalTranscript.trim());
            }
            clearPendingVoiceMessageBubble();
            finalTranscript = '';
            interimTranscript = '';
        }
    }

    // پاز کردن شنیدن بدون خاتمه
    function pauseVoiceChatRecording() {
        if (!isVoiceChatRecording || isVoiceChatPaused) return;
        isVoiceChatPaused = true;
        try { recognition.stop(); } catch (e) {}
        const $btn = $('#startVoiceChatBtn');
        $btn.removeClass('recording');
        $btn.find('span').text('ادامه');
        $btn.find('i').removeClass('bi-pause-fill bi-mic-fill').addClass('bi-play-fill');
        $('#voiceChatStatusText').text('پاز شد - برای ادامه کلیک کنید');
        if (voiceInactivityTimer) { clearTimeout(voiceInactivityTimer); voiceInactivityTimer = null; }
    }

    // ادامه شنیدن بعد از پاز
    function resumeVoiceChatRecording() {
        if (!isVoiceChatRecording || !isVoiceChatPaused) return;
        isVoiceChatPaused = false;
        const $btn = $('#startVoiceChatBtn');
        $btn.addClass('recording');
        $btn.find('span').text('پاز');
        $btn.find('i').removeClass('bi-play-fill bi-mic-fill').addClass('bi-pause-fill');
        $('#voiceChatStatusText').text('در حال شنیدن...');
        ensurePendingVoiceMessageBubble();
        updatePendingVoiceMessageBubble('در حال شنیدن...', true);
        try { recognition.start(); } catch (e) { console.warn('عدم امکان ادامه بلافاصله:', e); }
    }

    // حباب پیام در انتظار (هنگام صحبت کردن)
    function ensurePendingVoiceMessageBubble() {
        const $container = $('#chatMessagesContainer');
        if ($container.find('.pending-voice-msg').length === 0) {
            const bubbleHtml = `
                <div class="message-item mb-4 d-flex justify-content-start pending-voice-msg">
                    <div style="max-width: 70%;">
                        <div class="message-bubble rounded-5" style="background-color: rgb(47, 47, 47); padding:10px 20px; color: white; opacity: 0.85;">
                            <div class="message-content" id="pendingVoiceMsgContent" style="white-space: pre-wrap; word-wrap: break-word;"></div>
                        </div>
                    </div>
                </div>`;
            $container.append(bubbleHtml);
            // اسکرول به پایین
            setTimeout(() => { $container.scrollTop($container[0].scrollHeight); }, 50);
        }
    }

    function updatePendingVoiceMessageBubble(text, listening) {
        const $content = $('#pendingVoiceMsgContent');
        if ($content.length) {
            const display = text && text.length ? text : (listening ? 'در حال شنیدن...' : 'در انتظار...');
            $content.text(display);
        }
    }

    function clearPendingVoiceMessageBubble() {
        $('#chatMessagesContainer .pending-voice-msg').remove();
    }

    // اتمام خودکار یک جمله پس از سکوت
    function autoFinalizeVoiceUtterance() {
        if (!isVoiceChatMode || !isVoiceChatRecording || isVoiceChatPaused) return;
        const message = (finalTranscript + ' ' + interimTranscript).trim();
        if (message.length === 0) return;
        console.log('🤐 سکوت تشخیص داده شد - ارسال پیام:', message);
        try { recognition.stop(); } catch (e) {}
        // UI وضعیت
        $('#voiceChatStatusText').html('<i class="bi bi-three-dots"></i> در حال ارسال...');
        sendVoiceMessage(message);
        clearPendingVoiceMessageBubble();
        finalTranscript = '';
        interimTranscript = '';
        // پس از onend دوباره شروع می‌شود چون isVoiceChatRecording=true و پاز=false است
    }
    
    // ارسال پیام صوتی
    function sendVoiceMessage(message) {
        console.log('📤 ارسال پیام صوتی:', message);
        
        // اگر چت فعلی وجود ندارد، چت جدید بساز
        if (!currentChatId) {
            const newChat = createNewChat(message);
            if (!newChat) {
                console.error('خطا در ساخت چت جدید');
                return;
            }
            currentChatId = newChat.id;
            
            // مخفی کردن چیپس‌ها و هدر (به جای حذف)
            hideChips();
            const startupHeader = document.querySelector('.startup-header');
            if (startupHeader) startupHeader.style.setProperty('display', 'none', 'important');
            
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
            
            // آپدیت وضعیت چیپس‌ها
            updateChipsVisibility();
            
            // نمایش دکمه اشتراک‌گذاری
            $('#shareBtn').fadeIn(300);
            
            // آپدیت هیستوری چت در سایدبار
            renderChatHistory();
        }
        
        // اضافه کردن پیام کاربر
        addMessageToChat(currentChatId, message, 'user');
        renderMessages(currentChatId);
        
        // آپدیت هیستوری چت در سایدبار
        renderChatHistory();
        
        // Scroll به پایین
        setTimeout(() => {
            const $container = $('#chatMessagesContainer');
            $container.scrollTop($container[0].scrollHeight);
        }, 100);
        
        // نمایش در حال تایپ...
        $('#voiceChatStatusText').html('<i class="bi bi-three-dots"></i> در حال پاسخ...');
        
        // شبیه‌سازی پاسخ هوش مصنوعی
        setTimeout(() => {
            const aiResponse = 'این یک پاسخ نمونه به پیام شما است: "' + message + '"';
            addMessageToChat(currentChatId, aiResponse, 'assistant');
            renderMessages(currentChatId);
            
            // آپدیت هیستوری چت در سایدبار
            renderChatHistory();
            
            // Scroll به پایین
            setTimeout(() => {
                const $container = $('#chatMessagesContainer');
                $container.scrollTop($container[0].scrollHeight);
            }, 100);
            
            // بازگرداندن متن وضعیت
            $('#voiceChatStatusText').text('چت صوتی');
            
            // پاک کردن متن ضبط شده
            finalTranscript = '';
            interimTranscript = '';
        }, 2000);
    }
    
    // کلیک روی دکمه Voice Chat (soundwave) - فعال کردن حالت چت صوتی
    $('#soundwaveBtn').on('click', function() {
        activateVoiceChatMode();
    });
    
    // کلیک روی دکمه خروج از چت صوتی
    $('#exitVoiceChatBtn').on('click', function() {
        deactivateVoiceChatMode();
    });
    
    // کلیک روی دکمه شروع/توقف چت صوتی
    $('#startVoiceChatBtn').on('click', function() {
        if (!isVoiceChatRecording) {
            startVoiceChatRecording();
            return;
        }
        // در حال ضبط هستیم: پاز/ادامه
        if (isVoiceChatPaused) {
            resumeVoiceChatRecording();
        } else {
            pauseVoiceChatRecording();
        }
    });

    // کلیک روی لینک تنظیمات گفتگوی صوتی در بنر
    $(document).on('click', '#voiceChatSettingsLink', function(e) {
        e.preventDefault();
        const el = document.getElementById('settingsModal');
        if (el && window.bootstrap && bootstrap.Modal) {
            const modal = new bootstrap.Modal(el);
            modal.show();
        }
    });
    
    // سیستم انتخاب ابزار و چیپس‌ها
    let selectedTool = null;
    const defaultPlaceholder = 'پیام خود را بنویسید...';
    
    function selectTool(toolData) {
        // بررسی وجود داده‌ها
        if (!toolData || !toolData.tool) {
            console.error('داده‌های ابزار نامعتبر است:', toolData);
            return;
        }
        
        selectedTool = {
            tool: toolData.tool,
            icon: toolData.icon || 'bi-gear',
            label: toolData.label || toolData.text || 'ابزار',
            placeholder: toolData.placeholder || defaultPlaceholder
        };
        
        // نمایش چیپس کوچیک کنار دکمه ابزار
        const $chip = $('#selectedToolChip');
        const $icon = $('#selectedToolIcon');
        const $label = $('#selectedToolLabel');
        
        $icon.attr('class', 'bi ' + selectedTool.icon);
        $label.text(selectedTool.label);
        $chip.removeClass('d-none').addClass('d-flex');
        
        // تغییر placeholder
        $('#chatTextarea').attr('placeholder', selectedTool.placeholder);
        
        // بستن منوی ابزار
        $('#toolsMenu').removeClass('show');
        
        console.log('✅ ابزار انتخاب شد:', selectedTool);
    }
    
    function clearSelectedTool() {
        selectedTool = null;
        
        // مخفی کردن چیپس
        $('#selectedToolChip').removeClass('d-flex').addClass('d-none');
        
        // برگرداندن placeholder به حالت عادی
        $('#chatTextarea').attr('placeholder', defaultPlaceholder);
        
        console.log('ابزار پاک شد');
    }
    
    // کلیک روی چیپس‌های اصلی
    $(document).on('click', '.chip-item', function() {
        const $this = $(this);
        const toolData = {
            tool: $this.data('tool'),
            icon: $this.data('icon'),
            text: $this.find('span').text(),
            placeholder: $this.data('placeholder')
        };
        
        selectTool(toolData);
        
        // فوکوس روی textarea
        $('#chatTextarea').focus();
    });
    
    // کلیک روی آیتم‌های منوی ابزار
    $(document).on('click', '.tools-menu-item', function(e) {
        e.stopPropagation(); // جلوگیری از بسته شدن منو توسط document click
        
        const $this = $(this);
        const toolData = {
            tool: $this.data('tool'),
            icon: $this.data('icon'),
            label: $this.data('label'),
            placeholder: $this.data('placeholder')
        };
        
        selectTool(toolData);
        
        // فوکوس روی textarea
        $('#chatTextarea').focus();
    });
    
    // کلیک روی دکمه حذف ابزار
    $('#removeToolBtn').on('click', function(e) {
        e.stopPropagation();
        clearSelectedTool();
    });
    
    // Chat History Management - استفاده از سیستم جدید
    function getChatHistory() {
        return chatManager ? chatManager.getAll() : [];
    }
    
    function saveChatHistory(history) {
        // دیگر نیازی نیست - chatManager خودش ذخیره می‌کند
        console.log('saveChatHistory deprecated - using chatManager');
    }
    
    function createNewChat(firstMessage) {
        if (!chatManager) {
            console.error('chatManager not found!');
            return null;
        }
        
        const chat = chatManager.createChat(firstMessage);
        currentChatId = chat.id;
        
        console.log('✅ چت جدید ساخته شد:', chat.id);
        return chat;
    }
    
    function addMessageToChat(chatId, message, role) {
        if (!chatManager) {
            console.error('chatManager not found!');
            return;
        }
        
        chatManager.addMessage(chatId, message, role);
        console.log('✅ پیام اضافه شد به چت:', chatId);
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
        if (!chatManager) {
            console.error('chatManager not found!');
            return;
        }
        
        const chat = chatManager.getChatById(chatId);
        
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
            const chat = chatManager.getChatById(currentChatId);
            if (!chat) return;
            const msg = chat.messages[idx];
            if (!msg || msg.role !== 'user') return;
            
            // قرار دادن متن در textarea برای ادیت
            $('.input-wrapper textarea').val(msg.content).focus().trigger('input');
            // حذف پیام قبلی از چت
            chat.messages.splice(idx, 1);
            chatManager.saveAll(chatManager.getAll());
            renderMessages(currentChatId);
        });
        
        $(document).off('click', '.regenerate-message-btn').on('click', '.regenerate-message-btn', function() {
            const idx = $(this).data('index');
            console.log('Regenerate for message index:', idx);
            
            if (isGenerating || isSending) return; // اگر در حال ارسال یا تولید هست، برگرد
            
            const chat = chatManager.getChatById(currentChatId);
            if (!chat) return;
            
            // حذف پاسخ قبلی
            chat.messages.splice(idx, 1);
            chatManager.saveAll(chatManager.getAll());
            renderMessages(currentChatId);
            
            // پیدا کردن پیام کاربر قبل از این پاسخ
            const userMessage = chat.messages[idx - 1];
            const userMessageText = userMessage ? userMessage.content : 'درخواست قبلی';
            
            // اگر در حال ضبط بود، اول متوقفش کن
            if (isRecording) {
                stopRecording();
            }
            
            // مرحله 1: شروع regenerate - نمایش Loading
            isSending = true;
            $('#sendMessageBtn').show();
            $('#voiceBtn').show();
            $('#soundwaveBtn').hide();
            updateSendButtonState();
            
            // شبیه‌سازی پردازش درخواست
            setTimeout(() => {
                // مرحله 2: درخواست ارسال شد - تغییر به Stop
                isSending = false;
                isGenerating = true;
                updateSendButtonState();
                
                console.log('🔄 در حال تولید پاسخ جدید...');
                
                // تولید پاسخ جدید
                currentGenerationTimeout = setTimeout(() => {
                    const newResponse = 'پاسخ جدید برای: "' + userMessageText + '"';
                    addMessageToChat(currentChatId, newResponse, 'assistant');
                    renderMessages(currentChatId);
                    
                    // مرحله 3: پاسخ دریافت شد - برگشت به حالت عادی
                    isGenerating = false;
                    currentGenerationTimeout = null;
                    updateSendButtonState();
                }, 3000);
            }, 800); // زمان شبیه‌سازی پردازش
        });
        
        $(document).off('click', '.like-message-btn').on('click', '.like-message-btn', function() {
            $(this).toggleClass('text-success');
        });
        
        $(document).off('click', '.dislike-message-btn').on('click', '.dislike-message-btn', function() {
            $(this).toggleClass('text-danger');
        });
    }
    
    function renderChatHistory() {
        // استفاده از تابع رندر از chatIntegration
        if (window.renderSidebarChats) {
            window.renderSidebarChats();
            return;
        }
        
        // اگر تابع window وجود نداشت، از کد قدیمی استفاده کن
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
    
    // این handler ها در chatIntegration.js پیاده‌سازی شده‌اند
    // پین کردن - حالا در chatIntegration.js مدیریت می‌شود
    
    // حذف کردن - حالا در chatIntegration.js مدیریت می‌شود
    
    // آرشیو کردن - حالا در chatIntegration.js مدیریت می‌شود
    
    // خروج از آرشیو - حالا در chatIntegration.js مدیریت می‌شود
    
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
    
    // تغییر نام - حالا در chatIntegration.js مدیریت می‌شود
    
    
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
        
        console.log('🖼️ فایل دریافتی:', {
            name: file.name,
            type: file.type,
            size: file.size,
            isImage: file.type.startsWith('image/')
        });
        
        // تشخیص نوع فایل با لاگ更强
        const isImage = file.type.startsWith('image/');
        console.log('🔍检测结果:', {
            fileStartsWith: file.type ? file.type.substring(0, 10) : 'null',
            isImage: isImage,
            willUseImg: isImage,
            willUseIcon: !isImage
        });
        
        let fileIcon = 'bi-file-earmark';
        if (file.type.startsWith('image/')) fileIcon = 'bi-file-image';
        else if (file.type.startsWith('video/')) fileIcon = 'bi-file-play';
        else if (file.type.includes('pdf')) fileIcon = 'bi-file-pdf';
        else if (file.type.includes('word')) fileIcon = 'bi-file-word';
        else if (file.type.includes('excel') || file.type.includes('spreadsheet')) fileIcon = 'bi-file-excel';
        
        let previewUrl = null;
        let fileHTML = '';
        
        if (isImage) {
            // ساخت thumbnail برای تصویر
            previewUrl = URL.createObjectURL(file);
            console.log('🔗 preview URL ساخته شد:', previewUrl);
            
            fileHTML = `
                <div class="file-item rounded-3 p-2 d-flex align-items-center gap-2" data-file-id="${fileId}" data-thumb-url="${previewUrl}">
                    <div class="file-thumb-wrap">
                        <img src="${previewUrl}" alt="preview" class="file-thumb" />
                    </div>
                    <div class="file-info">
                        <div class="file-name text-white" style="font-size: 0.85rem;">${fileName}</div>
                        <div class="file-size text-muted" style="font-size: 0.75rem;">${fileSize} KB</div>
                    </div>
                    <button class="btn btn-sm btn-close btn-close-white ms-auto remove-file" type="button"></button>
                </div>
            `;
            
            console.log('📝 HTML تصویر ساخته شد');
            console.log('🖼️ تگ img استفاده شد:', fileHTML.includes('<img'));
        } else {
            // سایر فایل‌ها با آیکون
            fileHTML = `
                <div class="file-item rounded-3 p-2 d-flex align-items-center gap-2" data-file-id="${fileId}">
                    <i class="bi ${fileIcon} fs-5"></i>
                    <div class="file-info">
                        <div class="file-name text-white" style="font-size: 0.85rem;">${fileName}</div>
                        <div class="file-size text-muted" style="font-size: 0.75rem;">${fileSize} KB</div>
                    </div>
                    <button class="btn btn-sm btn-close btn-close-white ms-auto remove-file" type="button"></button>
                </div>
            `;
            
            console.log('📝 HTML فایل غیرتصویری ساخته شد');
            console.log('📄 تگ i استفاده شد:', fileHTML.includes('<i'));
        }
        
        $('.files-preview').append(fileHTML);
        attachedFiles.push({ id: fileId, file: file, previewUrl });
        
        console.log('✅ فایل به لیست اضافه شد. تعداد کل:', attachedFiles.length);
    }

    // حذف فایل
    $(document).on('click', '.remove-file', function() {
        const fileItem = $(this).closest('.file-item');
        const fileId = fileItem.data('file-id');
        
        // آزادسازی URL پیش‌نمایش در صورت وجود
        const item = attachedFiles.find(f => f.id === fileId);
        if (item && item.previewUrl) {
            try { URL.revokeObjectURL(item.previewUrl); } catch (e) {}
        }
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

    // Paste فقط در ناحیه ورودی چت
    $(document).on('paste', function(e) {
        const $target = $(e.target);
        const isInInputArea = $target.closest('.input-wrapper').length > 0 || $target.is('#chatTextarea');
        if (!isInInputArea) return;
        
        const clipboardData = e.originalEvent.clipboardData;
        if (!clipboardData || !clipboardData.items) return;
        
        const items = clipboardData.items;
        for (let i = 0; i <items.length; i++) {
            const it = items[i];
            if (it.kind === 'file') {
                let file = it.getAsFile();
                if (file) {
                    // اگر نام ندارد (مثل اسکرین‌شات)، یک نام پیش‌فرض بساز
                    if (!file.name || file.name === 'image.png') {
                        const ext = (file.type && file.type.split('/')[1]) || 'png';
                        file = new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type || 'image/png' });
                    }
                    displayFile(file);
                }
            }
        }
    });

    // دکمه انتخاب فایل
    $('#attachFileBtn').on('click', function() {
        const fileInput = $('<input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar" style="display: none;">');
        
        fileInput.on('change', function() {
            const files = this.files;
            if (files.length > 0) {
                // اگر container فایل‌ها وجود نداره، بسازش
                if ($('.files-preview').length === 0) {
                    $('.input-wrapper').prepend('<div class="files-preview d-flex flex-wrap gap-2 mb-2"></div>');
                }
                
                $.each(files, function(index, file) {
                    displayFile(file);
                });
                
                console.log('✅', files.length, 'فایل انتخاب شد');
            }
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
        
        // دکمه میکروفون همیشه نمایش داده میشه
        $('#voiceBtn').show();
        
        // اگر در حال ضبط هستیم، دکمه voiceBtn (که حالا stop شده) رو نگه‌دار
        if (isRecording) {
            // فقط soundwave رو مخفی کن
            $('#soundwaveBtn').hide();
            // sendMessageBtn رو مخفی کن
            $('#sendMessageBtn').hide();
            return;
        }
        
        if (hasText) {
            // مخفی کردن soundwave فقط
            $('#soundwaveBtn').hide();
            // نمایش دکمه ارسال
            $('#sendMessageBtn').show();
        } else {
            // نمایش soundwave
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
        // اگر در حال ارسال یا تولید پاسخ است، نباید پیام جدید بفرستیم
        if (isSending || isGenerating) {
            console.log('⚠️ در حال پردازش... لطفاً صبر کنید');
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
                
                // مخفی کردن چیپس‌ها و هدر (به جای حذف)
                hideChips();
                const startupHeader = document.querySelector('.startup-header');
                if (startupHeader) {
                    startupHeader.style.setProperty('display', 'none', 'important');
                }
                
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
                
                // آپدیت وضعیت چیپس‌ها
                updateChipsVisibility();
                
                // نمایش دکمه اشتراک‌گذاری
                $('#shareBtn').fadeIn(300);
                
                isFirstMessage = false;
            }
            
            // ذخیره پیام کاربر
            if (currentChatId) {
                // مرحله 1: شروع ارسال پیام - نمایش Loading
                isSending = true;
                $('#sendMessageBtn').show();
                $('#voiceBtn').show();
                $('#soundwaveBtn').hide();
                updateSendButtonState();
                
                // پاک کردن فرم
                $('.input-wrapper textarea').val('');
                // آزادسازی تمام URL های پیش‌نمایش قبل از پاکسازی
                try {
                    attachedFiles.forEach(f => { if (f && f.previewUrl) { URL.revokeObjectURL(f.previewUrl); } });
                } catch (e) {}
                attachedFiles = [];
                $('.files-preview').remove();
                clearSelectedTool(); // پاک کردن ابزار انتخاب شده
                $('.reply-box').remove(); // پاک کردن reply box
                selectedQuote = null;
                
                // اگر در حال ضبط بود، اول متوقفش کن
                if (isRecording) {
                    stopRecording();
                }
                
                // شبیه‌سازی ارسال پیام (معمولاً اینجا API call میشه)
                setTimeout(() => {
                    // ارسال موفق - اضافه کردن پیام به چت
                    addMessageToChat(currentChatId, message, 'user');
                    renderMessages(currentChatId);
                    
                    // مرحله 2: پیام ارسال شد - تغییر به Stop (در حال دریافت پاسخ)
                    isSending = false;
                    isGenerating = true;
                    updateSendButtonState();
                    
                    console.log('✅ پیام ارسال شد، در انتظار پاسخ...');
                    
                    // شبیه‌سازی دریافت پاسخ API
                    currentGenerationTimeout = setTimeout(() => {
                        const assistantResponse = 'من پیام شما را دریافت کردم: "' + message + '"';
                        addMessageToChat(currentChatId, assistantResponse, 'assistant');
                        renderMessages(currentChatId);
                        console.log('API Response:', assistantResponse);
                        
                        // مرحله 3: پاسخ دریافت شد - برگشت به حالت عادی
                        isGenerating = false;
                        currentGenerationTimeout = null;
                        updateSendButtonState();
                    }, 3000); // زمان شبیه‌سازی پاسخ API
                }, 800); // زمان شبیه‌سازی ارسال پیام (نمایش loading)
            }
        }
    }
    // تابع به‌روزرسانی حالت دکمه ارسال
    function updateSendButtonState() {
        const $sendBtn = $('#sendMessageBtn');
        
        if (isSending) {
            // حالت 1: در حال ارسال پیام (Loading)
            $sendBtn.html(`
                <div class="spinner-border spinner-border-sm" role="status" style="width: 18px; height: 18px;">
                    <span class="visually-hidden">در حال ارسال...</span>
                </div>
            `);
            $sendBtn.css('border-radius', '50%');
            $sendBtn.prop('disabled', true);
            $sendBtn.show();
            
            // غیرفعال کردن textarea
            $('#chatTextarea').prop('disabled', true).css('opacity', '0.6');
            
            console.log('🔄 حالت: در حال ارسال پیام...');
        } else if (isGenerating) {
            // حالت 2: در حال دریافت پاسخ (Stop)
            $sendBtn.html('<i class="bi bi-stop-fill" style="font-size: 20px; font-weight: bold;"></i>');
            $sendBtn.css('border-radius', '8px'); // تغییر به مربع
            $sendBtn.prop('disabled', false);
            $sendBtn.show();
            
            // غیرفعال کردن textarea
            $('#chatTextarea').prop('disabled', true).css('opacity', '0.6');
            
            console.log('⏹️ حالت: در حال دریافت پاسخ (قابل توقف)');
        } else {
            // حالت 3: عادی (Send)
            $sendBtn.html('<i class="bi bi-arrow-up" style="font-size: 20px; font-weight: bold;"></i>');
            $sendBtn.css('border-radius', '50%'); // برگرداندن به دایره
            $sendBtn.prop('disabled', false);
            $sendBtn.hide();
            
            // نمایش دکمه‌های صدا
            $('#voiceBtn').show();
            $('#soundwaveBtn').show();
            
            // فعال کردن textarea
            $('#chatTextarea').prop('disabled', false).css('opacity', '1');
            
            console.log('✅ حالت: عادی');
        }
    }
    
    // ارسال با کلیک روی دکمه
    $('#sendMessageBtn').on('click', function() {
        // اگر در حال ارسال است، هیچ کاری نکن (دکمه disabled است)
        if (isSending) {
            return;
        }
        
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
        // هدایت به صفحه لیست مدل‌ها
        window.location.href = 'all-models.html';
    });

    // کلیک روی جستجو در دستیار‌ها
    $('.drawer-item').eq(1).on('click', function() {
        console.log('جستجو در دستیار‌ها');
        // هدایت به صفحه جستجو در دستیارها
        window.location.href = 'assistants-search.html';
    });
    
    // دکمه اشتراک‌گذاری
    $('#shareBtn').on('click', function() {
        if (!currentChatId) {
            alert('هنوز چتی ایجاد نشده است.');
            return;
        }
        
        // ساخت URL منحصر به فرد برای چت
        const chatUrl = `${window.location.origin}${window.location.pathname}?chat=${currentChatId}`;
        
        // نمایش مودال اشتراک‌گذاری
        showShareModal(chatUrl);
        
        console.log('✅ لینک اشتراک‌گذاری:', chatUrl);
    });
    
    function showShareModal(chatUrl) {
        // ساخت مودال Bootstrap برای اشتراک‌گذاری
        const modalHtml = `
            <div class="modal fade" id="shareChatModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="background-color: rgb(33, 33, 33); color: white;">
                        <div class="modal-header border-0">
                            <h5 class="modal-title fw-bold">اشتراک‌گذاری گفت‌وگو</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="mb-3">لینک زیر را با دیگران به اشتراک بگذارید:</p>
                            <div class="input-group mb-3">
                                <input type="text" class="form-control bg-dark text-white border-secondary" 
                                       value="${chatUrl}" id="chatUrlInput" readonly>
                                <button class="btn btn-primary" type="button" id="copyChatUrlBtn">
                                    <i class="bi bi-clipboard"></i> کپی
                                </button>
                            </div>
                            <div id="copySuccess" class="alert alert-success d-none" role="alert">
                                <i class="bi bi-check-circle"></i> لینک با موفقیت کپی شد!
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // حذف مودال قبلی اگر وجود داره
        $('#shareChatModal').remove();
        
        // اضافه کردن مودال جدید
        $('body').append(modalHtml);
        
        // نمایش مودال
        const modal = new bootstrap.Modal(document.getElementById('shareChatModal'));
        modal.show();
        
        // Event handler برای دکمه کپی
        $('#copyChatUrlBtn').on('click', function() {
            const urlInput = document.getElementById('chatUrlInput');
            urlInput.select();
            urlInput.setSelectionRange(0, 99999); // برای موبایل
            
            // کپی به کلیپبورد
            navigator.clipboard.writeText(chatUrl).then(function() {
                // نمایش پیام موفقیت
                $('#copySuccess').removeClass('d-none').fadeIn();
                
                // تغییر متن دکمه
                $('#copyChatUrlBtn').html('<i class="bi bi-check"></i> کپی شد!');
                
                // بعد از 2 ثانیه برگردون
                setTimeout(function() {
                    $('#copySuccess').fadeOut();
                    $('#copyChatUrlBtn').html('<i class="bi bi-clipboard"></i> کپی');
                }, 2000);
                
                console.log('✅ لینک کپی شد');
            }).catch(function(err) {
                console.error('❌ خطا در کپی:', err);
                alert('خطا در کپی لینک. لطفاً دستی کپی کنید.');
            });
        });
    }
    
    // بارگذاری چت از URL
    function loadChatFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const chatId = urlParams.get('chat');
        
        if (!chatId) {
            console.log('📌 پارامتر chat در URL وجود ندارد');
            return;
        }
        
        console.log('🔍 جستجوی چت با ID:', chatId);
        
        // بررسی آماده بودن chatManager
        if (!chatManager) {
            console.error('❌ chatManager هنوز آماده نیست. تلاش دوباره...');
            // تلاش دوباره بعد از 500 میلی‌ثانیه
            setTimeout(loadChatFromUrl, 500);
            return;
        }
        
        const chat = chatManager.getChatById(chatId);
        if (chat) {
            currentChatId = chatId;
            
            // مخفی کردن صفحه اول و تایتل
            $('.startup-features').remove();
            $('.startup-header').remove();
            $('.chat-header').remove();
            
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
            
            $('.input-suggestions-container').css({
                'max-width': '900px',
                'margin': '0 auto'
            });
            
            // نمایش پیام‌های چت
            renderMessages(chatId);
            
            // تنظیم استایل container
            $('.chat-container').css({
                'max-width': '900px',
                'margin': '0 auto',
                'padding': '20px'
            });
            
            // نمایش دکمه share
            $('#shareBtn').fadeIn(300);
            
            isFirstMessage = false;
            
            console.log('✅ چت از URL بارگذاری شد:', chatId);
            console.log('📊 تعداد پیام‌ها:', chat.messages ? chat.messages.length : 0);
            console.log('💬 آماده برای ادامه چت');
        } else {
            console.error('❌ چت با این ID پیدا نشد:', chatId);
            console.log('📋 چت‌های موجود:', chatManager.getAll().map(c => c.id));
            alert('چت مورد نظر پیدا نشد. ممکن است حذف شده باشد.');
        }
    }
    
    // بارگذاری چت هنگام لود صفحه - با تاخیر برای اطمینان از آماده بودن chatManager
    setTimeout(function() {
        loadChatFromUrl();
    }, 300);
    
    // ================== سیستم Reply/Quote برای پاسخ‌های AI ==================
    let selectedQuote = null;
    
    // نمایش popup هنگام انتخاب متن
    $(document).on('mouseup', '.message-content', function(e) {
        // کمی تاخیر برای اطمینان از تکمیل selection
        setTimeout(function() {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            if (selectedText.length > 0) {
                // حذف popup قبلی
                $('.quote-popup').remove();
                
                // مختصات انتخاب
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                // ساخت popup
                const popup = $(`
                    <div class="quote-popup">
                        <button class="btn btn-sm btn-primary d-flex align-items-center gap-2">
                            <i class="bi bi-chat-dots"></i>
                            <span>از گپ بپرس</span>
                        </button>
                    </div>
                `);
                
                // موقعیت popup
                popup.css({
                    position: 'fixed',
                    top: rect.top - 50 + 'px',
                    left: rect.left + (rect.width / 2) + 'px',
                    transform: 'translateX(-50%)',
                    zIndex: 9999
                });
                
                $('body').append(popup);
                
                // ذخیره متن انتخاب شده
                selectedQuote = {
                    text: selectedText,
                    messageId: $(e.target).closest('.message-item').data('message-id')
                };
                
                // انیمیشن ورود
                setTimeout(() => popup.addClass('show'), 10);
                
                console.log('📌 متن انتخاب شد:', selectedText.substring(0, 50) + '...');
            } else {
                // اگر انتخاب خالی شد، popup رو حذف کن
                $('.quote-popup').remove();
            }
        }, 50);
    });
    
    // کلیک روی دکمه popup
    $(document).on('click', '.quote-popup button', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (selectedQuote) {
            showReplyBox(selectedQuote.text);
            $('.quote-popup').remove();
            window.getSelection().removeAllRanges();
        }
    });
    
    // حذف popup با کلیک در جای دیگر
    $(document).on('mousedown', function(e) {
        if (!$(e.target).closest('.quote-popup').length && 
            !$(e.target).closest('.message-content').length) {
            $('.quote-popup').remove();
            selectedQuote = null;
        }
    });
    
    // نمایش Reply Box
    function showReplyBox(quotedText) {
        // حذف reply box قبلی
        $('.reply-box').remove();
        
        // ساخت reply box
        const replyBox = $(`
            <div class="reply-box">
                <div class="reply-content">
                    <div class="reply-header">
                        <i class="bi bi-reply-fill"></i>
                        <span>پاسخ به:</span>
                    </div>
                    <div class="reply-text">${escapeHtml(quotedText)}</div>
                </div>
                <button class="btn-close-reply" type="button">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `);
        
        // اضافه کردن به بالای فرم
        $('.input-wrapper').prepend(replyBox);
        
        // انیمیشن ورود
        setTimeout(() => replyBox.addClass('show'), 10);
        
        // فوکوس روی textarea
        $('#chatTextarea').focus();
        
        console.log('✅ Reply box نمایش داده شد');
    }
    
    // حذف Reply Box
    $(document).on('click', '.btn-close-reply', function() {
        $('.reply-box').removeClass('show');
        setTimeout(() => $('.reply-box').remove(), 300);
        selectedQuote = null;
    });
    
    // تابع escape HTML
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

    // کلیک روی چت هیستوری
    $(document).on('click', '.chat-item', function(e) {
        // جلوگیری از باز شدن چت وقتی روی action button کلیک می‌شود
        if ($(e.target).closest('.chat-actions').length || $(e.target).closest('.chat-context-menu').length) {
            return;
        }
        
        const chatId = $(this).data('chat-id');
        console.log('باز کردن چت:', chatId);
        
        // اگر در حالت چت صوتی هستیم، از آن خارج شو
        if (isVoiceChatMode) {
            deactivateVoiceChatMode();
        }
        
        // تنظیم چت فعلی
        currentChatId = chatId;
        
        // مخفی کردن فقط هدر و چیپس‌ها، نه کل startup container
        $('.startup-header').hide();
        $('.startup-features').hide();
        $('.mobile-chips').hide();
        
        // نمایش container پیام‌ها
        $('#chatMessagesContainer').show();
        
        // رندر پیام‌های چت
        renderMessages(chatId);
        
        // نمایش فرم ورودی
        $('.default-input').show();
        
        // نمایش دکمه share
        $('#shareBtn').fadeIn(300);
        
        // بستن سایدبار در موبایل
        if ($(window).width() <= 768) {
            $('.sidebar-drawer').addClass('collapsed');
            $('#sidebarOverlay').removeClass('show');
        }
    });

    // دکمه گفت‌وگو جدید
    $('#newChatBtn').on('click', function() {
        console.log('شروع گفت‌وگوی جدید');
        
        // اگر در حالت چت صوتی هستیم، از آن خارج شو
        if (isVoiceChatMode) {
            deactivateVoiceChatMode();
        }
        
        // ریست کردن چت فعلی
        currentChatId = null;
        
        // ریست کردن وضعیت اولین پیام
        isFirstMessage = true;
        
        // مخفی کردن container پیام‌ها
        $('#chatMessagesContainer').hide().empty();
        
        // نمایش کل startup container و تمام اجزای آن
        $('.startup-container').show();
        
        const startupHeader = document.querySelector('.startup-header');
        if (startupHeader) {
            startupHeader.style.removeProperty('display');
        }
        
        const startupFeatures = document.querySelector('.startup-features');
        if (startupFeatures) {
            // اطمینان از نمایش چیپس‌ها
            startupFeatures.style.setProperty('display', 'flex', 'important');
        }
        
        const mobileChips = document.querySelector('.mobile-chips');
        if (mobileChips) {
            mobileChips.style.setProperty('display', 'block', 'important');
        }
        
        // ریست کردن استایل‌های startup container به حالت اولیه
        $('.startup-container')
            .removeClass('chat-input-footer')
            .css({
                'position': '',
                'bottom': '',
                'right': '',
                'left': '',
                'max-width': '',
                'margin': '',
                'padding': '',
                'z-index': ''
            });
        
        $('.input-suggestions-container').css({
            'max-width': '',
            'margin': ''
        });
        
        // نمایش فرم ورودی
        $('.default-input').show();
        
        // پاک کردن textarea
        $('#chatTextarea').val('');
        
        // مخفی کردن دکمه share
        $('#shareBtn').hide();
        
        // بستن سایدبار در موبایل
        if ($(window).width() <= 768) {
            $('.sidebar-drawer').addClass('collapsed');
            $('#sidebarOverlay').removeClass('show');
        }
        
        // آپدیت وضعیت چیپس‌ها
        updateChipsVisibility();
        
        console.log('✅ صفحه اصلی بازیابی شد');
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
            
            // تنظیم موقعیت UI چت صوتی
            updateVoiceChatPosition();
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
        
        // تنظیم موقعیت UI چت صوتی
        updateVoiceChatPosition();
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
        
        // تنظیم موقعیت UI چت صوتی
        updateVoiceChatPosition();
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
        
        // تنظیم موقعیت UI چت صوتی
        updateVoiceChatPosition();
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

    // Tools menu item click handlers - حذف شده چون سیستم جدید در خط 279 پیاده‌سازی شده
    // Event handler جدید از طریق delegation کار می‌کند

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
        
        // تنظیم موقعیت UI چت صوتی
        updateVoiceChatPosition();
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
        
        // تنظیم موقعیت UI چت صوتی
        updateVoiceChatPosition();
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
