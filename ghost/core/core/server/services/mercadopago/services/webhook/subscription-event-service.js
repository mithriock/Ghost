const logging = require('@tryghost/logging');

/**
 * Handles MercadoPago subscription (preapproval) webhook events.
 * Equivalent to Stripe's SubscriptionEventService.
 */
class MercadoPagoSubscriptionEventService {
    /**
     * @param {object} deps
     * @param {import('../../mercadopago-api')} deps.api
     * @param {object} deps.memberRepository
     */
    constructor(deps) {
        this.api = deps.api;
        Object.defineProperty(this, 'memberRepository', {
            get: () => deps.memberRepository
        });
    }

    /**
     * Handles a subscription (preapproval) event from MercadoPago.
     *
     * @param {string} preapprovalId - The preapproval ID from the notification
     * @returns {Promise<void>}
     */
    async handleSubscriptionEvent(preapprovalId) {
        let subscriptionData;
        try {
            subscriptionData = await this.api.getSubscription(preapprovalId);
        } catch (err) {
            logging.error(`MercadoPago: Failed to fetch subscription ${preapprovalId}`);
            logging.error(err);
            return;
        }

        const status = subscriptionData.status;
        const email = subscriptionData.payer_email;

        logging.info(`MercadoPago: Subscription ${preapprovalId} status: ${status} for ${email}`);

        switch (status) {
        case 'authorized':
        case 'pending':
            await this._handleActiveSubscription(subscriptionData, email);
            break;
        case 'paused':
            logging.info(`MercadoPago: Subscription ${preapprovalId} paused for ${email}`);
            break;
        case 'cancelled':
            await this._handleCancelledSubscription(subscriptionData, email);
            break;
        default:
            logging.info(`MercadoPago: Unhandled subscription status "${status}" for ${preapprovalId}`);
        }
    }

    /**
     * @private
     */
    async _handleActiveSubscription(subscriptionData, email) {
        if (!email) {
            logging.warn(`MercadoPago: Subscription ${subscriptionData.id} has no payer email`);
            return;
        }

        try {
            let member = await this.memberRepository.get({email});
            if (!member) {
                member = await this.memberRepository.create({email});
                logging.info(`MercadoPago: Created new member for subscription: ${email}`);
            }
        } catch (err) {
            logging.error('MercadoPago: Error handling active subscription');
            logging.error(err);
        }
    }

    /**
     * @private
     */
    async _handleCancelledSubscription(subscriptionData, email) {
        if (!email) {
            return;
        }

        try {
            const member = await this.memberRepository.get({email});
            if (member) {
                logging.info(`MercadoPago: Subscription cancelled for member ${email}`);
            }
        } catch (err) {
            logging.error('MercadoPago: Error handling cancelled subscription');
            logging.error(err);
        }
    }
}

module.exports = MercadoPagoSubscriptionEventService;
