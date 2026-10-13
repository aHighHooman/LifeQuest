import { useEffect, useState } from 'react';

// Refresh at minute boundaries, and immediately after a suspended tab resumes.
export const useLocalMinute = () => {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        let timer;
        const refresh = () => {
            clearTimeout(timer);
            const current = new Date();
            setNow(current);
            timer = setTimeout(refresh, 60000 - current.getTime() % 60000);
        };
        timer = setTimeout(refresh, 60000 - Date.now() % 60000);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, []);
    return now;
};
