// Minimal stand-in for workerd's `cloudflare:workers` module in Node tests.
export class WorkerEntrypoint {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
    }
}
