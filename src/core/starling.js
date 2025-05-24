import { Message } from "../messages/message";
import { Request } from "../messages/request";
import { Response } from "../messages/response";
import { Pulse } from "@killiandvcz/pulse";
import retry from "p-retry";
import { ProxyContext, RequestContext } from "./context";
import { resolve } from "bun";

export class Starling {
    /** 
    * @param {import('./helios').Helios} helios
    * @param {import('bun').ServerWebSocket} ws */
    constructor(helios, ws) {
        this.helios = helios;
        this.ws = ws;
        this.events = new Pulse();
        this.requests = new Pulse();
        /** @type {Map<string, import('../messages/message').Message>} */
        this.outgoing = new Map();
        /** @type {Map<string, import('../messages/message').Message>} */
        this.incoming = new Map();
        
        this.id = crypto.randomUUID();

        this.data = new Map();
    }
    
    /** 
    * @param {import('../messages/message').Message} message
    */
    emit = async message => {
        if (!(message instanceof Message)) throw new Error("[message] is not an instance of Message");
        if (!message.id) throw new Error("[message] does not have an id");
        this.outgoing.set(message.id, message);
        const string = message.toString();
        this.events.once(`message:${message.id}:ack`, () => {
            message.acked = true;
            this.outgoing.delete(message.id);
            this.events.emit("message:ack", {starling: this, message});
        });
        try {
            await retry(async () => new Promise((resolve, reject) => {
                this.ws.send(string);
                this.events.emit("message:emitted", {starling: this, message});
                const timeout = setTimeout(() => {
                    if (message.acked) return resolve();
                    else reject(new Error("Message timed out"));
                }, 5000);

            }), {
                retries: 5,
            });
            return true;
        } catch (error) {
            this.events.emit("message:emitted:error", {starling: this, error});
            return false;
        }
    }
    
    /** 
    * @param {any} data
    * @param {import("../messages/message").MessageOptions} options
    */
    json = (data, options) => this.emit(Message.outgoing(data, {...options, type: "json" }));
    
    /** 
    * @param {any} data
    * @param {import("../messages/message").MessageOptions} options
    */
    text = (data, options) => this.emit(Message.outgoing(data, {...options, type: "text" }));
    
    /** 
    * @param {any} data
    * @param {import("../messages/message").MessageOptions} options
    */
    binary = (data, options) => this.emit(Message.outgoing(data, {...options, type: "binary" }));
    
    /**
    * @param {string} method
    * @param {any} payload
    * @param {import("../messages/request").RequestOptions} options
    * @returns {Promise<import('../messages/response').Response>}
    */
    request = (method, payload, options) => new Promise((resolve, reject) => {
        const request = Request.outgoing(payload, { method, ...options });
        this.emit(request);
        const timeout = options?.timeout || 5000;
        const timer = setTimeout(() => this.requests.emit(`request:${request.id}:error`, new Error("Request timed out")), timeout);
        const clear = () => {
            this.requests.off(`request:${request.id}:response`);  
            this.requests.off(`request:${request.id}:error`);
            clearTimeout(timer);
        } 
        this.requests.once(`request:${request.id}:response`, (event) => {
            
            clear();
            resolve(event.data);
        });
        this.requests.once(`request:${request.id}:error`, (event) => {
            console.error("Request error received", event.data);
            clear();
            reject(event.data || new Error("Unknown error"));
        });
    });
    
    /**
    * @param {import('../messages/request').Request} request 
    * @param {any} payload
    * @param {import('../messages/response').ResponseOptions} options
    */
    respond = (request, payload, options) => {
        if (!(request instanceof Request)) throw new Error("[request] is not an instance of Request");
        if (!request.id) throw new Error("[request] does not have an id");
        const incoming = this.incoming.get(request.id);
        if (!incoming) throw new Error("[request] is not an incoming request");
        const response = Response.outgoing(payload, { ...options, requestId: request.id });
        this.emit(response);
    }
    
