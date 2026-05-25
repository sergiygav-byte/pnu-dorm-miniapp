/**
 * Кешування даних для оптимізації продуктивності
 * Зменшує кількість запитів до Supabase
 */
(function (global) {
    const CACHE_DURATION = 30000; // 30 секунд
    const FAST_CACHE_DURATION = 5000; // 5 секунд для динамічних даних
    
    let dataCache = {};
    let timestampCache = {};

    function getCacheKey(type) {
        return `dorm_cache_${type}`;
    }

    function isCacheValid(type) {
        const key = getCacheKey(type);
        if (!timestampCache[key]) return false;
        
        const now = Date.now();
        const cacheTime = timestampCache[key];
        const duration = type === 'duty' || type === 'polls' ? FAST_CACHE_DURATION : CACHE_DURATION;
        
        return (now - cacheTime) < duration;
    }

    function getFromCache(type) {
        if (!isCacheValid(type)) return null;
        const key = getCacheKey(type);
        return dataCache[key] || null;
    }

    function setInCache(type, data) {
        const key = getCacheKey(type);
        dataCache[key] = data;
        timestampCache[key] = Date.now();
    }

    function clearCache(type) {
        if (type) {
            const key = getCacheKey(type);
            delete dataCache[key];
            delete timestampCache[key];
        } else {
            dataCache = {};
            timestampCache = {};
        }
    }

    // Кеш для конкретних типів даних
    const cacheHelpers = {
        goals: {
            get: () => getFromCache('goals'),
            set: (data) => setInCache('goals', data),
            isValid: () => isCacheValid('goals')
        },
        payments: {
            get: () => getFromCache('payments'),
            set: (data) => setInCache('payments', data),
            isValid: () => isCacheValid('payments')
        },
        expenses: {
            get: () => getFromCache('expenses'),
            set: (data) => setInCache('expenses', data),
            isValid: () => isCacheValid('expenses')
        },
        events: {
            get: () => getFromCache('events'),
            set: (data) => setInCache('events', data),
            isValid: () => isCacheValid('events')
        },
        duty: {
            get: () => getFromCache('duty'),
            set: (data) => setInCache('duty', data),
            isValid: () => isCacheValid('duty')
        },
        leaders: {
            get: () => getFromCache('leaders'),
            set: (data) => setInCache('leaders', data),
            isValid: () => isCacheValid('leaders')
        },
        complaints: {
            get: () => getFromCache('complaints'),
            set: (data) => setInCache('complaints', data),
            isValid: () => isCacheValid('complaints')
        },
        polls: {
            get: () => getFromCache('polls'),
            set: (data) => setInCache('polls', data),
            isValid: () => isCacheValid('polls')
        },
        sanitaryComments: {
            get: () => getFromCache('sanitaryComments'),
            set: (data) => setInCache('sanitaryComments', data),
            isValid: () => isCacheValid('sanitaryComments')
        },
        content: {
            get: () => getFromCache('content'),
            set: (data) => setInCache('content', data),
            isValid: () => isCacheValid('content')
        }
    };

    // Публічний API
    global.DormCache = {
        get: getFromCache,
        set: setInCache,
        clear: clearCache,
        isValid: isCacheValid,
        helpers: cacheHelpers,
        
        // Швидка перевірка всіх кешів
        getStatus: () => {
            const status = {};
            const types = ['goals', 'payments', 'expenses', 'events', 'duty', 'leaders', 'complaints', 'polls', 'sanitaryComments', 'content'];
            types.forEach(type => {
                status[type] = isCacheValid(type);
            });
            return status;
        },
        
        // Отримати термін дії кешу
        getCacheAge: (type) => {
            const key = getCacheKey(type);
            if (!timestampCache[key]) return Infinity;
            return Date.now() - timestampCache[key];
        }
    };
})(window);