import {z} from 'zod';

export const MessageType = z.enum(['request', 'response', 'stream:init', 'stream:close']);

export const BaseMessageSchema = z.object({
    protocol: z.literal('helios-starling').optional(), // Optionnel pour rétrocompatibilité
    version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(), // Semver
    timestamp: z.number().int().positive(),
    type: MessageType,
});

const RequestSchema = BaseMessageSchema.extend({
    type: z.literal('request'),
    requestId: z.string().uuid(),
    method: z.string().min(3).regex(/^[a-zA-Z][\w.:]*$/),
    payload: z.any().optional(),
});

const ResponseSchema = BaseMessageSchema.extend({
    type: z.literal('response'),
    requestId: z.string().uuid(),
    success: z.boolean(),
    data: z.any().optional(),
    error: z.object({
        code: z.string(),
        message: z.string(),
    }).optional(),
});

const StreamType = z.enum(['audio', 'video', 'file', 'binary', 'custom', 'data_channel', 'media_track', 'composite']);

const StreamInitSchema = BaseMessageSchema.extend({
    type: z.literal('stream:init'),
    streamId: z.string().uuid(),
    streamType: StreamType,
    metadata: z.record(z.any()),
});

const StreamCloseSchema = BaseMessageSchema.extend({
    type: z.literal('stream:close'),
    streamId: z.string().uuid(),
    reason: z.string().optional(),
});

const NotificationSchema = BaseMessageSchema.extend({
    type: z.literal('notification'),
    notification: z.any(),
});

export const StandardMessageSchema = z.discriminatedUnion('type', [
    RequestSchema,
    ResponseSchema,
    StreamInitSchema,
    StreamCloseSchema,
    NotificationSchema,
]);