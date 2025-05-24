import {Pulse} from "@killiandvcz/pulse";
import { Starlings } from "../managers/starlings";
import { Methods } from "../managers/methods";

/**
 * @callback proxyHandler
 * @param {import('../core/context').ProxyContext} context
 * @returns {Promise<any>}
 */

export class Helios {
    constructor() {
        this.events = new Pulse();
        this.starlings = new Starlings(this);
        this.methods = new Methods(this);
        this.proxyHandler = null;

        this.starlings.events.on("**", event => this.events.emit("starlings:" + event.topic, event.data));
    }
    /** @type {import('bun').Server | null} */
    #server = null;
    
    
    #handlers = {
        /**
        * @param {import('bun').ServerWebSocket} ws WebSocket connection
        */
        open: async ws => {
            console.log(`🔗 WebSocket connection opened: ${ws.remoteAddress}`);
            await this.starlings.connect(ws);
        },
        /**
        * @param {import('bun').ServerWebSocket} ws WebSocket connection
        * @param {string|ArrayBuffer|Uint8Array} message Raw message data
        */
        message: (ws, message) => {
            const starling = this.starlings.get(ws);
            if (!starling) {
                console.error(`❌ Starling not found for WebSocket connection: ${ws.remoteAddress}`);
                return;
            }
            starling.handle(message);
        },
        
        /**
        * @param {import('bun').ServerWebSocket} ws WebSocket connection
        * @param {string} code Close code
        * @param {string} reason Close reason
        */
        close: (ws, code, reason) => {
            console.log(`🔒 WebSocket connection closed: ${ws.remoteAddress} (${code}) ${reason}`);
            this.starlings.clear(ws);
        },

        /**
        * @param {import('bun').ServerWebSocket} ws WebSocket connection
        * @param {Error} error Error object
        */
        error: (ws, error) => {
            console.error(`❌ WebSocket error: ${ws.remoteAddress} (${error.cause}) ${error.message}`);
        }
    }

    /**
     * @param {String} method 
     * @param {import('./method').MethodHandler} handler 
     */
    method = (method, handler) => this.methods.register(method, handler);


    /**
     * @param {proxyHandler} handler
     * @returns {void}
     */
    useProxy = (handler) => {
        if (typeof handler !== "function") throw new Error("Proxy handler must be a function");
        this.proxyHandler = handler;
    }

    /**
     * @param {Request} req 
     * @param {import('bun').Server} server 
     * @returns {Response}
     */
    #fetch = (req, server) => {
        const protocol = req.headers.get("sec-websocket-protocol");
        if (protocol !== "helios-starling") return new Response("Invalid protocol", {status: 400});
        if (server.upgrade(req)) return;
        return new Response("Upgrade failed", {status: 500});
    }

    get handlers() { return this.#handlers; }
    get fetch() { return this.#fetch; }

    serve = (port) => {
        try {
            this.#server = Bun.serve({
                ...(port ? {port} : {}),
                fetch: (req, server) => this.#fetch(req, server),
                websocket: this.#handlers
            })
            console.log(`🚀 Helios server started on port ${this.#server.port}`);

            return this.#server;
        } catch (error) {
            console.error(`❌ Failed to start Helios server: ${error.message}`);
        }
    }

    /** @param {(starling: import('../core/starling').Starling) => void} callback */
    onconnection = (callback) => this.events.on("starlings:new", event => callback(event.data.starling));
}