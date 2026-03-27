const PERF_FLAG = 'lq_perf';
const STORE_KEY = '__LQ_PERF__';
const pendingSpans = new Map();

const round = (value) => Math.round(value * 100) / 100;

export const isPerfEnabled = () => {
    if (typeof window === 'undefined') return false;

    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('perf') === '1' || window.localStorage.getItem(PERF_FLAG) === '1';
    } catch {
        return false;
    }
};

const getStore = () => {
    if (typeof window === 'undefined' || !isPerfEnabled()) return null;

    if (!window[STORE_KEY]) {
        const metrics = [];

        window[STORE_KEY] = {
            metrics,
            clear() {
                metrics.length = 0;
                console.info('[LifeQuest Perf] Cleared metrics');
            },
            summary() {
                const grouped = metrics.reduce((acc, metric) => {
                    if (!acc[metric.name]) acc[metric.name] = [];
                    acc[metric.name].push(metric.duration);
                    return acc;
                }, {});

                const rows = Object.entries(grouped).map(([name, durations]) => ({
                    name,
                    count: durations.length,
                    avgMs: round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
                    minMs: round(Math.min(...durations)),
                    maxMs: round(Math.max(...durations)),
                }));

                console.table(rows);
                return rows;
            },
        };
    }

    return window[STORE_KEY];
};

const recordMetric = (name, duration, detail = {}) => {
    const store = getStore();
    if (!store) return;

    const metric = {
        name,
        duration: round(duration),
        detail,
        at: new Date().toISOString(),
    };

    store.metrics.push(metric);
    console.info(`[LifeQuest Perf] ${name}: ${metric.duration}ms`, detail);
};

export const beginTrackedSpan = (name, detail = {}) => {
    if (!isPerfEnabled() || pendingSpans.has(name)) return;

    pendingSpans.set(name, {
        name,
        detail,
        startedAt: performance.now(),
    });
};

export const endTrackedSpan = (name, detail = {}) => {
    if (!isPerfEnabled()) return;

    const span = pendingSpans.get(name);
    if (!span) return;

    pendingSpans.delete(name);

    requestAnimationFrame(() => {
        recordMetric(name, performance.now() - span.startedAt, { ...span.detail, ...detail });
    });
};

export const onProfileRender = (id, phase, actualDuration, baseDuration) => {
    if (!isPerfEnabled()) return;

    recordMetric(`render:${id}`, actualDuration, {
        phase,
        baseDuration: round(baseDuration),
    });
};

export const initPerfMonitor = () => {
    if (!isPerfEnabled()) return;

    const store = getStore();
    if (!store) return;

    console.info('[LifeQuest Perf] Enabled. Use window.__LQ_PERF__.summary() to review metrics.');
};
