import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    REQUIRED_PRODUCTION_ENV,
    findMissingProductionEnv
} from './production-env.mjs';

const populatedEnvironment = Object.fromEntries(
    REQUIRED_PRODUCTION_ENV.map((name) => [name, `test-${name}`])
);

describe('production environment validation', () => {
    it('accepts a fully configured production build', () => {
        expect(findMissingProductionEnv(populatedEnvironment)).toEqual([]);
    });

    it('rejects missing, empty, and whitespace-only values', () => {
        const environment = {
            ...populatedEnvironment,
            VITE_FIREBASE_API_KEY: '',
            VITE_FIREBASE_PROJECT_ID: '   '
        };
        delete environment.VITE_LLM_INTERFACE_ROUTE;

        expect(findMissingProductionEnv(environment)).toEqual([
            'VITE_FIREBASE_API_KEY',
            'VITE_FIREBASE_PROJECT_ID',
            'VITE_LLM_INTERFACE_ROUTE'
        ]);
    });

    it('keeps the deployment guard ahead of the production build', () => {
        const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
        const validationPosition = workflow.indexOf('npm run validate:production-env');
        const buildPosition = workflow.indexOf('npm run build');

        expect(validationPosition).toBeGreaterThan(-1);
        expect(buildPosition).toBeGreaterThan(validationPosition);

        for (const name of REQUIRED_PRODUCTION_ENV) {
            expect(workflow).toContain(`${name}: \${{ secrets.${name} }}`);
        }
    });
});
