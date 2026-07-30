export const REQUIRED_PRODUCTION_ENV = Object.freeze([
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_LIFEQUEST_OWNER_UID',
    'VITE_LIFEQUEST_LLM_UID',
    'VITE_LLM_INTERFACE_ROUTE'
]);

export const findMissingProductionEnv = (environment) => (
    REQUIRED_PRODUCTION_ENV.filter((name) => {
        const value = environment[name];
        return typeof value !== 'string' || value.trim() === '';
    })
);
