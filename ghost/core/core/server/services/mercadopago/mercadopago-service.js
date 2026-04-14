const MercadoPagoAPI = require('./mercadopago-api');
const MercadoPagoWebhookController = require('./webhook-controller');
const PaymentEventService = require('./services/webhook/payment-event-service');
const MercadoPagoSubscriptionEventService = require('./services/webhook/subscription-event-service');
const DomainEvents = require('@tryghost/domain-events');
const {MercadoPagoEnabledEvent, MercadoPagoDisabledEvent} = require('./events');

/**
 * @typedef {object} IMercadoPagoServiceConfig
 * @prop {string} accessToken
 * @prop {string} publicKey
 * @prop {string} checkoutSuccessUrl
 * @prop {string} checkoutFailureUrl
 * @prop {string} checkoutPendingUrl
 * @prop {string} webhookHandlerUrl
 * @prop {string} webhookSecret
 * @prop {boolean} testEnv
 */

module.exports = class MercadoPagoService {
    /**
     * @param {object} deps
     * @param {*} deps.labs
     * @param {*} deps.membersService
     * @param {*} deps.donationService
     */
    constructor({labs, membersService, donationService}) {
        const api = new MercadoPagoAPI({labs});

        const paymentEventService = new PaymentEventService({
            api,
            get memberRepository() {
                return membersService.api?.members;
            },
            get productRepository() {
                return membersService.api?.productRepository;
            },
            get eventRepository() {
                return membersService.api?.events;
            },
            get donationRepository() {
                return donationService?.repository;
            },
            sendSignupEmail(email) {
                return membersService.api?.sendEmailWithMagicLink({
                    email,
                    requestedType: 'signup-paid',
                    options: {forceEmailType: true},
                    tokenData: {}
                });
            }
        });

        const subscriptionEventService = new MercadoPagoSubscriptionEventService({
            api,
            get memberRepository() {
                return membersService.api?.members;
            }
        });

        const webhookController = new MercadoPagoWebhookController({
            api,
            paymentEventService,
            subscriptionEventService
        });

        this.api = api;
        this.webhookController = webhookController;
    }

    async connect() {
        DomainEvents.dispatch(MercadoPagoEnabledEvent.create({message: 'MercadoPago Enabled'}));
    }

    async disconnect() {
        this.api.configure(null);
        DomainEvents.dispatch(MercadoPagoDisabledEvent.create({message: 'MercadoPago Disabled'}));
    }

    /**
     * Configures the MercadoPago API and webhook controller.
     *
     * @param {IMercadoPagoServiceConfig} config
     */
    async configure(config) {
        this.api.configure({
            accessToken: config.accessToken,
            publicKey: config.publicKey,
            checkoutSuccessUrl: config.checkoutSuccessUrl,
            checkoutFailureUrl: config.checkoutFailureUrl,
            checkoutPendingUrl: config.checkoutPendingUrl,
            webhookHandlerUrl: config.webhookHandlerUrl,
            testEnv: config.testEnv
        });

        this.webhookController.configure({
            webhookSecret: config.webhookSecret
        });
    }
};
