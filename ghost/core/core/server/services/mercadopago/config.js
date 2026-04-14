const logging = require('@tryghost/logging');
const labs = require('../../../shared/labs');

/**
 * @typedef {object} MercadoPagoURLConfig
 * @prop {string} checkoutSuccessUrl
 * @prop {string} checkoutFailureUrl
 * @prop {string} checkoutPendingUrl
 * @prop {string} webhookHandlerUrl
 */

module.exports = {
    /**
     * @param {object} deps
     * @param {object} deps.config
     * @param {object} deps.urlUtils
     * @param {object} deps.settingsHelpers
     * @returns {import('./mercadopago-api').IMercadoPagoAPIConfig|null}
     */
    getConfig({config, urlUtils, settingsHelpers}) {
        if (!labs.isSet('mercadoPago')) {
            return null;
        }

        const keys = settingsHelpers.getMercadoPagoKeys?.();
        if (!keys) {
            return null;
        }

        const siteUrl = urlUtils.getSiteUrl();

        const successUrl = new URL(siteUrl);
        successUrl.searchParams.set('mercadopago', 'success');

        const failureUrl = new URL(siteUrl);
        failureUrl.searchParams.set('mercadopago', 'failure');

        const pendingUrl = new URL(siteUrl);
        pendingUrl.searchParams.set('mercadopago', 'pending');

        const webhookHandlerUrl = new URL('members/webhooks/mercadopago/', siteUrl);

        const env = config.get('env');
        let webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

        if (env !== 'production' && !webhookSecret) {
            webhookSecret = 'DEFAULT_MP_WEBHOOK_SECRET';
            logging.warn('Cannot validate MercadoPago webhooks in development without MERCADOPAGO_WEBHOOK_SECRET.');
        }

        return {
            ...keys,
            checkoutSuccessUrl: successUrl.href,
            checkoutFailureUrl: failureUrl.href,
            checkoutPendingUrl: pendingUrl.href,
            webhookHandlerUrl: webhookHandlerUrl.href,
            webhookSecret,
            testEnv: config.get('env').startsWith('test')
        };
    }
};
