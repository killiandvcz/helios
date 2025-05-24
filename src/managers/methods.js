import { Pulse } from "@killiandvcz/pulse";
import { Method } from "../core/method";

/** @typedef {import('../core/method').MethodHandler} MethodHandler */

export class Methods {
    /** @param {import('../core/helios').Helios} helios */
    constructor(helios) {
        this.helios = helios;
        this.events = new Pulse();

        /** @type {Map<string, import('../core/method').Method>} */
        this.methods = new Map();
    }

    /**
     * @param {string} method 
     * @param {} handler 
     */
    register = (method, handler) => {
        const m = new Method(method, handler);
        this.methods.set(m.method, m);
        return m;
    }

    /** @param {string} method */
    get = method => this.methods.get(method);

    /** @param {string} method */
    has = method => this.methods.has(method);

    /** @param {string} method */
    unregister = method => {
        const removed = this.methods.get(method);
        if (removed) {
            this.methods.delete(method);
            return removed;
        }
        return null;
    }

    /**
     * @returns {string[]}
     */
    get list() {
        return [...this.methods.keys()];
    }
}