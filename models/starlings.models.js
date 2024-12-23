import {BaseMessageSchema, StandardMessageSchema} from "../schemas/messages.schemas";
import {RequestQueue, Requests} from "./requests.models";
import {jwtVerify, SignJWT} from "jose";

export class Starlings {
    /**
     * @param helios {Helios}
     */
    constructor(helios) {
        /**
         * @type {Helios}
         */
        this.helios = helios;
        /**
         * @type {Map<Bun.ServerWebSocket, Starling>}
         */
        this.starlings = new Map();
        this.starlingsById = new Map();
    }


    /**
     * @param {Starling} starling
     */
    add = (starling) => {
        this.starlings.set(starling.ws, starling);
        this.starlingsById.set(starling.id, starling);

        this.helios.events.emit("starling.connected", {starling, debug: {
                message: "New starling " + starling.id + " connected",
                type: "connection",
            }});
    }


    /**
     * @param {Bun.ServerWebSocket} ws
     * @returns {Starling|undefined}
     */
    get = (ws) => {
        return this.starlings.get(ws);
    }


    /**
     * @param id
     * @returns {Starling|undefined}
     */
    getById = (id) => {
        return this.starlingsById.get(id);
    }



    /**
     * @param {Starling} starling
     */
    remove = (starling) => {
        if (!this.starlings.has(starling.ws)) {
            return false;
        }

        this.starlings.delete(starling.ws);
        this.starlingsById.delete(starling.id);
    }

    unlinkWebSocket = (starling) => {
        this.starlings.delete(starling.ws);
    }

    linkWebSocket = (starling, ws) => {
        if (!starling.ws === ws) {
            throw new Error("Starling and WebSocket do not match");
        }
        this.starlings.set(ws, starling);
    }


}

export class Starling {
    /**
     * @param helios {Helios}
     * @param ws {Bun.ServerWebSocket}
     */
    constructor(helios, ws) {
        this.helios = helios;
        this.ws = ws;
        this.id = crypto.randomUUID();
        this.requests = new Requests(this);
        this.messageBuffer = new MessageBuffer(this);
        this.disconnectedAt = null;
        this.disconnectionTimeout = null;
        this.requestQueue = new RequestQueue(this);
        this.states = new States(this);
    }


    get state() {
        if (!this.ws) return 'disconnected';
        switch (this.ws.readyState) {
            case 0: return 'connecting';
            case 1: return 'connected';
            case 2: return 'closing';
            case 3: return 'disconnected';
            default: return 'unknown';
        }
    }

    get isConnected() {
        return this.state === 'connected';
    }

    get canSend() {
        return this.isConnected && !this.messageBuffer.isFull;
    }

    get isReconnecting() {
        return !this.isConnected && this.disconnectedAt && !this.disconnectionTimeout;
    }



    disconnect = () => {
        this.disconnectedAt = Date.now();

        // On configure le timeout de suppression
        this.disconnectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                this.requestQueue.clear();
                this.close();

            }
        }, this.helios.options.disconnectionTTL || 5 * 60 * 1000); // 5 minutes par défaut
        this.helios.events.emit("starling.disconnected", {starling: this, debug: {
                message: "Starling" + this.id + " disconnected.  disconnected. Will be removed at " + new Date(this.disconnectedAt + (this.helios.options.disconnectionTTL || 5 * 60 * 1000)) + " if not reconnected",
                type: "disconnection",
            }
        });
    }

    close = () => {
        if (this.disconnectionTimeout) {
            clearTimeout(this.disconnectionTimeout);
        }
        this.helios.starlings.remove(this);
        this.helios.events.emit("starling.closed", {starling: this,
            debug: {
                message: "Starling" + this.id + " definitively closed",
                type: "disconnection",
            }
        });
    }

    link = async (ws) => {
        this.ws = ws;

        //TODO: wait for ping/pong

        // On envoie les messages en attente
        this.messageBuffer.flush();

        await new Promise(resolve => setTimeout(resolve, 100));

        if (this.isConnected) {
            this.requestQueue.processQueue();
        }


        if (this.disconnectionTimeout) {
            clearTimeout(this.disconnectionTimeout);
        }
        this.disconnectedAt = null;

        this.helios.events.emit("starling.reconnected", {starling: this, debug: {
                message: "Starling" + this.id + " reconnected",
                type: "connection",
            }
        });
    }

    unlink = () => {
        this.ws = null;
        this.disconnect();
    }

    cleanup() {
        this.requests.cancelAll('Connection closed');
    }


    /**
     * @param {string|ArrayBuffer|Uint8Array} message
     */
    handleMessage = (message) => {
        if (typeof message === "string") {
            try {
                const parsed = JSON.parse(message);

                const baseResult = BaseMessageSchema.safeParse(parsed);
                if (baseResult.success) {
                    const fullResult = StandardMessageSchema.safeParse(parsed);

                    if (fullResult.success) {
                        return this.handleStandardMessage(fullResult.data);
                    } else {
                        this.standard("error", {
                            error: {
                                code: 'INVALID_MESSAGE_FORMAT',
                                message: "Message format does not match the Helios-Starling protocol specification",
                                details: fullResult.error.errors
                            }
                        })
                        return false;
                    }
                } else {

                }
                return this.handleJsonMessage(parsed);
            } catch (e) {
                return this.handleTextMessage(message);
            }
        }
        if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
            return this.handleBinaryMessage(message);
        }
    }

    handleStandardMessage = (message) => {
        switch (message.type) {
            case "request":
                return this.handleRequest(message);
            case "response":
                return this.handleResponse(message);
            case "notification":
                return this.handleNotification(message);
            case "error":
                return this.handleError(message);
            default:
                return this.standard("error", {
                    error: {
                        code: 'INVALID_MESSAGE_TYPE',
                        message: "Invalid message type",
                        details: {
                            type: message.type
                        }
                    }
                })
        }
    }

    handleRequest = (message) => {
        const method = this.helios.methods.get(message.method);
        if (!method) {
            this.helios.events.emit("starling:request", {starling: this, message, method, debug: {
                    message: "Received request " + message.method + " but method not found",
                    type: "request",
                }});
            return this.standard("error", {
                error: {
                    code: 'METHOD_NOT_FOUND',
                    message: "Method not found",
                    details: {
                        method: message.method
                    }
                }
            });
        }
        this.helios.events.emit("starling:request", {starling: this, message, method, debug: {
                message: "Received request " + message.method,
                type: "request",
            }});
        method.execute(this, message);
    }

    handleResponse = (message) => {
        this.requests.handleResponse(message);
    }

    handleNotification = (message) => {
        this.helios.events.emit("starling:notification", {starling: this, message, debug: {
                message: "Received notification from starling " + this.id,
                type: "notification",
            }});

    }

    handleError = (message) => {

    }

    handleJsonMessage = (message) => {
        this.helios.events.emit("starling:message", {starling: this, message, debug: {
                message: "Received json message from starling " + this.id + ": " + JSON.stringify(message),
                type: "message",
            }
        });
    }

    handleTextMessage = (message) => {
        this.helios.events.emit("starling:message", {starling: this, message, debug: {
                message: "Received text message from starling " + this.id + ": " + message,
                type: "message",
            }
        });
    }

    handleBinaryMessage = (message) => {
        console.log("Binary message", message);
    }

    send(message) {
        if (this.isConnected) {
            try {
                this.ws.send(message);
                return true;
            } catch (e) {
                return false;
            }
        } else {
            this.messageBuffer.add(message);
            return false;
        }
    }

    json(message) {
        try {
            this.send(JSON.stringify(message));
            return true;
        } catch (e) {
            return false;
        }
    }

    standard = (type, message) => {
        try {
            this.json({
                protocol: "helios-starling",
                version: "1.0.0",
                timestamp: Date.now(),
                type,
                ...message,
            })
        } catch (e) {
            return false;
        }
    }


    /**
     * @param method {string}
     * @param payload {Object}
     * @param options {Object}
     * @returns {Promise<*>}
     */
    request = async (method, payload, options = {}) => {
        const request = this.requests.create(method, payload, options);
        return request.execute();
    }

    /**
     * @param data {Object}
     */
    notify = (data = {}) => {
        this.standard("notification", {
            notification: data
        });
    }
}

