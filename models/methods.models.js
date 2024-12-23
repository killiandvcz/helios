import {RequestContext} from "./context.model";

export class Methods {

    /**
     * @param helios {Helios}
     */
    constructor(helios) {
        this.helios = helios;
        this.methods = new Map();
        this.reservedNames = new Set(['system', 'internal', 'stream', 'helios', 'starlings', 'starling']);
    }

    /**
     * @param method {Method}
     * @throws {Error} If the method is invalid
     */
    add = (method) => {
        if (!(method instanceof Method)) {
            throw new Error("method is not an instance of Method");
        }

        if (!method.internal) {
            this.validateMethodName(method.name);
        }
        this.methods.set(method.name, method);
        this.helios.events.emit('methods:added', {method, debug: {
                message: `Method "${method.name}" added`,
                type: 'info'
            }});
    }


    /**
     * @param {Method|string} method
     * @returns {boolean}
     */
    remove = (method) => {
        const name = method instanceof Method ? method.name : method;
        return this.methods.delete(name);
    }

    /**
     * @param {string} name
     * @returns {Method|undefined}
     */
    get = (name) => {
        return this.methods.get(name);
    }

    /**
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
        return this.methods.has(name);
    }

    /**
     * @private
     * @param {string} name
     * @throws {Error} If the name is invalid
     */
    validateMethodName = (name) => {
        if (!name || typeof name !== 'string') {
            throw new Error("Method name must be a non-empty string");
        }

        if (name.length < 3) {
            throw new Error("Method name must be at least 3 characters long");
        }

        if (!/^[a-zA-Z][\w:]*$/.test(name)) {
            throw new Error("Method name must start with a letter and contain only letters, numbers, underscores and colons");
        }

        if (this.methods.has(name)) {
            throw new Error(`Method "${name}" already exists`);
        }

        const namespace = name.split(':')[0];
        if (this.reservedNames.has(namespace)) {
            throw new Error(`Namespace "${namespace}" is reserved`);
        }
    }

    /**
     * @returns {string[]}
     */
    getAllMethodNames() {
        return Array.from(this.methods.keys());
    }

    echoAllMethods() {
        console.log("Registered methods:");
        this.methods.forEach((method, name) => {
            console.log("  -", name);
        });
    }

    /**
     * @param {string} namespace
     * @returns {Method[]}
     */
    getMethodsByNamespace(namespace) {
        return Array.from(this.methods.values())
            .filter(method => method.name.startsWith(`${namespace}:`));
    }
}

export class Method {
    /**
     * @param {Helios} helios
     * @param {string} name
     * @param {MethodCallback} callback
     * @param {Object} options
     */
    constructor(helios, name, callback, options = {}) {
        this.helios = helios;
        this.name = name;
        this.callback = callback;
        this.options = options;
    }

    /**
     * @param starling {Starling}
     * @param message {Object}
     */
    execute = async (starling, message) => {
        const context = new RequestContext(starling, message.payload, {
            requestId: message.requestId,
            timestamp: message.timestamp,
            options: this.options
        });

        try {
            return await Promise.race([
                this.callback(context),
                new Promise((resolve, reject) => setTimeout(() => reject(new Error('Method timeout')), this.options.timeout))
            ]);
        } catch (error) {
            console.log("\nError in method", this.name, "\n", error, "\n");
        }
    }
}

/**
 * @callback MethodCallback
 * @param {RequestContext} context
 */