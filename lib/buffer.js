/*
 * libquassel
 * https://github.com/magne4000/node-libquassel
 *
 * Copyright (c) 2016 Joël Charles
 * Licensed under the MIT license.
 */

/** @module buffer */

var Glouton = require('./glouton'),
    logger = require('debug', 'libquassel:buffer'),
    IRCMessage = require('./message').IRCMessage,
    util = require('qtdatastream').util;

/**
 * BufferInfo object representation
 * @typedef {Object} BufferInfo
 * @property {number} id
 * @property {number} network
 * @property {number} type
 * @property {number} group
 * @property {String} name
 */

/**
 * @class
 * @alias module:buffer.IRCBuffer
 * @augments module:glouton.Glouton
 */
var IRCBuffer = function IRCBuffer(id, data) {
    this.devour(data);
    /** @member {number} */
    this.id = id;
    /**
     * Map of users of this channel.
     * The Map keys are users nicknames `String`, the values is an Object with 2 attributes:
     *  * value.user {@link module:user}
     *  * value.modes `String`
     * @member {Map}
     */
    this.users = new Map;
    /**
     * Map of messages in this buffer.
     * The Map keys are message IDs {@type number}, the values {@type message/IRCMessage}
     * @member {Map}
     */
    this.messages = new Map;
    /** @member {boolean} */
    this.active = false;
    /**
     * @member {boolean}
     * @protected
     */
    this._isStatusBuffer = false;
    /**
     * @member {boolean}
     * @protected
     */
    this._lastMessageId = null;
    /**
     * @member {boolean}
     * @protected
     */
    this._firstMessageId = null;
    if (this.type == IRCBuffer.Types.StatusBuffer) {
        this._isStatusBuffer = true;
    }
};

Glouton.extend(IRCBuffer);

function _userAndModes(user, modes) {
    return {
        user: user,
        modes: modes
    };
}

/**
 * Switch buffer state
 * @param {boolean} bool
 */
IRCBuffer.prototype.setActive = function(bool) {
    this.active = bool;
};

/**
 * Is this buffer a channel
 * @returns {boolean}
 */
IRCBuffer.prototype.isChannel = function() {
    return this.name && "#&+!".indexOf(this.name[0]) !== -1;
};

/**
 * Add user to buffer
 * @param {module:user} user
 * @param {string} modes
 */
IRCBuffer.prototype.addUser = function(user, modes) {
    if (user && typeof user.nick === "string") {
        this.users.set(user.nick, _userAndModes(user, modes));
    }
};

/**
 * Add mode to user
 * @param {module:user} user
 * @param {string} mode
 */
IRCBuffer.prototype.addUserMode = function(user, mode) {
    if (user && typeof user.nick === "string") {
        var userAndModes = this.users.get(user.nick);
        if (userAndModes) userAndModes.modes += mode;
    }
};

/**
 * Returns true if user has specified mode
 * @param {string} nick
 * @param {string} mode
 * @returns {boolean}
 */
IRCBuffer.prototype.hasMode = function(nick, mode) {
    var userAndModes = this.users.get(nick);
    if (userAndModes && typeof userAndModes.modes === "string") {
        return userAndModes.modes.indexOf(mode) !== -1;
    }
    return false;
};

/**
 * Returns true if user is chan operator
 * @param {string} nick
 * @returns {boolean}
 */
IRCBuffer.prototype.isOp = function(nick) {
    return this.hasMode(nick, 'o');
};

/**
 * Returns true if user is chan half-operator
 * @param {string} nick
 * @returns {boolean}
 */
IRCBuffer.prototype.isHalfOp = function(nick) {
    return this.hasMode(nick, 'h');
};

/**
 * Returns true if user is owner
 * @param {string} nick
 * @returns {boolean}
 */
IRCBuffer.prototype.isOwner = function(nick) {
    return this.hasMode(nick, 'q');
};

/**
 * Returns true if user is admin
 * @param {string} nick
 * @returns {boolean}
 */
IRCBuffer.prototype.isAdmin = function(nick) {
    return this.hasMode(nick, 'a');
};

/**
 * Returns true if user is voiced
 * @param {string} nick
 * @returns {boolean}
 */
