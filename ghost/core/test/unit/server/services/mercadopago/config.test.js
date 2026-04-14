const assert = require('node:assert/strict');
const sinon = require('sinon');
const configUtils = require('../../../../utils/config-utils');

describe('MercadoPago Config', function () {
    let labs;
    let config;

    beforeEach(function () {
        labs = require('../../../../../core/shared/labs');
    });

    afterEach(async function () {
        sinon.restore();
        await configUtils.restore();
    });

    it('returns null when mercadoPago labs flag is disabled', function () {
        sinon.stub(labs, 'isSet').withArgs('mercadoPago').returns(false);

        config = require('../../../../../core/server/services/mercadopago/config');

        const result = config.getConfig({
            config: {get: sinon.stub().returns('development')},
            urlUtils: {getSiteUrl: sinon.stub().returns('http://localhost:2368/')},
            settingsHelpers: {
                getMercadoPagoKeys: sinon.stub().returns({
                    accessToken: 'TEST-token',
                    publicKey: 'TEST-key'
                })
            }
        });

        assert.equal(result, null);
    });

    it('returns null when MercadoPago keys are not set', function () {
        sinon.stub(labs, 'isSet').withArgs('mercadoPago').returns(true);

        config = require('../../../../../core/server/services/mercadopago/config');

        const result = config.getConfig({
            config: {get: sinon.stub().returns('development')},
            urlUtils: {getSiteUrl: sinon.stub().returns('http://localhost:2368/')},
            settingsHelpers: {
                getMercadoPagoKeys: sinon.stub().returns(null)
            }
        });

        assert.equal(result, null);
    });

    it('returns config with correct URLs when enabled and keys exist', function () {
        sinon.stub(labs, 'isSet').withArgs('mercadoPago').returns(true);

        config = require('../../../../../core/server/services/mercadopago/config');

        const result = config.getConfig({
            config: {get: sinon.stub().returns('development')},
            urlUtils: {getSiteUrl: sinon.stub().returns('http://localhost:2368/')},
            settingsHelpers: {
                getMercadoPagoKeys: sinon.stub().returns({
                    accessToken: 'TEST-access-token-123',
                    publicKey: 'TEST-public-key-456'
                })
            }
        });

        assert.ok(result);
        assert.equal(result.accessToken, 'TEST-access-token-123');
        assert.equal(result.publicKey, 'TEST-public-key-456');
        assert.ok(result.checkoutSuccessUrl.includes('mercadopago=success'));
        assert.ok(result.checkoutFailureUrl.includes('mercadopago=failure'));
        assert.ok(result.checkoutPendingUrl.includes('mercadopago=pending'));
        assert.ok(result.webhookHandlerUrl.includes('members/webhooks/mercadopago'));
    });
});
