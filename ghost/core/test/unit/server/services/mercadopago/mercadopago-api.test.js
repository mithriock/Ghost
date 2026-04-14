const assert = require('node:assert/strict');
const sinon = require('sinon');
const MercadoPagoAPI = require('../../../../../core/server/services/mercadopago/mercadopago-api');

describe('MercadoPagoAPI', function () {
    let api;

    beforeEach(function () {
        api = new MercadoPagoAPI({labs: {isSet: sinon.stub().returns(true)}});
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('configure', function () {
        it('sets configured to true when valid config is provided', function () {
            assert.equal(api.configured, false);

            api.configure({
                accessToken: 'TEST-access-token',
                publicKey: 'TEST-public-key',
                checkoutSuccessUrl: 'http://localhost/success',
                checkoutFailureUrl: 'http://localhost/failure',
                checkoutPendingUrl: 'http://localhost/pending',
                webhookHandlerUrl: 'http://localhost/webhooks/mercadopago',
                testEnv: true
            });

            assert.equal(api.configured, true);
        });

        it('sets configured to false when null config is provided', function () {
            api.configure({
                accessToken: 'TEST-access-token',
                publicKey: 'TEST-public-key',
                checkoutSuccessUrl: 'http://localhost/success',
                checkoutFailureUrl: 'http://localhost/failure',
                checkoutPendingUrl: 'http://localhost/pending',
                webhookHandlerUrl: 'http://localhost/webhooks/mercadopago',
                testEnv: true
            });

            assert.equal(api.configured, true);

            api.configure(null);

            assert.equal(api.configured, false);
        });

        it('returns testEnv correctly', function () {
            api.configure({
                accessToken: 'TEST-access-token',
                publicKey: 'TEST-public-key',
                checkoutSuccessUrl: 'http://localhost/success',
                checkoutFailureUrl: 'http://localhost/failure',
                checkoutPendingUrl: 'http://localhost/pending',
                webhookHandlerUrl: 'http://localhost/webhooks/mercadopago',
                testEnv: true
            });

            assert.equal(api.testEnv, true);
        });
    });

    describe('getPublicKey', function () {
        it('returns the configured public key', function () {
            api.configure({
                accessToken: 'TEST-access-token',
                publicKey: 'TEST-my-public-key-123',
                checkoutSuccessUrl: 'http://localhost/success',
                checkoutFailureUrl: 'http://localhost/failure',
                checkoutPendingUrl: 'http://localhost/pending',
                webhookHandlerUrl: 'http://localhost/webhooks/mercadopago',
                testEnv: true
            });

            assert.equal(api.getPublicKey(), 'TEST-my-public-key-123');
        });
    });

    describe('validateWebhookSignature', function () {
        it('returns false when no signature is provided', function () {
            const result = api.validateWebhookSignature(null, 'request-id', 'data-id', 'secret');
            assert.equal(result, false);
        });

        it('returns false when no secret is provided', function () {
            const result = api.validateWebhookSignature('ts=123,v1=abc', 'request-id', 'data-id', null);
            assert.equal(result, false);
        });

        it('returns false for invalid signature', function () {
            const result = api.validateWebhookSignature(
                'ts=1234567890,v1=invalid_hash',
                'request-id-123',
                'payment-456',
                'my-webhook-secret'
            );
            assert.equal(result, false);
        });

        it('returns true for valid HMAC signature', function () {
            const crypto = require('node:crypto');
            const secret = 'my-webhook-secret';
            const dataId = 'payment-456';
            const requestId = 'request-id-123';
            const ts = '1234567890';

            const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(manifest);
            const expectedHash = hmac.digest('hex');

            const result = api.validateWebhookSignature(
                `ts=${ts},v1=${expectedHash}`,
                requestId,
                dataId,
                secret
            );
            assert.equal(result, true);
        });
    });
});
