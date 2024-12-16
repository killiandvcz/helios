import {Starlings, Starling} from "./starlings.models";
import {Methods, Method} from "./methods.models";
import {jwtVerify} from "jose";

export class Helios {
    constructor(options = {}) {
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
            connection: crypto.getRandomValues(new Uint8Array(32)),
        }
        console.log("Helios created", this.id);
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
        try {
            const recoverToken = ws.data?.recover;
            if (recoverToken) {
                const {payload: tokenData} = await jwtVerify(recoverToken, this.keys.connection);

                const existingStarling = this.starlings.getById(tokenData.starlingId);

                if (existingStarling) {
                    // On retire d'abord le lien avec l'ancien websocket
                    this.starlings.unlinkWebSocket(existingStarling);
                    // On met à jour le websocket et on relie
                    existingStarling.link(ws);

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
        console.error({error});
    }
}