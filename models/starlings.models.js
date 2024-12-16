import {BaseMessageSchema, StandardMessageSchema} from "../schemas/messages.schemas";
import {Requests} from "./requests.models";

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
        this.state = 'connected';
        this.disconnectedAt = null;
        this.disconnectionTimeout = null;
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
                this.close();
            }
        }, this.helios.options.disconnectionTTL || 5 * 60 * 1000); // 5 minutes par défaut
    }

    close = () => {
        this.state = 'closed';
        if (this.disconnectionTimeout) {
            clearTimeout(this.disconnectionTimeout);
        }
        this.helios.starlings.remove(this);
    }

    link = (ws) => {
        this.ws = ws;
        // this.state = 'connected';

        // On envoie les messages en attente
        this.messageBuffer.flush();

        if (this.disconnectionTimeout) {
            clearTimeout(this.disconnectionTimeout);
        }
        this.disconnectedAt = null;
    }

    unlink = () => {
        this.ws = null;
        this.state = 'disconnected';
        this.disconnect();
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
                    console.log("Base message", baseResult.error.errors);
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
        method.execute(this, message);
    }

    handleResponse = (message) => {

    }

    handleNotification = (message) => {

    }

    handleError = (message) => {

    }

    handleJsonMessage = (message) => {
        console.log("Json message", message);
    }

    handleTextMessage = (message) => {
        console.log("Text message", message);
    }

    handleBinaryMessage = (message) => {
        console.log("Binary message", message);
    }


    // Send methods

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

    request = (method, payload, options = {}) => {
        const requestId = crypto.randomUUID();
        this.standard("request", {
            requestId,
            method,
            payload,
            options
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