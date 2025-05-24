/**
 * @typedef {Object} MessageOptions
 * @property {string} [id] - The ID of the message.
 * @property {string} [type] - The type of the message.
 * @property {Date} [timestamp] - The timestamp of the message.
 * @property {string} [topic] - The topic of the message.
 * @property {string[]} [tags] - The tags of the message.
 * @property {number} [ttl] - The time to live of the message.
 * @property {MessageHeaders} [headers] - The headers of the message.
 */


/**
 * @typedef {Object} MessageHeaders
 * @property {string} id - The ID of the message.
 * @property {string} type - The type of the message.
 * @property {Date} timestamp - The timestamp of the message.
 * @property {string} [previousId] - The ID of the previous message.
 * @property {string} [topic] - The topic of the message.
 * @property {string[]} [tags] - The tags of the message.
 */

/**
 * @typedef {Object} MessageObject
 * @property {MessageHeaders} headers - The headers of the message.
 * @property {any} data - The data of the message.
 */

export class Message {
    /** @type {any} */
    data = null;
    /** @type {MessageHeaders} */
    headers = { protocol: "helios-starling" };
    /** @type {'outgoing'|'incoming'} */
    direction = "outgoing";

    /** @type {boolean} */
    acked = false;
    /** @type {Date} */
    emittedAt = null;
    /** @type {Number} */
    ttl;



    get id() { return this.headers.id; }
    get type() { return this.headers.type; }
    get timestamp() { return this.headers.timestamp; }
    get previousId() { return this.headers.previousId; }

    /**
     * @template {NewableFunction} T
     * @param {Any} data 
     * @param {MessageOptions} options
     * @param {T} _class
     * @returns {InstanceType<T>}
     */
    static outgoing(data, options, _class = Message) {
        const message = new (_class)();
        message.headers = {
            ...message.headers,
            ...options?.headers,
            id: "s-" + (options?.id || crypto.randomUUID()),
            type: options?.type || "text",
            timestamp: options?.timestamp || new Date(),
            ...(options?.topic ? { topic: options.topic } : {}),
            ...(options?.tags ? { tags: options.tags } : {}),
            ...(options?.previousId ? { previousId: options.previousId } : {})
        };
        message.data = data;
        message.direction = "outgoing";
        message.ttl = options?.ttl || null;
        return message;
    }


    /**
     * @template {NewableFunction} T
     * @param {MessageObject} init
     * @param {T} _class
     * @returns {InstanceType<T>}
     */
    static incoming(init, _class = Message) {
        const message = new (_class)();
        message.headers = {
            ...init.headers,
            id: init.headers.id || "c-" + crypto.randomUUID(),
            type: init.headers.type || "text",
            timestamp: init.headers.timestamp || new Date(),
        };
        message.data = init.data;
        message.direction = "incoming";
        return message;
    }

    toString() {
        return JSON.stringify({
            headers: this.headers,
            data: this.transformedData
        }, null, 2);
    }

    get transformedData() {
        if (this.type === "json") {
            return JSON.parse(this.data);
        } else if (this.type === "text") {
            return this.data;
        } else if (this.type === "binary") {
            return new Uint8Array(this.data);
        } else {
            return this.data;
        }
    }
}