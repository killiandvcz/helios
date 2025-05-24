import { Response } from '../messages/response';
import { Message } from '../messages/message';
import { Request } from '../messages/request';
import { Starling } from './starling';

export class Context {
    /** @param {import('./starling').Starling} starling */
    constructor(starling) {
        this.starling = starling;
    }
}


export class RequestContext extends Context {
    /** 
    * @param {import('./starling').Starling} starling
    * @param {import('../messages/request').Request} request
    */
    constructor(starling, request) {
        super(starling);
        this.request = request;
    }
    
    /**
    * @param {any} data
    * @param {import('../messages/response').ResponseOptions} options
    */
    success = (data, options = {}) => this.starling.respond(this.request, data, {...options, headers: { status: 200 }, ...(options?.headers || {})});
    
    /** 
    * @param {any} error 
    * @param {import('../messages/response').ResponseOptions} options
    */
    error = (error, options = {}) => this.starling.respond(this.request, error, {...options, headers: { status: 500 }, ...(options?.headers || {})});
    
    finish = () => this.starling.incoming.delete(this.request.id);
}

export class ProxyContext extends Context {
    /**
    * @param {import('./starling').Starling} starling
    * @param {import('../messages/message').Message} message
    */
    constructor(starling, message) {
        super(starling);
        this.message = message;
    }

    /**
     * @param {import('./starling').Starling} to 
     * @returns {Promise<Response|Boolean>}
     */
    forward = async (to) => {
        if (to === this.starling) throw new Error("Cannot forward to self");
        if (!to) throw new Error("No destination starling provided");
        if (!(to instanceof Starling)) throw new Error("Destination must be a Starling instance");
        if (!this.message) throw new Error("No message to forward");

        if (this.message instanceof Request) {
            const request = this.message;
            return to.request(request.method, request.payload, {
                headers: {
                    ...request.headers,
                }
            })
        } else if (this.message instanceof Message) {
            return to.emit(Message.outgoing(this.message.data, {
                headers: { ...this.message.headers }
            }));
        }

        throw new Error("Message type not supported for forwarding");
    }

    /**
     * @param {Any} data 
     * @param {import('../messages/response').ResponseOptions} options 
     */
    reply = (data, options = {}) => {
        console.log(this.message instanceof Request);
        if (!this.message) throw new Error("No message to reply to");
        if (!(this.message instanceof Request)) {
            console.log("Not a request message");
            throw new Error("Cannot peer reply to a non-request message");
        }

        
        return this.starling.respond(this.message, data, {...options, headers: { status: options.status || 200, ...(options?.headers || {})}});
    }


    /**
     * @param {String} reason 
     * @param {Number} status
     */
    deny = (reason = "Proxy denied", status = 403) => {
        if (!(this.message instanceof Request)) throw new Error("Message is not a Request");
        const response = Response.outgoing(reason, {
            headers: { status }
        });
        return this.starling.emit(response);
    }


    get starlings() { return this.starling.helios.starlings }




    
}