    /**
    * @param {import('../messages/message').Message} message
    */
    ack = (message) => {
        if (!(message instanceof Message)) throw new Error("[message] is not an instance of Message");
        if (!message.id) throw new Error("[message] does not have an id");
        const idBytes = new TextEncoder().encode(message.id);
        const buffer = new Uint8Array(2 + idBytes.length);
        buffer[0] = 0x01; // ACK
        buffer[1] = idBytes.length;
        buffer.set(idBytes, 2);
        this.ws.send(buffer);
    }
    
    /** @param {String | ArrayBuffer | Uint8Array} message */
    handle = (message) => { 
        let type = (message instanceof ArrayBuffer || message instanceof Uint8Array) ? "binary" : typeof message === "string" ? "text" : null;
        
        let incoming;
        if (type === "text") {
            let data;
            try { data = JSON.parse(message); type = "json"; } catch(error) { data = message; type = "text"; }
            if (type === "json") {
                if (data?.headers?.protocol === "helios-starling") {
                    const { headers, data: payload } = data;
                    if (headers?.type === "request") {
                        incoming = Request.incoming({
                            headers: { ...headers, type: "request" },
                            data: payload,
                        });
                    } else if (headers?.type === "response") {
                        incoming = Response.incoming({
                            headers: { ...headers, type: "response" },
                            data: payload,
                        });
                    } else if (headers?.type === "json") {
                        incoming = Message.incoming({
                            headers: { ...headers, type: "json" },
                            data: payload,
                        });
                    } else if (headers?.type === "text") {
                        incoming = Message.incoming({
                            headers: { ...headers, type: "text" },
                            data: payload,
                        });
                    }
                } else {
                    incoming = Message.incoming({
                        headers: {
                            type: "text",
                        },
                        data: message,
                    });
                }
            } else {
                incoming = Message.incoming({
                    headers: {
                        type: "text",
                    },
                    data: message,
                });
            }
        } else if (type === "binary") {
            const bytes = message instanceof ArrayBuffer ? new Uint8Array(message) : message;
            if (bytes[0] === 0x01) {
                // ACK
                const length = bytes[1];
                const idBytes = bytes.slice(2, 2 + length);
                const id = new TextDecoder().decode(idBytes);
                this.events.emit(`message:${id}:ack`, { starling: this, id });
            }
        }
        
        if (incoming) {
            this.ack(incoming);
            this.incoming.set(incoming.id, incoming);
            
            if (incoming instanceof Message) {
                if (incoming.headers?.peer && this.helios.proxyHandler) {
                    console.log("Handling proxy message", incoming.headers.peer);
                    const context = new ProxyContext(this, incoming);
                    this.helios.proxyHandler(context);
                    return;
                }
            }
            
            if (incoming instanceof Response) {
                this.requests.emit(`request:${incoming.headers.requestId}:response`, incoming);
            }

            if (incoming instanceof Request) {       
                const method = this.helios.methods.get(incoming.method);
                if (!method) this.respond(incoming, { error: "Method not found" }, { status: 404 });
                else {
                    const context = new RequestContext(this, incoming);
                    method.execute(context);
                }
            }
            if (incoming instanceof Message) {
                if (incoming.headers.topic) this.listeners.emit(incoming.headers.topic, incoming);
            }
        }
    }
    
    /**
    * @param {String} pattern 
    * @param {(message: import('../messages/message').Message) => void} callback
    * @returns
    */
    on = (pattern, callback) => this.listeners.on(pattern, event => callback(event.data));
    


    set = (key, value) => {
        if (typeof key !== "string") throw new Error("[key] must be a string");
        this.data.set(key, value);
    }

    get = (key) => {
        if (typeof key !== "string") throw new Error("[key] must be a string");
        return this.data.get(key);
    }
    has = (key) => {
        if (typeof key !== "string") throw new Error("[key] must be a string");
        return this.data.has(key);
    }
    delete = (key) => {
        if (typeof key !== "string") throw new Error("[key] must be a string");
        return this.data.delete(key);
    }
}