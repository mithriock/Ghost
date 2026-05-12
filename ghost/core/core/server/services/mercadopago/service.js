const _ = require('lodash');
const MercadoPagoService = require('./mercadopago-service');
const logging = require('@tryghost/logging');
const membersService = require('../members');
const config = require('../../../shared/config');
const urlUtils = require('../../../shared/url-utils');
const events = require('../../lib/common/events');
const {getConfig} = require('./config');
const settingsHelpers = require('../settings-helpers');
const settingsCache = require('../../../shared/settings-cache');
const donationService = require('../donations');
const labs = require('../../../shared/labs');
const models = require('../../models');

async function ensurePortalPlansIncludePaid() {
    try {
        const currentPlans = settingsCache.get('portal_plans') || [];
        const parsed = typeof currentPlans === 'string' ? JSON.parse(currentPlans) : currentPlans;

        const needsMonthly = !parsed.includes('monthly');
        const needsYearly = !parsed.includes('yearly');

        if (needsMonthly || needsYearly) {
            const updatedPlans = [...parsed];
            if (needsMonthly) {
                updatedPlans.push('monthly');
            }
            if (needsYearly) {
                updatedPlans.push('yearly');
            }

            logging.info('MercadoPago: updating portal_plans to include monthly/yearly');
            await models.Settings.edit([{
                key: 'portal_plans',
                value: JSON.stringify(updatedPlans)
            }], {context: {internal: true}});
        }
    } catch (err) {
        logging.error('MercadoPago: failed to update portal_plans', err);
    }
}

async function configureApi() {
    const cfg = getConfig({settingsHelpers, config, urlUtils});
    if (cfg) {
        cfg.testEnv = process.env.NODE_ENV.startsWith('test');
        await module.exports.configure(cfg);
        await ensurePortalPlansIncludePaid();
        return true;
    }
    return false;
}

const debouncedConfigureApi = _.debounce(() => {
    configureApi().catch((err) => {
        logging.error(err);
    });
}, 600);

module.exports = new MercadoPagoService({
    labs,
    membersService,
    donationService
});

function mercadopagoSettingsChanged(model) {
    if (['mercadopago_access_token', 'mercadopago_public_key'].includes(model.get('key'))) {
        debouncedConfigureApi();
    }
}

module.exports.init = async function init() {
    try {
        await configureApi();
    } catch (err) {
        logging.error(err);
    }

    events
        .removeListener('settings.edited', mercadopagoSettingsChanged)
        .on('settings.edited', mercadopagoSettingsChanged);
};