IRCBuffer.prototype.isVoiced = function(nick) {
    return this.hasMode(nick, 'v');
};

/**
 * remove mode from user
 * @param {module:user} user
 * @param {string} mode
 */
IRCBuffer.prototype.removeUserMode = function(user, mode) {
    if (user && typeof user.nick === "string") {
        var userAndModes = this.users.get(user.nick);
        if (userAndModes) userAndModes.modes = userAndModes.modes.replace(mode, "");
    }
};

/**
 * Check if current buffer contains specified user
 * @param {(string|module:user)} nick
 * @returns {?boolean}
 */
IRCBuffer.prototype.hasUser = function(nick) {
    if (typeof nick === 'undefined' || nick === null) {
        logger("User should not be null or undefined");
        return null;
    }
    if (typeof nick.nick === 'string') {
        nick = nick.nick;
    }
    return this.users.has(nick);
};

/**
 * Remove user from buffer
 * @param {(string|module:user)} nick
 */
IRCBuffer.prototype.removeUser = function(nick) {
    if (typeof nick.nick === 'string') {
        nick = nick.nick;
    }
    this.users.delete(nick);
};

/**
 * Update user maps hashes with current .nick
 * @param {string} oldnick
 */
IRCBuffer.prototype.updateUserMaps = function(oldnick) {
    var userAndModes = this.users.get(oldnick);
    if (oldnick !== userAndModes.user.nick) {
        this.users.set(userAndModes.user.nick, userAndModes);
        this.users.delete(oldnick);
    }
};

/**
 * Add message to buffer
 * @param {*} message
 * @returns {?message/IRCMessage} the message, if successfully added, null otherwise
 */
IRCBuffer.prototype.addMessage = function(message) {
    message.id = parseInt(message.id, 10);
    if (this._lastMessageId === null || this._lastMessageId < message.id) {
        this._lastMessageId = message.id;
    }
    if (this._firstMessageId === null || this._firstMessageId > message.id) {
        this._firstMessageId = message.id;
    }
    if (this.messages.has(message.id)) {
        return null;
    }
    var ircmsg = new IRCMessage(message);
    this.messages.set(message.id, ircmsg);
    return ircmsg;
};

/**
 * Update internal _lastMessageId and _firstMessageId
 * @protected
 */
IRCBuffer.prototype._updateFirstAndLast = function() {
    var self = this;
    this._lastMessageId = null;
    this._firstMessageId = null;
    this.messages.forEach(function(val, key) {
        if (self._lastMessageId === null || self._lastMessageId < key) self._lastMessageId = key;
        if (self._firstMessageId === null || self._firstMessageId > key) self._firstMessageId = key;
    });
};

/**
 * Clear buffer messages
 */
IRCBuffer.prototype.clearMessages = function() {
    this._lastMessageId = null;
    this._firstMessageId = null;
    this.messages.clear();
};

/**
 * Delete a message from the buffer
 * @param {number} messageId
 */
IRCBuffer.prototype.deleteMessage = function(messageId) {
    if (this.messages.size <= 1) {
        this.clearMessages();
    } else {
        this.messages.delete(messageId);
        this._updateFirstAndLast();
    }
};

/**
 * Trim messages and leave only `n` messages
 * @param {number} n
 */
IRCBuffer.prototype.trimMessages = function(n) {
    if (n <= 0) {
        this.clearMessages();
    } else if (n < this.messages.size) {
        var idsToKeep = [], newMap = new Map, self = this;
        this.messages.forEach(function(val, key) {
            idsToKeep.push(key);
        });
        idsToKeep.sort();
        idsToKeep.splice(0, idsToKeep.length - n);
        idsToKeep.forEach(function(val) {
            newMap.set(val, self.messages.get(val));
        });
        this.messages = newMap;
        this._updateFirstAndLast();
    }
};

/**
 * Check if specified messageId is the last one of this buffer
 * @param {*} messageId
 * @returns {boolean}
 */
IRCBuffer.prototype.isLast = function(messageId) {
    messageId = parseInt(messageId, 10);
    return this._lastMessageId === messageId;
};

/**
 * get the first message (sorted by id)
 * @param {*} messageId
 * @returns {message/IRCMessage}
 */
