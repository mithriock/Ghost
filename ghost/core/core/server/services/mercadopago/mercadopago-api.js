const debug = require('@tryghost/debug')('mercadopago');

/**
 * @typedef {object} IMercadoPagoAPIConfig
 * @prop {string} accessToken
 * @prop {string} publicKey
 * @prop {string} checkoutSuccessUrl
 * @prop {string} checkoutFailureUrl
 * @prop {string} checkoutPendingUrl
 * @prop {string} webhookHandlerUrl
 * @prop {boolean} testEnv
 */

module.exports = class MercadoPagoAPI {
    _client = null;
    _configured = false;

    constructor(deps) {
        this.labs = deps.labs;
    }

    get configured() {
        return this._configured;
    }

    get testEnv() {
        return this._config?.testEnv ?? false;
    }

    /**
     * @param {IMercadoPagoAPIConfig} config
     */
    configure(config) {
        if (!config) {
            this._client = null;
            this._configured = false;
            return;
        }

        const {MercadoPagoConfig} = require('mercadopago');

        this._client = new MercadoPagoConfig({
            accessToken: config.accessToken,
            options: {timeout: 5000}
        });

        this._config = config;
        this._configured = true;
    }

    /**
     * Creates a Checkout Pro preference (equivalent to Stripe's checkout session).
     *
     * @param {object} options
     * @param {Array<{title: string, quantity: number, unit_price: number, currency_id?: string}>} options.items
     * @param {object} [options.payer]
     * @param {string} [options.payer.email]
     * @param {string} [options.externalReference]
     * @param {object} [options.metadata]
     * @param {string} [options.successUrl]
     * @param {string} [options.failureUrl]
     * @param {string} [options.pendingUrl]
     * @param {string} [options.notificationUrl]
     *
     * @returns {Promise<{id: string, init_point: string, sandbox_init_point: string}>}
     */
    async createPreference(options) {
        debug(`createPreference(${JSON.stringify(options)})`);
        const {Preference} = require('mercadopago');
        const preference = new Preference(this._client);

        const body = {
            items: options.items,
            back_urls: {
                success: options.successUrl || this._config.checkoutSuccessUrl,
                failure: options.failureUrl || this._config.checkoutFailureUrl,
                pending: options.pendingUrl || this._config.checkoutPendingUrl
            },
            auto_return: 'approved',
            notification_url: options.notificationUrl || this._config.webhookHandlerUrl,
            external_reference: options.externalReference || undefined,
            metadata: options.metadata || undefined
        };

        if (options.payer?.email) {
            body.payer = {email: options.payer.email};
        }

        const response = await preference.create({body});
        debug(`createPreference -> Success (id: ${response.id})`);
        return response;
    }

    /**
     * Creates a subscription (preapproval) for recurring payments.
     *
     * @param {object} options
     * @param {string} options.reason - Description of the subscription
     * @param {string} options.payerEmail
     * @param {number} options.transactionAmount
     * @param {string} [options.currencyId='ARS']
     * @param {'monthly'|'yearly'} [options.frequency='monthly']
     * @param {string} [options.externalReference]
     * @param {string} [options.backUrl]
     *
     * @returns {Promise<object>}
     */
    async createSubscription(options) {
        debug(`createSubscription(${JSON.stringify(options)})`);
        const {PreApproval} = require('mercadopago');
        const preapproval = new PreApproval(this._client);

        const frequencyMap = {
            monthly: {frequency: 1, frequency_type: 'months'},
            yearly: {frequency: 12, frequency_type: 'months'}
        };

        const freq = frequencyMap[options.frequency || 'monthly'];

        const body = {
            reason: options.reason,
            payer_email: options.payerEmail,
            auto_recurring: {
                frequency: freq.frequency,
                frequency_type: freq.frequency_type,
                transaction_amount: options.transactionAmount,
                currency_id: options.currencyId || 'ARS'
            },
            external_reference: options.externalReference || undefined,
            back_url: options.backUrl || this._config.checkoutSuccessUrl,
            status: 'pending'
        };

        const response = await preapproval.create({body});
        debug(`createSubscription -> Success (id: ${response.id})`);
        return response;
    }

    /**
     * Retrieves a payment by ID from MercadoPago.
     *
     * @param {string} paymentId
     * @returns {Promise<object>}
     */
    async getPayment(paymentId) {
        debug(`getPayment(${paymentId})`);
        const {Payment} = require('mercadopago');
        const payment = new Payment(this._client);
        const response = await payment.get({id: paymentId});
        debug(`getPayment(${paymentId}) -> Success (status: ${response.status})`);
        return response;
    }

    /**
     * Retrieves a subscription (preapproval) by ID.
     *
     * @param {string} preapprovalId
     * @returns {Promise<object>}
     */
    async getSubscription(preapprovalId) {
        debug(`getSubscription(${preapprovalId})`);
        const {PreApproval} = require('mercadopago');
        const preapproval = new PreApproval(this._client);
        const response = await preapproval.get({id: preapprovalId});
        debug(`getSubscription(${preapprovalId}) -> Success`);
        return response;
    }

    /**
     * Cancels a subscription (preapproval) by ID.
     *
     * @param {string} preapprovalId
     * @returns {Promise<object>}
     */
    async cancelSubscription(preapprovalId) {
        debug(`cancelSubscription(${preapprovalId})`);
        const {PreApproval} = require('mercadopago');
        const preapproval = new PreApproval(this._client);
        const response = await preapproval.update({
            id: preapprovalId,
            body: {status: 'cancelled'}
        });
        debug(`cancelSubscription(${preapprovalId}) -> Success`);
        return response;
    }

    /**
     * Retrieves a preference by ID.
     *
     * @param {string} preferenceId
     * @returns {Promise<object>}
     */
    async getPreference(preferenceId) {
        debug(`getPreference(${preferenceId})`);
        const {Preference} = require('mercadopago');
        const preference = new Preference(this._client);
        const response = await preference.get({preferenceId});
        debug(`getPreference(${preferenceId}) -> Success`);
        return response;
    }

    /**
     * Returns the public key for frontend initialization.
     *
     * @returns {string}
     */
    getPublicKey() {
        return this._config.publicKey;
    }

    /**
     * Validates the webhook notification is authentic using HMAC.
     *
     * @param {string} xSignature - The x-signature header
     * @param {string} xRequestId - The x-request-id header
     * @param {string} dataId - The data.id from the notification body
     * @param {string} secret - The webhook secret
     * @returns {boolean}
     */
    validateWebhookSignature(xSignature, xRequestId, dataId, secret) {
        if (!xSignature || !secret) {
            return false;
        }

        const crypto = require('node:crypto');

        const parts = xSignature.split(',');
        let ts = '';
        let hash = '';

        for (const part of parts) {
            const [key, value] = part.trim().split('=');
            if (key === 'ts') {
                ts = value;
            }
            if (key === 'v1') {
                hash = value;
            }
        }

        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(manifest);
        const sha = hmac.digest('hex');

        return sha === hash;
    }
};
