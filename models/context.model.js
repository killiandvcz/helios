/**
 * @class
 */
export class RequestContext {
    /**
     * @param starling {Starling}
     * @param payload {Object}
     * @param options {Object}
     * @param timestamp {number}
     * @param requestId {string}
     */
    constructor(starling, payload, {options, timestamp, requestId}) {
        /**
         * @type {Starling}
         */
        this.starling = starling;
        this.payload = payload;
        this.options = options;
        this.requestId = requestId;
        this.timestamp = timestamp;
    }

    finished = false;

    success = (data) => {
        if (this.finished) {
            throw new Error("Request already finished");
        } else {
            this.finished = true;
        }
        this.starling.standard("response", {
            requestId: this.requestId,
            success: true,
            data
        });
    }

    error = (code, error) => {
        if (this.finished) {
            throw new Error("Request already finished");
        } else {
            this.finished = true;
        }
        this.starling.standard("response", {
            requestId: this.requestId,
            success: false,
            error: {
                code: code || 'INTERNAL_ERROR',
                message: error
            }
        })
    }

    notification = (data) => {
        if (this.finished) {
            throw new Error("Request already finished");
        }
        this.starling.notify({
            requestId: this.requestId,
            data
        })
    }
}