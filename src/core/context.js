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
    * @param {import('$/messages/response').ResponseOptions} options
    */
    success = (data, options = {}) => this.starling.respond(this.request, data, {...options, headers: { status: 200 }, ...(options?.headers || {})});
    
    /** 
    * @param {any} error 
    * @param {import('$/messages/response').ResponseOptions} options
    */
    error = (error, options = {}) => this.starling.respond(this.request, error, {...options, headers: { status: 500 }, ...(options?.headers || {})});
    
    finish = () => this.starling.incoming.delete(this.request.id);
}