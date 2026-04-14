module.exports = class MercadoPagoDisabledEvent {
    /**
     * @param {object} data
     * @param {string} data.message
     * @param {Date} [timestamp]
     */
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp || new Date();
    }

    static create(data) {
        return new MercadoPagoDisabledEvent(data);
    }
};
