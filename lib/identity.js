/*
 * libquassel
 * https://github.com/magne4000/node-libquassel
 *
 * Copyright (c) 2016 Joël Charles
 * Licensed under the MIT license.
 */

/** @module identity */

var Glouton = require('./glouton');

/**
 * @class
 * @alias module:identity
 * @augments module:glouton.Glouton
 * @param {Object} data
 */
var Identity = function Identity(data) {
    if (data) {
        this.devour(data);
    }
    /** @member {boolean} autoAwayEnabled */
    /** @member {String} autoAwayReason */
    /** @member {boolean} autoAwayReasonEnabled */
    /** @member {number} autoAwayTime */
    /** @member {String} awayNick */
    /** @member {String} kickReason */
    /** @member {boolean} awayNickEnabled */
    /** @member {String} awayReason */
    /** @member {boolean} awayReasonEnabled */
    /** @member {boolean} detachAwayEnabled */
    /** @member {String} detachAwayReason */
    /** @member {boolean} detachAwayReasonEnabled */
    /** @member {setIdent} setIdent */
    /** @member {number} identityId */
    /** @member {String} identityName */
    /** @member {String[]} nicks */
    /** @member {String} partReason */
    /** @member {String} quitReason */
    /** @member {String} realName */
};

Glouton.extend(Identity);

/**
 * @param {number} iBoolean
 */
Identity.prototype.setId = function(i) {
    this.identityId = i;
};

/**
 * Calls {@link devour} upon data
 * @param {*} data
 */
Identity.prototype.update = function(data) {
    this.devour(data);
};

module.exports = Identity;