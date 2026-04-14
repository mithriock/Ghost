# MercadoPago Service

This package contains Ghost's MercadoPago integration. It provides payment processing for members via MercadoPago's Checkout Pro and subscriptions (preapproval) API.

## Architecture

The service mirrors the structure of Ghost's Stripe integration:

- **MercadoPagoAPI** (`mercadopago-api.js`) — Wrapper around the MercadoPago SDK v2
- **MercadoPagoService** (`mercadopago-service.js`) — Orchestrates API, webhooks, and events
- **WebhookController** (`webhook-controller.js`) — Handles incoming IPN/webhook notifications
- **Config** (`config.js`) — Reads settings and builds configuration

## Webhook Events

MercadoPago sends notifications via IPN (Instant Payment Notification):

| Type | Description |
|------|-------------|
| `payment` | Payment created or updated |
| `subscription_preapproval` | Subscription created, updated, or cancelled |
| `plan` | Plan changes |

## Configuration

The service requires the following settings:
- `mercadopago_access_token` — Your MercadoPago Access Token
- `mercadopago_public_key` — Your MercadoPago Public Key

Optional environment variable:
- `MERCADOPAGO_WEBHOOK_SECRET` — Secret for validating webhook signatures

## Flow

```
Portal (frontend)
  → POST /members/api/create-mercadopago-checkout-session
    → MercadoPagoAPI.createPreference()
      → MercadoPago API (external)
        → Redirect to MercadoPago checkout

MercadoPago (webhook)
  → POST /members/webhooks/mercadopago
    → WebhookController.handle()
      → PaymentEventService / SubscriptionEventService
        → memberRepository (create/update members)
```

## Feature Flag

This integration is gated behind the `mercadoPago` private feature flag in Labs.

## Testing with MercadoPago Sandbox

### 1. Create MercadoPago Test Credentials

1. Go to [https://www.mercadopago.com/developers/panel/app](https://www.mercadopago.com/developers/panel/app)
2. Create an application or select an existing one
3. Go to **Credenciales de prueba** (Test Credentials)
4. Copy the **Public Key** (starts with `TEST-`) and **Access Token** (starts with `TEST-`)

### 2. Enable the Feature Flag

1. Start Ghost: `pnpm dev`
2. Go to `http://localhost:2368/ghost/#/settings`
3. Navigate to **Labs** → Enable **Developer experiments**
4. Enable **MercadoPago**

### 3. Configure Credentials

In the Ghost Admin, go to **Membership** → **Tiers** and click the **Connect MercadoPago** button.
Enter your test credentials:
- **Public Key**: `TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Access Token**: `TEST-xxxxxxxxxxxxxxxxxxxx`

Alternatively, set them directly in the database:
```sql
UPDATE settings SET value = 'TEST-your-access-token' WHERE `key` = 'mercadopago_access_token';
UPDATE settings SET value = 'TEST-your-public-key' WHERE `key` = 'mercadopago_public_key';
```

### 4. Test Checkout Flow

Use the Portal API to create a checkout session:

```bash
curl -X POST http://localhost:2368/members/api/create-mercadopago-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "tierId": "<your-tier-id>",
    "cadence": "month",
    "amount": 100,
    "currency": "ARS",
    "customerEmail": "test@example.com",
    "successUrl": "http://localhost:2368/?mercadopago=success",
    "cancelUrl": "http://localhost:2368/?mercadopago=cancel"
  }'
```

The response will contain a `url` field — this is the MercadoPago checkout URL.

### 5. Test Webhooks

For local webhook testing, use a tunnel like [ngrok](https://ngrok.com/):

```bash
ngrok http 2368
```

Then configure the webhook notification URL in your MercadoPago application settings
to point to: `https://<your-ngrok-url>/members/webhooks/mercadopago`

### 6. Test Card Numbers

MercadoPago provides test cards for sandbox testing:

| Card | Number | CVV | Expiration |
|------|--------|-----|------------|
| Mastercard (approved) | 5031 7557 3453 0604 | 123 | 11/25 |
| Visa (approved) | 4509 9535 6623 3704 | 123 | 11/25 |
| Amex (approved) | 3711 803032 57522 | 1234 | 11/25 |
| Mastercard (rejected) | 5031 7557 3453 0604 | 456 | 11/25 |

Use test email: `TESTUSER123456@testuser.com`

For the latest test data, see:
[https://www.mercadopago.com/developers/en/docs/checkout-pro/additional-content/your-integrations/test/cards](https://www.mercadopago.com/developers/en/docs/checkout-pro/additional-content/your-integrations/test/cards)
