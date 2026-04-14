const logging = require('@tryghost/logging');

/**
 * Handles MercadoPago payment webhook events (payment.created, payment.updated).
 * Equivalent to Stripe's CheckoutSessionEventService.
 */
class PaymentEventService {
    /**
     * @param {object} deps
     * @param {import('../../mercadopago-api')} deps.api
     * @param {object} deps.memberRepository
     * @param {object} deps.productRepository
     * @param {object} deps.eventRepository
     * @param {object} deps.donationRepository
     * @param {Function} deps.sendSignupEmail
     */
    constructor(deps) {
        this.api = deps.api;
        Object.defineProperties(this, {
            memberRepository: {get: () => deps.memberRepository},
            productRepository: {get: () => deps.productRepository},
            eventRepository: {get: () => deps.eventRepository},
            donationRepository: {get: () => deps.donationRepository},
            sendSignupEmail: {value: deps.sendSignupEmail}
        });
    }

    /**
     * Handles a payment notification from MercadoPago.
     *
     * @param {string} paymentId - The payment ID from the notification
     * @returns {Promise<void>}
     */
    async handlePaymentEvent(paymentId) {
        let paymentData;
        try {
            paymentData = await this.api.getPayment(paymentId);
        } catch (err) {
            logging.error(`MercadoPago: Failed to fetch payment ${paymentId}`);
            logging.error(err);
            return;
        }

        if (paymentData.status !== 'approved') {
            logging.info(`MercadoPago: Payment ${paymentId} status is "${paymentData.status}", skipping.`);
            return;
        }

        const metadata = paymentData.metadata || {};
        const email = paymentData.payer?.email || metadata.email;
        const externalReference = paymentData.external_reference;

        if (!email) {
            logging.warn(`MercadoPago: Payment ${paymentId} has no payer email, cannot process.`);
            return;
        }

        logging.info(`MercadoPago: Processing approved payment ${paymentId} for ${email}`);

        if (metadata.ghost_donation === 'true' || metadata.ghost_donation === true) {
            await this._handleDonation(paymentData, email);
            return;
        }

        await this._handleSubscriptionPayment(paymentData, email, externalReference);
    }

    /**
     * @private
     */
    async _handleDonation(paymentData, email) {
        if (!this.donationRepository) {
            logging.warn('MercadoPago: Donation repository not available');
            return;
        }

        logging.info(`MercadoPago: Recording donation from ${email}`);

        try {
            let member = await this.memberRepository.get({email});
            if (!member) {
                member = await this.memberRepository.create({email});
            }

            await this.donationRepository.save({
                email,
                member_id: member.id,
                amount: paymentData.transaction_amount * 100,
                currency: paymentData.currency_id?.toLowerCase() || 'ars',
                payment_provider: 'mercadopago',
                payment_id: String(paymentData.id)
            });
        } catch (err) {
            logging.error('MercadoPago: Error recording donation');
            logging.error(err);
        }
    }

    /**
     * @private
     */
    async _handleSubscriptionPayment(paymentData, email, externalReference) {
        try {
            let member = await this.memberRepository.get({email});

            if (!member) {
                member = await this.memberRepository.create({email});
                logging.info(`MercadoPago: Created new member for ${email}`);

                try {
                    await this.sendSignupEmail(email);
                } catch (err) {
                    logging.error('MercadoPago: Failed to send signup email');
                    logging.error(err);
                }
            }

            const metadata = paymentData.metadata || {};
            const tierId = metadata.tier_id || externalReference;

            if (tierId && this.productRepository) {
                logging.info(`MercadoPago: Linking member ${email} to tier ${tierId}`);
            }

            if (this.eventRepository) {
                await this.eventRepository.registerPayment({
                    member_id: member.id,
                    amount: paymentData.transaction_amount * 100,
                    currency: paymentData.currency_id?.toLowerCase() || 'ars',
                    payment_provider: 'mercadopago',
                    payment_id: String(paymentData.id)
                });
            }
        } catch (err) {
            logging.error('MercadoPago: Error processing subscription payment');
            logging.error(err);
        }
    }
}

module.exports = PaymentEventService;
