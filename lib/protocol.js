/* jshint esversion:6, asi: true, curly:false */
const zlib = require('zlib')
const tls = require('tls')
const qtdatastream = require('qtdatastream')
const {EventEmitter} = require('events')
const assert = require('assert')
const logger = require('debug')('libquassel:protocol')
const RequestType = require('./requesttype')

const forward_events = (src, dst, events) => {
	if (typeof events === 'string') events = events.split(' ')
	events.forEach(evt => src.on(evt, dst.emit.bind(dst, evt)))
}

class Protocol extends EventEmitter {
	constructor(socket, useCompression, enableSSL) {
		super()
		this.socket = socket
		this.useCompression = useCompression
		this.enableSSL = enableSSL
	}
	write(msg) {
		this.qtsocket.write(msg)
	}
	setFlush(flush) {}
}
class LegacyProtocol extends Protocol {
	constructor(socket, useCompression, enableSSL) {
		super(socket, false, enableSSL)
		if (useCompression) {
			throw new Error("Compression on the legacy protocol is not supported")
		}
		logger("using legacy protocol")
		this.qtsocket = new qtdatastream.Socket(this.socket);
		this.qtsocket.on('data', (msg) => this.processMessage(msg))
		forward_events(this.qtsocket, this, 'close end error')
	}
	sendHeartbeat(d, reply) {
		const secs = d.getSeconds() + (60 * d.getMinutes()) + (60 * 60 * d.getHours());
		const slist = [
		    reply?RequestType.HeartBeat:RequestType.HeartBeatReply,
		    new qtdatastream.QTime(secs)
		];
		this.write(slist);
	}
	sendInitRequest(classname, objectname) {
	    const initRequest = [
	        new qtdatastream.QUInt(RequestType.InitRequest),
	        new qtdatastream.QString(classname),
	        new qtdatastream.QString(objectname)
	    ];
	    this.write(initRequest);
	}
	processMessage(msg) {
	    if (msg === null) {
	        this.log("Received null object ... ?");
	    } else if (typeof msg.MsgType !== 'undefined') {
	    	if (msg.MsgType === "ClientInitAck") {
	    		this.startSSL(msg.SupportsSSL);
	    	}
	    	this.emit('msgtype', msg);
	    } else if(Buffer.isBuffer(msg[1])) {
	    	const type = msg[0]
	    	switch(type) {
	    		case RequestType.InitData: {
	    			let [, className, objectName, params] = msg
	    			className = className.toString();
	    			objectName = objectName !== null ? objectName.toString() : null
	    		    this.emit('initdata', className, objectName, params);
	    		    } break;
	    		default: this.emit('struct', msg)
	    	}
	    }
	}
	startSSL() {
		if (!this.enableSSL) return
	    const sock = tls.connect(null, {
	        socket: this.qtsocket.removeSocket(),
	        rejectUnauthorized: false,
	        secureProtocol: 'TLSv1_client_method'
	    });
	    this.qtsocket.setSocket(sock)
	    this.socket = sock;
	}
}
LegacyProtocol.id = 0x01
LegacyProtocol.features = 0
function object_to_list(obj) {
	const keys = Object.keys(obj)
	const no_keys = keys.length
	let out = Array(no_keys * 2)
	for(let i = 0; i < no_keys; i ++) {
	    out[i*2] = new qtdatastream.QByteArray(keys[i])
	    out[(i*2)+1] = obj[keys[i]]
	}
	return out
}

function list_to_obj(lst) {
    if (typeof lst[0] === 'number') return lst
    else {
        const out = Object.create(null)
        for(let i = 0; i < lst.length; i++) {
            out[lst[i++].toString('utf8')] = lst[i]
        }
        return out
    }
}
class DatastreamProtocol extends Protocol {
	constructor(socket, useCompression, enableSSL, protoFeatures) {
		super(socket, useCompression, protoFeatures)
		if (enableSSL) {
			this.startSSL();
		}
		if (this.useCompression) {
		    this.inflate = zlib.createInflate()
		    this.deflate = zlib.createDeflate({flush: zlib.Z_SYNC_FLUSH})
		    this.qtsocket = new qtdatastream.Socket(null, qtdatastream.Types.LIST);
		    this.qtsocket.write_stream.pipe(this.deflate).pipe(this.socket)
		    this.socket.pipe(this.inflate).pipe(this.qtsocket.read_stream)
		} else {
		    this.qtsocket = new qtdatastream.Socket(this.socket, qtdatastream.Types.LIST);
		}
		this.qtsocket.on('data', (msg) => this.processMessage(msg))
		logger("using datastream protocol")
	}
	startSSL() {
	    let sock = tls.connect(null, {
	        socket: this.socket,
	        rejectUnauthorized: false,
	        secureProtocol: 'TLSv1_client_method'
	    });
	    this.socket = sock;
	}
	setFlush(flush) {
		if (this.useCompression) {
			this.deflate._opts.flush = this.deflate._flushFlag = flush ? zlib.Z_SYNC_FLUSH : zlib.Z_NO_FLUSH
			if (flush) this.deflate.flush()
		}
	}
	write(msg) {
		if (typeof msg === 'object' && !Array.isArray(msg)) {
		    msg = object_to_list(msg)
		} else if (Array.isArray(msg) ) {
		    if (!(typeof msg[0] === 'number' || msg[0] instanceof qtdatastream.QInt || msg[0] instanceof qtdatastream.QUInt))
		        console.trace("list has to start with a number in the new protocol", msg)
		} else {
			console.log("tried to write unknown value to datastream", msg)
		}
		super.write(msg)
	}
	processMessage(msg) {
		// assert that it is a list
		msg = list_to_obj(msg)
	    if (msg === null) {
	        this.log("Received null object ... ?");
	    } else if (typeof msg.MsgType !== 'undefined') {
	    	this.emit('msgtype', msg)
	    } else if(Buffer.isBuffer(msg[1])) {
	    	const type = msg[0]
	    	switch(type) {
	    		case RequestType.InitData: {
	    			let [, className, objectName, ...params] = msg
	    			className = className.toString();
	    			objectName = objectName !== null ? objectName.toString() : null
	    			params = list_to_obj(params)
	    		    this.emit('initdata', className, objectName, params);
	    		    } break;
	    		default: this.emit('struct', msg)
	    	}
	    }
	}
	sendHeartbeat(d, reply) {
		const slist = [
		    reply?RequestType.HeartBeat:RequestType.HeartBeatReply,
		    new qtdatastream.QDateTime(d)
		];
		this.write(slist);
	}

	sendInitRequest(classname, objectname) {
	    const initRequest = [
	        new qtdatastream.QUInt(RequestType.InitRequest),
	        new qtdatastream.QString(classname),
	        new qtdatastream.QByteArray(objectname)
	    ];
	    this.write(initRequest);
	}
}
DatastreamProtocol.id = 0x02
DatastreamProtocol.features = 0
const protocols = [DatastreamProtocol, LegacyProtocol]
const getById = id => protocols.filter(p => p.id === id)[0]
DatastreamProtocol.prototype.list_to_obj = list_to_obj
Object.assign(exports, {
	protocols, getById
})