IRCBuffer.prototype.getFirstMessage = function() {
    return this.messages.get(this._firstMessageId);
};

/**
 * get the last message (sorted by id)
 * @param {*} messageId
 * @returns {message/IRCMessage}
 */
IRCBuffer.prototype.getLastMessage = function() {
    return this.messages.get(this._lastMessageId);
};

/**
 * Name setter
 * @param {string} name
 */
IRCBuffer.prototype.setName = function(name) {
    this.name = name ? name.toString() : null;
};

/**
 * get BufferInfo structure
 * @returns {BufferInfo}
 */
IRCBuffer.prototype.getBufferInfo = function() {
    return {
        id: this.id,
        network: this.network,
        type: this.type,
        group: this.group || 0,
        name: this.name
    };
};

/**
 * Returns true if this buffer is a StatusBuffer
 * If param is specified, acts as a setter.
 * @param {boolean} bool
 * @returns {boolean}
 */
IRCBuffer.prototype.isStatusBuffer = function(bool) {
    if (typeof bool === "undefined")
        return this._isStatusBuffer;
    else
        this._isStatusBuffer = bool;
};

/**
 * A collection of buffers
 * @class
 * @alias module:buffer.IRCBufferCollection
 */
var IRCBufferCollection = function IRCBufferCollection() {
    /** @member {Map} */
    this.buffers = new Map;
};

/**
 * Add a buffer to this collection
 * @param {IRCBuffer} buffer
 */
IRCBufferCollection.prototype.addBuffer = function(buffer) {
    if (this.buffers.has(buffer.id)) {
        logger("Buffer already added (" + buffer.name + ")");
        return;
    }
    this.buffers.set(buffer.id, buffer);
};

/**
 * Get the buffer by name if bufferId is a `String`, by id otherwise
 * @param {(number|string|Buffer)} bufferId
 * @returns {?Buffer}
 */
IRCBufferCollection.prototype.getBuffer = function(bufferId) {
    var buffer;
    if (bufferId instanceof Buffer) {
        bufferId = util.str(bufferId);
    }
    if (typeof bufferId === 'string') {
        bufferId = bufferId.toLowerCase();
        var buffers = this.buffers.values();
        buffer = buffers.next();
        while(!buffer.done) {
            if (typeof buffer.value.name === 'string' && buffer.value.name.toLowerCase() === bufferId) {
                return buffer.value;
            }
            buffer = buffers.next();
        }
    } else {
        // number
        buffer = this.buffers.get(bufferId);
        if (typeof buffer !== 'undefined') {
            return buffer;
        }
    }
    return null;
};

/**
 * Does the buffer exists in this collection
 * @param {(number|string|Buffer)} bufferId
 * @returns {boolean}
 */
IRCBufferCollection.prototype.hasBuffer = function(bufferId) {
    if (typeof bufferId === 'string' || bufferId instanceof Buffer) {
        return this.getBuffer(bufferId) !== null;
    } else {
        return this.buffers.has(bufferId);
    }
};

/**
 * Remove buffer
 * @param {(number|string)} bufferId
 */
IRCBufferCollection.prototype.removeBuffer = function(bufferId) {
    var buffer = this.getBuffer(bufferId);
    if (buffer) {
        this.buffers.delete(buffer.id);
    }
};


/**
 * Change buffer id
 * @param {Buffer} buffer
 * @param {(number|string)} bufferIdTo
 */
IRCBufferCollection.prototype.moveBuffer = function(buffer, bufferIdTo) {
    var bufferIdFrom = buffer.id;
    this.buffers.set(bufferIdTo, buffer);
    buffer.id = bufferIdTo;
    this.buffers.delete(bufferIdFrom);
};

/**
 * @alias module:buffer.IRCBuffer.Types
 * @readonly
 * @enum {number}
 * @default
 */
IRCBuffer.Types = {
    InvalidBuffer: 0x00,
    StatusBuffer: 0x01,
    ChannelBuffer: 0x02,
    QueryBuffer: 0x04,
    GroupBuffer: 0x08
};

exports.IRCBuffer = IRCBuffer;
exports.IRCBufferCollection = IRCBufferCollection;
