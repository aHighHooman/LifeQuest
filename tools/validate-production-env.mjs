import {
    REQUIRED_PRODUCTION_ENV,
    findMissingProductionEnv
} from './production-env.mjs';

const missingVariables = findMissingProductionEnv(process.env);

if (missingVariables.length > 0) {
    console.error(
        `Production build blocked: missing required configuration: ${missingVariables.join(', ')}`
    );
    process.exitCode = 1;
} else {
    console.log(
        `Production configuration validated (${REQUIRED_PRODUCTION_ENV.length} required variables present).`
    );
}