class MessageBuffer {
    constructor(starling) {
        this.starling = starling;
        this.messages = [];
        this.maxSize = 1000; // Configurable
    }

    get isFull() {
        return this.messages.length >= this.maxSize;
    }

    add(message) {
        if (this.messages.length >= this.maxSize) {
            // On peut soit: supprimer le plus vieux message, soit rejeter le nouveau
            this.messages.shift(); // Supprime le plus vieux
        }
        this.messages.push({
            content: message,
            timestamp: Date.now()
        });
        return true;
    }

    flush() {
        // On envoie tous les messages en attente
        while (this.messages.length > 0) {
            const message = this.messages.shift();
            try {
                this.starling.ws.send(message.content);
            } catch (e) {
                // Si erreur, on remet le message dans la queue
                this.messages.unshift(message);
                break;
            }
        }
    }

    clear() {
        this.messages = [];
    }
}

class States {
    constructor(starling) {
        this.starling = starling;
        this.states = new Map();
    }

    /**
     * @param namespace {string}
     * @param save {Function} Should return the state data in a serializable format
     * @param restore {Function} Should restore the state from the data
     * @param validate {Function} Should return true if the data is valid
     */
    register(namespace, {save, restore, validate = () => true}) {
        if (this.states.has(namespace)) {
            throw new Error("State namespace " + namespace + " already registered");
        }
        this.states.set(namespace, {
            save: save.bind(this.starling),
            restore: restore.bind(this.starling),
            validate: validate.bind(this.starling)
        });
    }

    async generateToken() {
        const state = {};
        for (const [namespace, provider] of this.states) {
            try {
                state[namespace] = await provider.save();
            } catch (e) {
                console.error("Failed to save state for namespace " + namespace, e);
            }
        }

        return await new SignJWT({
            starlingId: this.starling.id,
            state,
            timestamp: Date.now()
        }).setProtectedHeader({alg: "HS256"})
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(this.starling.helios.keys.connection);
    }

    restore(token) {
        try {
            const {payload} = jwtVerify(token, this.starling.helios.keys.connection);
            const state = payload.state;
            for (const [namespace, data] of Object.entries(state)) {
                const provider = this.states.get(namespace);
                if (provider) {
                    try {
                        if (provider.validate(data)) {
                            provider.restore(data);
                        }
                    } catch (e) {
                        console.error("Failed to restore state for namespace " + namespace, e);
                    }
                }
            }

            this.starling.helios.events.emit("starling:restored", {starling: this.starling, state, debug: {
                    message: "State restored from token",
                    type: "connection",
                }
            });
        } catch (e) {
            console.error("Failed to restore state from token", e);
        }
    }

    async notify() {
        const token = await this.generateToken();
        this.starling.standard("notification", {
            type: "starling:token",
            data: {
                token,
                expiresIn: 3600
            }
        });
    }
}