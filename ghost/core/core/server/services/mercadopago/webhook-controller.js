const logging = require('@tryghost/logging');

/**
 * Handles incoming MercadoPago webhook notifications.
 * Equivalent to Stripe's WebhookController.
 *
 * MercadoPago sends notifications with the following structure:
 *   POST /members/webhooks/mercadopago
 *   Body: { action: "payment.created", data: { id: "12345" }, type: "payment" }
 *   Headers: x-signature, x-request-id
 */
module.exports = class MercadoPagoWebhookController {
    /**
     * @param {object} deps
     * @param {import('./mercadopago-api')} deps.api
     * @param {import('./services/webhook/payment-event-service')} deps.paymentEventService
     * @param {import('./services/webhook/subscription-event-service')} deps.subscriptionEventService
     */
    constructor(deps) {
        this.api = deps.api;
        this.paymentEventService = deps.paymentEventService;
        this.subscriptionEventService = deps.subscriptionEventService;
        this._webhookSecret = null;
    }

    /**
     * @param {object} config
     * @param {string} config.webhookSecret
     */
    configure({webhookSecret}) {
        this._webhookSecret = webhookSecret;
    }

    /**
     * Express handler for MercadoPago webhook notifications.
     *
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @returns {Promise<void>}
     */
    async handle(req, res) {
        if (!req.body) {
            res.writeHead(400);
            return res.end();
        }

        const xSignature = req.headers['x-signature'];
        const xRequestId = req.headers['x-request-id'];
        const dataId = req.body?.data?.id;

        if (this._webhookSecret && this._webhookSecret !== 'DEFAULT_MP_WEBHOOK_SECRET') {
            const isValid = this.api.validateWebhookSignature(
                xSignature,
                xRequestId,
                dataId ? String(dataId) : '',
                this._webhookSecret
            );

            if (!isValid) {
                logging.warn('MercadoPago: Invalid webhook signature');
                res.writeHead(401);
                return res.end();
            }
        }

        const type = req.body.type;
        const action = req.body.action;

        logging.info(`MercadoPago: Received webhook type="${type}" action="${action}" data.id="${dataId}"`);

        try {
            await this.handleEvent(type, action, dataId);
            res.writeHead(200);
            res.end();
        } catch (err) {
            logging.error(`MercadoPago: Error handling webhook type="${type}" action="${action}"`);
            logging.error(err);
            res.writeHead(500);
            res.end();
        }
    }

    /**
     * Routes the event to the appropriate service.
     *
     * @param {string} type - e.g. 'payment', 'subscription_preapproval', 'plan'
     * @param {string} action - e.g. 'payment.created', 'payment.updated'
     * @param {string} dataId - The resource ID
     * @returns {Promise<void>}
     */
    async handleEvent(type, action, dataId) {
        if (!dataId) {
            logging.warn('MercadoPago: Webhook notification missing data.id');
            return;
        }

        switch (type) {
        case 'payment':
            await this.paymentEventService.handlePaymentEvent(String(dataId));
            break;
        case 'subscription_preapproval':
            await this.subscriptionEventService.handleSubscriptionEvent(String(dataId));
            break;
        case 'plan':
            logging.info(`MercadoPago: Plan event received (id: ${dataId}), no handler implemented yet.`);
            break;
        default:
            logging.info(`MercadoPago: Unhandled webhook type "${type}"`);
        }
    }
};
