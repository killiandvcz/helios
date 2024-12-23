import {Starlings, Starling} from "./starlings.models";
import {Methods, Method} from "./methods.models";
import {jwtVerify} from "jose";
import {internalMethods} from "../methods";
import {Pulse} from "@killiandvcz/pulse";
import {heliosDebug} from "../utils/debug.util";

/**
 * @typedef HeliosOptions {Object}
 * @property {number?} disconnectionTTL
 * @property {string?} connectionKey
 */


export class Helios {
    /**
     * @param {HeliosOptions} options
     */
    constructor(options = {}) {
        /**
         * @type {Pulse}
         */
        this.events = new Pulse();

        /**
         * @type {PrettyDebug}
         */
        this.console = heliosDebug();

        /**
         * @type {Starlings}
         */
        this.starlings = new Starlings(this);
        /**
         * @type {Methods}
         */
        this.methods = new Methods(this);
        this.id = Symbol("Helios");
        this.options = {
            disconnectionTTL: 5 * 60 * 1000, // 5 minutes
            ...options
        };
        this.keys = {
            connection: options.connectionKey || crypto.getRandomValues(new Uint8Array(32)),
        }
        this.console.info("Helios server created");

        this.#setupInternalMethods();
    }

    /**
     *
     * @param name {string}
     * @param handler {MethodCallback}
     * @param options {Object}
     */
    method = (name, handler, options = {}) => {
        const method = new Method(this, name, handler, options);
        this.methods.add(method);
    }

    #setupInternalMethods = () => {
        Object.entries(internalMethods).forEach(([name, handler]) => {
            const method = new Method(this, name, handler);
            method.internal = true;
            this.methods.add(method);
        });
    }


    // HANDLERS FOR WEBSOCKET SERVER
    /**
     * Gestion des messages entrants
     * @param {Bun.ServerWebSocket} ws
     * @param {string|ArrayBuffer|Uint8Array} message
     */
    message = (ws, message) => {
        const starling = this.starlings.get(ws);
        if (starling) {
            starling.handleMessage(message);
        }
    }

    /**
     * Gestion des nouvelles connexions
     * @param {Bun.ServerWebSocket} ws
     */
    open = async (ws) => {
        let shouldCreateNewStarling = true;
        let recoverToken;
        try {
            recoverToken = ws.data?.recover;
            if (recoverToken) {
                const {payload: tokenData} = await jwtVerify(recoverToken, this.keys.connection);

                const existingStarling = this.starlings.getById(tokenData.starlingId);

                if (existingStarling) {
                    this.starlings.unlinkWebSocket(existingStarling);
                    await existingStarling.link(ws);
                    existingStarling.standard("notification", {
                        type: "connection:recovered",
                        timestamp: Date.now()
                    });
                    shouldCreateNewStarling = false;
                }
            }

        } catch (e) {
            console.warn("Failed to recover starling, creating a new one", e);
        }

        if (shouldCreateNewStarling) {
            const starling = new Starling(this, ws);
            if (recoverToken) {
                try {
                    starling.states.restore(recoverToken);
                } catch (e) {
                    console.warn("Failed to restore state", e);
                }
            }
            this.starlings.add(starling);
        }
    }

    /**
     * Gestion des déconnexions
     * @param {Bun.ServerWebSocket} ws
     * @param {number} code
     * @param {string} message
     */
    close = (ws, code, message) => {
        const starling = this.starlings.get(ws);
        if (starling) {
            starling.unlink();
        }
    }

    /**
     * Gestion des erreurs
     * @param {Bun.ServerWebSocket} ws
     * @param {Error} error
     */
    error = (ws, error) => {
        this.console.error("Error", error);
    }

    debug = () => {
        this.events.use(e => {
            if (e.data.debug) {
                this.console[e.data.debug.type](e.data.debug.message);
            }
        })
    }
}