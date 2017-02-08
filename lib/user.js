/*
 * libquassel
 * https://github.com/magne4000/node-libquassel
 *
 * Copyright (c) 2016 Joël Charles
 * Licensed under the MIT license.
 */

/** @module user */

var Glouton = require('./glouton');

/**
 * @class
 * @alias module:user
 * @augments module:glouton.Glouton
 * @param {number} id
 * @param {?Object} data
 */
var IRCUser = function IRCUser(id, data) {
    /** @member {String} id - nick!u@x.y.z */
    this.id = id;
    /** @member {String} nick */
    this.nick = this.id.split('!')[0];
    if (data) {
        this.devour(data);
    }
    /** @member {boolean} away */
    /** @member {String} awayMessage */
    /** @member {String[]} channels */
    /** @member {boolean} encrypted */
    /** @member {String} host */
    /** @member {Date} idleTime */
    /** @member {String} ircOperator */
    /** @member {number} lastAwayMessage */
    /** @member {Date} loginTime */
    /** @member {String} realName */
    /** @member {String} server */
    /** @member {String} userHost */
    /** @member {String} user */
    /** @member {String} userModes */
    /** @member {String} whoisServiceReply */
};

Glouton.extend(IRCUser);

module.exports = IRCUser;