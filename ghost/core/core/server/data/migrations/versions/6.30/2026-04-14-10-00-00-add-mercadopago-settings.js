const logging = require('@tryghost/logging');
const {createTransactionalMigration} = require('../../utils/migrations');
const ObjectId = require('bson-objectid');

const SETTINGS = ['mercadopago_access_token', 'mercadopago_public_key'];

module.exports = createTransactionalMigration(
    async function up(connection) {
        for (const key of SETTINGS) {
            const existing = await connection('settings')
                .where('key', '=', key)
                .first();

            if (existing) {
                if (existing.group !== 'members') {
                    logging.info(`Updating setting group for ${key}: ${existing.group} -> members`);
                    await connection('settings')
                        .where('key', '=', key)
                        .update({group: 'members'});
                } else {
                    logging.warn(`Setting ${key} already exists with correct group`);
                }
            } else {
                logging.info(`Adding setting: ${key}`);
                const now = connection.raw('CURRENT_TIMESTAMP');
                await connection('settings').insert({
                    id: ObjectId().toHexString(),
                    key,
                    value: null,
                    type: 'string',
                    group: 'members',
                    created_at: now,
                    updated_at: now
                });
            }
        }
    },
    async function down(connection) {
        for (const key of SETTINGS) {
            logging.info(`Removing setting: ${key}`);
            await connection('settings')
                .where('key', '=', key)
                .del();
        }
    }
);
