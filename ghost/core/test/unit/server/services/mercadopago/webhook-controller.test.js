const assert = require('node:assert/strict');
const sinon = require('sinon');
const MercadoPagoWebhookController = require('../../../../../core/server/services/mercadopago/webhook-controller');

describe('MercadoPagoWebhookController', function () {
    let controller;
    let mockApi;
    let mockPaymentEventService;
    let mockSubscriptionEventService;

    beforeEach(function () {
        mockApi = {
            validateWebhookSignature: sinon.stub().returns(true)
        };
        mockPaymentEventService = {
            handlePaymentEvent: sinon.stub().resolves()
        };
        mockSubscriptionEventService = {
            handleSubscriptionEvent: sinon.stub().resolves()
        };

        controller = new MercadoPagoWebhookController({
            api: mockApi,
            paymentEventService: mockPaymentEventService,
            subscriptionEventService: mockSubscriptionEventService
        });

        controller.configure({webhookSecret: 'test-secret'});
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('handle', function () {
        it('returns 400 when body is missing', async function () {
            const req = {body: null, headers: {}};
            const res = {writeHead: sinon.stub(), end: sinon.stub()};

            await controller.handle(req, res);

            assert.equal(res.writeHead.calledWith(400), true);
            assert.equal(res.end.calledOnce, true);
        });

        it('returns 200 for valid payment notification', async function () {
            const req = {
                body: {
                    type: 'payment',
                    action: 'payment.created',
                    data: {id: '12345'}
                },
                headers: {
                    'x-signature': 'ts=123,v1=abc',
                    'x-request-id': 'req-id'
                }
            };
            const res = {writeHead: sinon.stub(), end: sinon.stub()};

            await controller.handle(req, res);

            assert.equal(res.writeHead.calledWith(200), true);
            assert.equal(mockPaymentEventService.handlePaymentEvent.calledWith('12345'), true);
        });

        it('returns 200 for subscription_preapproval notification', async function () {
            const req = {
                body: {
                    type: 'subscription_preapproval',
                    action: 'updated',
                    data: {id: 'sub-789'}
                },
                headers: {
                    'x-signature': 'ts=123,v1=abc',
                    'x-request-id': 'req-id'
                }
            };
            const res = {writeHead: sinon.stub(), end: sinon.stub()};

            await controller.handle(req, res);

            assert.equal(res.writeHead.calledWith(200), true);
            assert.equal(mockSubscriptionEventService.handleSubscriptionEvent.calledWith('sub-789'), true);
        });

        it('returns 401 for invalid webhook signature', async function () {
            mockApi.validateWebhookSignature.returns(false);

            const req = {
                body: {
                    type: 'payment',
                    action: 'payment.created',
                    data: {id: '12345'}
                },
                headers: {
                    'x-signature': 'invalid',
                    'x-request-id': 'req-id'
                }
            };
            const res = {writeHead: sinon.stub(), end: sinon.stub()};

            await controller.handle(req, res);

            assert.equal(res.writeHead.calledWith(401), true);
        });

        it('returns 500 when handler throws', async function () {
            mockPaymentEventService.handlePaymentEvent.rejects(new Error('test error'));

            const req = {
                body: {
                    type: 'payment',
                    action: 'payment.created',
                    data: {id: '12345'}
                },
                headers: {
                    'x-signature': 'ts=123,v1=abc',
                    'x-request-id': 'req-id'
                }
            };
            const res = {writeHead: sinon.stub(), end: sinon.stub()};

            await controller.handle(req, res);

            assert.equal(res.writeHead.calledWith(500), true);
        });
    });

    describe('handleEvent', function () {
        it('routes payment events to paymentEventService', async function () {
            await controller.handleEvent('payment', 'payment.created', '12345');

            assert.equal(mockPaymentEventService.handlePaymentEvent.calledWith('12345'), true);
            assert.equal(mockSubscriptionEventService.handleSubscriptionEvent.called, false);
        });

        it('routes subscription events to subscriptionEventService', async function () {
            await controller.handleEvent('subscription_preapproval', 'updated', 'sub-123');

            assert.equal(mockSubscriptionEventService.handleSubscriptionEvent.calledWith('sub-123'), true);
            assert.equal(mockPaymentEventService.handlePaymentEvent.called, false);
        });

        it('does not throw for unknown event types', async function () {
            await controller.handleEvent('unknown_type', 'some.action', '999');

            assert.equal(mockPaymentEventService.handlePaymentEvent.called, false);
            assert.equal(mockSubscriptionEventService.handleSubscriptionEvent.called, false);
        });

        it('does not throw when data.id is missing', async function () {
            await controller.handleEvent('payment', 'payment.created', undefined);

            assert.equal(mockPaymentEventService.handlePaymentEvent.called, false);
        });
    });
});
