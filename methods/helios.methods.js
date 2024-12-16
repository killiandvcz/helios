import {jwtVerify, SignJWT} from "jose";

/**
 * @type {{getStarlingToken: heliosMethods.getStarlingToken}}
 */
export const heliosMethods = {

    /**
     * @param context {RequestContext}
     */
    "starling:getConnectionToken": async (context) => {
        const {starling} = context;
        try {
            const token = await new SignJWT({
                starlingId: starling.id,
                timestamp: Date.now()
            }).setProtectedHeader({alg: "HS256"}).setIssuedAt().setIssuer("helios").setAudience("starling").setExpirationTime("1h").sign(starling.helios.keys.connection);
            context.success({
                token,
                expiresIn: 3600
            })
        } catch (e) {
            context.error("TOKEN_GENERATION_ERROR", 'Failed to generate starling token');
        }
    },
}
