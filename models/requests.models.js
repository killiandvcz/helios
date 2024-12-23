export class Requests {
    constructor(starling) {
        this.starling = starling;
        this.pending = new Map();
    }

    create(method, payload, options) {
        const request = new Request(this.starling, method, payload, options);
        this.pending.set(request.id, request);
        return request;
    }

    get(id) {
        return this.pending.get(id);
    }

    remove(request) {
        this.pending.delete(request.id);
    }

    handleResponse(response) {
        const request = this.pending.get(response.requestId);
        if (request) {
            request.handleResponse(response);
            this.remove(request);
        }
    }

    cancelAll(reason = 'All requests cancelled') {
        for (const request of this.pending.values()) {
            request.cancel(reason);
        }
        this.pending.clear();
    }
}

export class Request {
    constructor(starling, method, payload, options = {}) {
        this.starling = starling;
        this.id = crypto.randomUUID();
        this.method = method;
        this.payload = payload;
        this.options = {
            timeout: 30000, // 30s par défaut
            ...options
        };
        this.timestamp = Date.now();
        this.promise = null;
        this.resolve = null;
        this.reject = null;
        this.timeoutId = null;
        this.retryCount = 0;
    }

    execute() {
        if (!this.promise) {
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;
            });
        }

        if (this.starling.isConnected) {
            this.timeoutId = setTimeout(() => {
                this.handleTimeout();
            }, this.options.timeout);

            this.starling.standard("request", {
                requestId: this.id,
                method: this.method,
                payload: this.payload,
                options: this.options
            });
        } else {
            // Si déconnecté, on met dans la queue
            this.starling.requestQueue.add(this);
        }

        return this.promise;
    }


    handleResponse(response) {
        clearTimeout(this.timeoutId);

        if (response.success) {
            this.resolve(response.data);
        } else {
            this.reject(response.error);
        }
    }

    handleTimeout() {
        this.reject({
            code: 'REQUEST_TIMEOUT',
            message: `Request to method ${this.method} timed out after ${this.options.timeout}ms`
        });
        this.starling.requests.remove(this);
    }

    cancel(reason = 'Request cancelled') {
        clearTimeout(this.timeoutId);
        this.reject({
            code: 'REQUEST_CANCELLED',
            message: reason
        });
        this.starling.requests.remove(this);
    }
}

export class RequestQueue {
    constructor(starling) {
        this.starling = starling;
        this.queue = [];
        this.retryDelays = [1000, 2000, 5000]; // Délais entre les retries
    }

    add(request) {
        request.retryCount = 0;
        this.queue.push(request);

        if (this.starling.isConnected) {
            this.processQueue();
        }
    }

    async processQueue() {
        while (this.starling.isConnected && this.queue.length > 0) {
            const request = this.queue[0];
            try {
                await this.executeRequest(request);
                this.queue.shift();
            } catch (error) {
                if (this.shouldRetry(request)) {
                    await this.scheduleRetry(request);
                    break; // On sort de la boucle pour laisser le retry faire son travail
                } else {
                    this.queue.shift();
                    request.reject(error);
                }
            }
        }
    }

    shouldRetry(request) {
        return request.retryCount < this.retryDelays.length &&
            request.options.retry !== false;
    }

    async scheduleRetry(request) {
        const delay = this.retryDelays[request.retryCount];
        request.retryCount++;

        await new Promise(resolve => setTimeout(resolve, delay));

        if (this.starling.isConnected) {
            this.processQueue();
        }
    }

    executeRequest(request) {
        // Ici on utilise la logique existante du Request
        return request.execute();
    }

    clear() {
        for (const request of this.queue) {
            request.cancel('Queue cleared');
        }
        this.queue = [];
    }
}