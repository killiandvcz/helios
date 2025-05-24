import { Message } from "./message";

/** 
* @typedef {import('./message').MessageHeaders & {
*   requestId: string,
*   status: number,
* }}  ResponseHeaders
*/

/**
 * @typedef {Omit<import('./message').MessageOptions, 'type'> & {
 *  headers: ResponseHeaders,
 *  status: number,
 *  requestId: string,
 * }} ResponseOptions
 */

export class Response extends Message {
    /** @type {ResponseHeaders} */
    headers = { protocol: "helios-starling" };
    
    /**
    * @param {any} payload 
    * @param {ResponseOptions} options 
    */
    static outgoing(payload, options) {
        const response = super.outgoing(payload, {
            ...options,
            headers: {
                status: options.status || 200,
                requestId: options.requestId || "",
                ...options.headers,
            },
            type: "response",
        }, Response);

        response.headers = { ...response.headers };
        return response;
    }

    static incoming = (init) => super.incoming(init, Response);
    
    get payload() { return this.data; }
    set payload(value) { this.data = value; }
}