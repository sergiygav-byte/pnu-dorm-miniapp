/**
 * Хмарний шар: Supabase + Storage + опитування + push + тікети скарг
 */
(function (global) {
    const BUCKET = 'dorm-photos';
    const MAX_FILE_MB = 20;

    let supabaseClient = null;
    let mockDB = {
        goals: [],
        payments: [],
        expenses: [],
        events: [],
        duty: [],
        leaders: [],
        complaints: [],
        complaintComments: [],
        polls: [],
        pollVotes: [],
        info: { content: '' },
        rules: { content: '' },
    };

    function getClient() {
        if (!global.SUPABASE_URL || !global.SUPABASE_ANON_KEY) {
            throw new Error('Налаштуйте config.js (див. README)');
        }
        if (!supabaseClient) {
            supabaseClient = global.supabase.createClient(global.SUPABASE_URL, global.SUPABASE_ANON_KEY);
        }
        return supabaseClient;
    }

    function normalizeAttachments(row) {
        if (row.attachments && Array.isArray(row.attachments) && row.attachments.length > 0) {
            return row.attachments;
        }
        const legacy = row.photos_list || [];
        return legacy.map((url) => ({ url, type: 'image' }));
    }

    function mapRowToApp(row, type) {
        switch (type) {
            case 'goals':
                return { id: row.id, title: row.title, desc: row.description, target: Number(row.target_amount) };
            case 'payments':
                return { id: row.id, room: row.room, name: row.name, amount: Number(row.amount), date: row.date, status: row.status };
            case 'expenses':
                return { id: row.id, title: row.title, amount: Number(row.amount), desc: row.description, date: row.date, photosList: row.photos_list || [], attachments: normalizeAttachments(row) };
            case 'events':
                return { id: row.id, title: row.title, desc: row.description, date: row.date, time: row.time, location: row.location };
            case 'duty':
                return { id: row.id, floor: row.floor, wing: row.wing, room: row.room, date: row.date };
            case 'leaders':
                return { id: row.id, role: row.role, name: row.name, phone: row.phone || '', tg: row.tg || '', room: row.room || '' };
            case 'complaints':
                return {
                    id: row.id,
                    subject: row.subject,
                    desc: row.description,
                    status: row.status,
                    date: row.date,
                    photosList: (row.photos_list || []).length ? row.photos_list : normalizeAttachments(row).filter((a) => a.type === 'image').map((a) => a.url),
                    attachments: normalizeAttachments(row),
                    telegramUserId: row.telegram_user_id || '',
                    telegramUsername: row.telegram_username || '',
                    telegramDisplayName: row.telegram_display_name || '',
                };
            case 'complaintComments':
                return {
                    id: row.id,
                    complaintId: row.complaint_id,
                    body: row.body,
                    authorType: row.author_type,
                    createdAt: row.created_at,
                };
            case 'polls':
                return {
                    id: row.id,
                    title: row.title,
                    desc: row.description,
                    options: row.options || [],
                    active: row.active !== false,
                };
            default:
                return row;
        }
    }

    function fileKind(file) {
        const t = (file.type || '').toLowerCase();
        const n = (file.name || '').toLowerCase();
        if (t.startsWith('image/')) return 'image';
        if (t.startsWith('video/')) return 'video';
        if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
        return 'file';
    }

    async function loadDB() {
        const sb = getClient();
        const [goals, payments, expenses, events, duty, leaders, complaints, comments, polls, votes, content] = await Promise.all([
            sb.from('goals').select('*').order('created_at', { ascending: true }),
            sb.from('payments').select('*').order('created_at', { ascending: false }),
            sb.from('expenses').select('*').order('created_at', { ascending: false }),
            sb.from('events').select('*').order('created_at', { ascending: false }),
            sb.from('duty').select('*').order('date', { ascending: true }),
            sb.from('leaders').select('*').order('sort_order', { ascending: true }),
            sb.from('complaints').select('*').order('created_at', { ascending: false }),
            sb.from('complaint_comments').select('*').order('created_at', { ascending: true }),
            sb.from('polls').select('*').order('created_at', { ascending: false }),
            sb.from('poll_votes').select('*'),
            sb.from('content_blocks').select('*'),
        ]);

        const err = [goals, payments, expenses, events, duty, leaders, complaints, comments, polls, votes, content].find((r) => r.error);
        if (err) throw err.error;

        const infoBlock = (content.data || []).find((c) => c.id === 'info');
        const rulesBlock = (content.data || []).find((c) => c.id === 'rules');

        mockDB = {
            goals: (goals.data || []).map((r) => mapRowToApp(r, 'goals')),
            payments: (payments.data || []).map((r) => mapRowToApp(r, 'payments')),
            expenses: (expenses.data || []).map((r) => mapRowToApp(r, 'expenses')),
            events: (events.data || []).map((r) => mapRowToApp(r, 'events')),
            duty: (duty.data || []).map((r) => mapRowToApp(r, 'duty')),
            leaders: (leaders.data || []).map((r) => mapRowToApp(r, 'leaders')),
            complaints: (complaints.data || []).map((r) => mapRowToApp(r, 'complaints')),
            complaintComments: (comments.data || []).map((r) => mapRowToApp(r, 'complaintComments')),
            polls: (polls.data || []).map((r) => mapRowToApp(r, 'polls')),
            pollVotes: votes.data || [],
            info: { content: infoBlock ? infoBlock.content : '' },
            rules: { content: rulesBlock ? rulesBlock.content : '' },
        };
        return mockDB;
    }

    function getDB() {
        return mockDB;
    }

    function getCommentsForComplaint(complaintId) {
        return (mockDB.complaintComments || []).filter((c) => c.complaintId === complaintId);
    }

    function canViewComplaintThread(complaint, telegramUser) {
        if (!complaint) return false;
        if (!telegramUser) return false;
        return complaint.telegramUserId && complaint.telegramUserId === telegramUser.id;
    }

    function getPollResults(pollId) {
        const poll = mockDB.polls.find((p) => p.id === pollId);
        if (!poll) return [];
        const counts = poll.options.map(() => 0);
        mockDB.pollVotes
            .filter((v) => v.poll_id === pollId)
            .forEach((v) => {
                if (v.option_index >= 0 && v.option_index < counts.length) counts[v.option_index]++;
            });
        const total = counts.reduce((a, b) => a + b, 0) || 1;
        return poll.options.map((label, i) => ({
            label,
            count: counts[i],
            percent: Math.round((counts[i] / total) * 100),
        }));
    }

    function getUserVote(pollId, voterTgId) {
        if (!voterTgId) return null;
        const v = mockDB.pollVotes.find((x) => x.poll_id === pollId && x.voter_tg_id === voterTgId);
        return v ? v.option_index : null;
    }

    async function verifyAdmin(password) {
        const sb = getClient();
        const { data, error } = await sb.rpc('verify_admin_password', { p_password: password });
        if (error) throw error;
        return !!data;
    }

    async function trackWebAppVisit(telegramUser) {
        if (!telegramUser?.id) return;
        const sb = getClient();
        const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
        await sb.rpc('track_webapp_visit', {
            p_tg_id: telegramUser.id,
            p_username: telegramUser.username || '',
            p_first_name: u?.first_name || telegramUser.name || '',
            p_last_name: u?.last_name || '',
        });
    }

    async function listBotVisitors(adminPassword) {
        const sb = getClient();
        const { data, error } = await sb.rpc('admin_list_bot_visitors', { p_password: adminPassword });
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    async function uploadPhotosFromInput(fileInput) {
        const files = await uploadFilesFromInput(fileInput);
        return files.filter((f) => f.type === 'image').map((f) => f.url);
    }

    async function uploadFilesFromInput(fileInput, folder = 'uploads') {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) return [];
        const sb = getClient();
        const out = [];
        const files = Array.from(fileInput.files);

        for (const file of files) {
            if (file.size > MAX_FILE_MB * 1024 * 1024) {
                throw new Error(`Файл ${file.name} завеликий (макс. ${MAX_FILE_MB} МБ)`);
            }
            const kind = fileKind(file);
            const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
            const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const { error } = await sb.storage.from(BUCKET).upload(path, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || 'application/octet-stream',
            });
            if (error) throw error;
            const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
            out.push({ url: data.publicUrl, type: kind });
        }
        return out;
    }

    async function notifyPush(title, message, options) {
        const url = global.NOTIFY_API_URL;
        const secret = global.NOTIFY_SECRET;
        if (!url || !secret) return;
        const opts = options || {};
        try {
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Notify-Secret': secret,
                },
                body: JSON.stringify({
                    title,
                    message,
                    target_tg_id: opts.targetTgId || null,
                }),
            });
        } catch (e) {
            console.warn('Push не надіслано', e);
        }
    }

    async function deleteRow(adminPassword, table, id) {
        const sb = getClient();
        const { error } = await sb.rpc('admin_delete_row', {
            p_password: adminPassword,
            p_table: table,
            p_id: id,
        });
        if (error) throw error;
        await loadDB();
    }

    async function insertComplaint({ subject, desc, attachments, telegramUser }) {
        const sb = getClient();
        const id = 'c_' + Date.now();
        const tg = telegramUser || {};
        const { error } = await sb.rpc('insert_complaint_public', {
            p_id: id,
            p_subject: subject,
            p_desc: desc,
            p_attachments: attachments || [],
            p_tg_id: tg.id || '',
            p_tg_username: tg.username || '',
            p_tg_name: tg.name || '',
        });
        if (error) throw error;
        await loadDB();
        await notifyPush('🛠 Нове звернення', `${subject}\n${tg.name ? 'Від: ' + tg.name : ''}`);
    }

    async function addComplaintComment(adminPassword, complaintId, body, complaintForNotify) {
        const sb = getClient();
        const { error } = await sb.rpc('admin_add_complaint_comment', {
            p_password: adminPassword,
            p_complaint_id: complaintId,
            p_body: body,
        });
        if (error) throw error;
        await loadDB();
        const c = complaintForNotify || mockDB.complaints.find((x) => x.id === complaintId);
        const preview = body.length > 120 ? body.slice(0, 120) + '…' : body;
        if (c?.telegramUserId) {
            await notifyPush(
                '💬 Відповідь на ваше звернення',
                `«${c.subject}»\n\n${preview}`,
                { targetTgId: c.telegramUserId }
            );
        } else {
            await notifyPush('💬 Коментар до звернення', `«${c?.subject || 'Звернення'}»\n\n${preview}`);
        }
    }

    async function castVote(pollId, voterTgId, optionIndex) {
        const sb = getClient();
        const { error } = await sb.rpc('cast_poll_vote', {
            p_poll_id: pollId,
            p_voter_tg_id: voterTgId,
            p_option_index: optionIndex,
        });
        if (error) throw error;
        await loadDB();
    }

    async function adminSave(adminPassword, sheet, action, payload) {
        const sb = getClient();
        const pw = adminPassword;

        if (sheet === 'goals') {
            const { error } = await sb.rpc('admin_upsert_goal', {
                p_password: pw,
                p_id: payload.id,
                p_title: payload.title,
                p_desc: payload.desc,
                p_target: payload.target,
            });
            if (error) throw error;
            if (action === 'add') {
                await notifyPush('🎯 Нова ціль збору', `${payload.title}\nЦіль: ${payload.target} ₴`);
            }
        } else if (sheet === 'payments') {
            const { error } = await sb.rpc('admin_upsert_payment', {
                p_password: pw,
                p_id: payload.id,
                p_room: payload.room,
                p_name: payload.name,
                p_amount: payload.amount,
                p_date: payload.date,
                p_status: payload.status,
            });
            if (error) throw error;
            if (action === 'add') {
                await notifyPush(
                    '📥 Новий запис внеску',
                    `Кімн. ${payload.room}, ${payload.name}\n${payload.amount} ₴ — ${payload.status}`
                );
            }
        } else if (sheet === 'expenses') {
            const { error } = await sb.rpc('admin_insert_expense', {
                p_password: pw,
                p_id: payload.id,
                p_title: payload.title,
                p_amount: payload.amount,
                p_desc: payload.desc,
                p_date: payload.date,
                p_photos: payload.photosList || [],
            });
            if (error) throw error;
            await notifyPush('📤 Новий фінансовий звіт', `${payload.title}\n${payload.amount} ₴`);
        } else if (sheet === 'events') {
            const { error } = await sb.rpc('admin_upsert_event', {
                p_password: pw,
                p_id: payload.id,
                p_title: payload.title,
                p_desc: payload.desc,
                p_date: payload.date,
                p_time: payload.time,
                p_location: payload.location,
            });
            if (error) throw error;
            if (action === 'add') {
                await notifyPush('📢 Нове оголошення', payload.title);
            }
        } else if (sheet === 'duty') {
            const { error } = await sb.rpc('admin_insert_duty', {
                p_password: pw,
                p_id: payload.id,
                p_floor: payload.floor,
                p_wing: payload.wing,
                p_room: payload.room,
                p_date: payload.date,
            });
            if (error) throw error;
            await notifyPush(
                '🧹 Чергування',
                `${payload.date}: поверх ${payload.floor}, ${payload.wing} крило, кімн. ${payload.room}`
            );
        } else if (sheet === 'leaders') {
            const { error } = await sb.rpc('admin_upsert_leader', {
                p_password: pw,
                p_id: payload.id,
                p_role: payload.role,
                p_name: payload.name,
                p_phone: payload.phone,
                p_tg: payload.tg,
                p_room: payload.room || '',
            });
            if (error) throw error;
        } else if (sheet === 'complaints') {
            const { error } = await sb.rpc('admin_update_complaint', {
                p_password: pw,
                p_id: payload.id,
                p_subject: payload.subject,
                p_desc: payload.desc,
                p_status: payload.status,
            });
            if (error) throw error;
        } else if (sheet === 'polls') {
            if (action === 'add') {
                const { error } = await sb.rpc('admin_create_poll', {
                    p_password: pw,
                    p_id: payload.id,
                    p_title: payload.title,
                    p_desc: payload.desc,
                    p_options: payload.options,
                });
                if (error) throw error;
                await notifyPush('📊 Нове опитування', payload.title);
            } else if (action === 'close') {
                const pollTitle = mockDB.polls.find((p) => p.id === payload.id)?.title;
                const { error } = await sb.rpc('admin_set_poll_active', {
                    p_password: pw,
                    p_id: payload.id,
                    p_active: false,
                });
                if (error) throw error;
                await notifyPush('📊 Опитування закрито', pollTitle || 'Опитування завершено');
            }
        } else if (sheet === 'info' || sheet === 'rules') {
            const { error } = await sb.rpc('admin_update_content', {
                p_password: pw,
                p_id: sheet,
                p_content: payload.content,
            });
            if (error) throw error;
        }

        await loadDB();
    }

    global.DormDatabase = {
        loadDB,
        getDB,
        getCommentsForComplaint,
        canViewComplaintThread,
        getPollResults,
        getUserVote,
        verifyAdmin,
        trackWebAppVisit,
        listBotVisitors,
        uploadPhotosFromInput,
        uploadFilesFromInput,
        deleteRow,
        insertComplaint,
        addComplaintComment,
        castVote,
        adminSave,
        notifyPush,
    };
})(window);
