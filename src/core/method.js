/**
 * @callback MethodHandler
 * @param {import('../core/context').RequestContext} context
 * @returns {Promise<any>}
 */

export class Method {
    /**
     * @param {String} method 
     * @param {(context: import('./context').Context) => Promise<any>} handler
     */
    constructor(method, handler) {
        this.method = method;
        this.handler = handler;
    }

    /** @param {import('./context').Context} context */
    async execute(context) {
        try {
            return await Promise.resolve(this.handler(context));
        } catch (err) {
            context.error(err);
        }

    }
}