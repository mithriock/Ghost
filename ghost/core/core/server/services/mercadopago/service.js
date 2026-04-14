const _ = require('lodash');
const MercadoPagoService = require('./mercadopago-service');
const logging = require('@tryghost/logging');
const membersService = require('../members');
const config = require('../../../shared/config');
const urlUtils = require('../../../shared/url-utils');
const events = require('../../lib/common/events');
const {getConfig} = require('./config');
const settingsHelpers = require('../settings-helpers');
const donationService = require('../donations');
const labs = require('../../../shared/labs');

async function configureApi() {
    const cfg = getConfig({settingsHelpers, config, urlUtils});
    if (cfg) {
        cfg.testEnv = process.env.NODE_ENV.startsWith('test');
        await module.exports.configure(cfg);
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
