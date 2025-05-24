import { Pulse } from "@killiandvcz/pulse";
import { Message } from "./message";

/** 
* @typedef {import('./message').MessageHeaders & {
*   method: string,
* }}  RequestHeaders
*/

/**
 * @typedef {Omit<import('./message').MessageOptions, 'type'> & {
 *  method: string,
 *  timeout?: number,
 * }} RequestOptions
 */

/**
 * @typedef {import('./message').MessageObject & {
 *  headers: RequestHeaders,
 * }} RequestObject
 */

export class Request extends Message {

    constructor() {
        super();
        this.events = new Pulse();
    }

    /** @type {RequestHeaders} */
    headers = { protocol: "helios-starling" };
    
    /**
    * @param {any} payload 
    * @param {RequestOptions} options 
    */
    static outgoing(payload, options) {
        const request = super.outgoing(payload, {
            ...options,
            type: "request",
        }, Request);
        request.headers = {
            ...request.headers,
            method: options.method
        };
        return request;
    }

    /** @param {RequestObject} init */
    static incoming = (init) => super.incoming(init, Request);
    
    get method() { return this.headers.method; }
    
    get payload() { return this.data; }
    set payload(value) { this.data = value; }
}