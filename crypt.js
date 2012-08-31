if (typeof require != 'undefined') {
	sjcl = require('./sjcl');
}

function Crypt(listener, id, port) {
	this.listener = listener;
	this.id = id;

	this.uri2socket = {};
	this.socketList = [];
	this.peers = {};
	this.queue = {};

	seedRNG();
	this.keys = sjcl.ecc.elGamal.generateKeys(384, 10);//genkey
	this.pubstr = JSON.stringify(this.keys.pub.serialize());//genpub
	//console.log('keys-->'+JSON.stringify(this.keys));
	console.log('pubstr-->'+this.pubstr);
	
	if (port) { // then listen
		var io = require('socket.io').listen(port);
		io.set("log level", 1);
		io.configure(function () { 
			io.set("transports", ["xhr-polling"]); 
			io.set("polling duration", 10); 
		});
			io.sockets.on('connection', function (socket) {
			//console.log('Server: Crypt-->connected')
			crypt.addSocket(socket);
		});
		this.io = io;
	}
}

Crypt.prototype.serverSendPub = function(from, to)
{
	this.sendPublicKey(to, this.peers[from].via);
}

Crypt.prototype.setId = function(id) {
	console.log('Server: setId to ' + id);
	this.id = id;
	for (peer in this.peers)
		this.sendPublicKey(peer, this.peers[peer].via);
}

Crypt.prototype.connect = function(uri) {
    //console.log('Crypt Server: connnect-->');
	if (this.uri2socket[uri])
		this.listener.connected(uri);
	else {
		socket = io.connect(uri);
		socket.on('connect', this.addSocket.bind(this, socket, uri));
	}
}

Crypt.prototype.addSocket = function(socket, uri) {
	//console.log('Crypt server: addSocket--> ' );
	if (uri)
		this.uri2socket[uri] = socket.id;
	socket.on('message', this.handle.bind(this, socket));
	socket.send(this.pubstr);
	console.log('adSocket: '+this.pubstr);
	console.log('adSocket: socket-->' + socket.id);
	socket['ali'] = 'Add: '+this.id;
	this.socketList.push(socket);
	console.log('adSocket: socket-->'+socket.id+' socketList:'+this.socketList.length);
}

function setAttributes(dst, src) {
	for (key in src)
		dst[key] = src[key];
}

Crypt.prototype.receivedPublicKey = function(socket, datastr, from) {
	
	var pubjson = JSON.parse(datastr);
	var point = sjcl.ecc.curves['c'+pubjson.curve].fromBits(pubjson.point)
	var pubkey = new sjcl.ecc.elGamal.publicKey(pubjson.curve, point.curve, point);
	var symkey =  this.keys.sec.dh(pubkey);
	
	console.log('Crypt server: receivedPublicKey' + ' pubjson--> ' + JSON.stringify(pubjson));
    //console.log('receivedPublicKey: socket-->' + socket.id);
	if (from) {
		this.peers[from] = {socketId:socket.id};
		setAttributes(this.peers[from],{pub:pubkey, sym:symkey, via:socket});
		var q = this.queue[from];
		console.log('Create peer ');
		for (var i in q)
			this.send(q[i], from);
		delete this.queue[from];
	} else {
		//console.log('socket secured ');
		socket.symkey = symkey;
		for (var to in this.queue)
			this.sendPublicKey(to, socket);
	}
}

Crypt.prototype.route = function(data) {
	var sid = this.peers[data.to].socketId;
	var outsocket = this.io.sockets.socket(sid);
	//console.log('Server: rout-->outsocket-->' + sid);
	if (!outsocket)
		console.log('Crypt Server: no socket for ' + data.to);
	else {
		//console.log('Crypt Server: route to ' + data.to);
		this.sendOnSocket(outsocket, data);
	}
}

Crypt.prototype.handle = function(socket, socketData) {
	console.log(new Date+'!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('Crypt handle Alert: You are stay in Crypt.prototype.handle --->ID: '+ JSON.stringify(this.id));
	if (!socket.symkey) {
		console.log('Crypt handle Alert: not symkey then receive PK-->this.receivedPublicKey(socket, socketData);');
		this.receivedPublicKey(socket, socketData);
		return;
	}
	
	var peerCipherData = sjcl.decrypt(socket.symkey, socketData);
	var data = JSON.parse(peerCipherData);
	var from = data.from;
	//console.log('Crypt Crypt.prototype.handle -->recv: data.to=' + data.to +', from=' + from);
    //console.log('Crypt Crypt.prototype.handle -->recv:' + socket.id);
	//console.log('Crpyt handle-->first receive data-->' + JSON.stringify(data));
	if (data.to != this.id)
	{
	   console.log('Send rout data---->>' + JSON.stringify(data));
		this.route(data);
	}
	else if (data.pk) { // pk for me
	   console.log('Crypt Server revc pk and send pk return-->this.receivedPublicKey(socket, data.pk, from);');
		this.receivedPublicKey(socket, data.pk, from);
		if (!data.isResponse)
		{
			console.log('this.sendPublicKey(from, socket, true);');
			this.sendPublicKey(from, socket, true);
		}
	} else if (this.peers[from]) {
		if (data.event == 'mail')
		{
	   		//console.log('Send mail data---->>'+data);
		}
		else
		{
			//console.log('Decrypted message-->socket receive:?????????' + JSON.stringify(socket.socketId) + ' sym:'+socket.sym + ' from' + from);
			var s = this.peers[from];
			//if	(s)
		//console.log('Decrypted message-->socket:?????????' + JSON.stringify(s.socketId) + ' sym:'+this.peers[from].sym + ' from' + from);
			var cleardata = sjcl.decrypt(this.peers[from].sym, data.data);
			//console.log('Crypt Server --> decrypted:data--> ' + cleardata);
			var parsed = JSON.parse(cleardata);
			//console.log('Parse:' + JSON.stringify(parsed));
			parsed.from = from;
			parsed.symfrompeers = this.peers[from].sym;
			//parsed.pkey = this.peers[from].pub;
			//console.log('Parse:' + JSON.stringify(parsed));
			this.listener.handle(parsed);
		}
	} else
		console.log("Crypt I don't have a pk for " + from);
	console.log('Crypt Alert: You are out of Crypt.prototype.handle ....');
}

Crypt.prototype.sendPublicKey = function(to, socket, isResponse) { // sent to peer
	//console.log('Crypt server: sendPublicKey to ' + to);
	var pk = JSON.stringify(this.keys.pub.serialize());
	var data = {event:'pubkey', from:this.id, isResponse:isResponse, pk:pk, to:to};
	this.sendOnSocket(socket, data);
}

Crypt.prototype.send = function(data, to) {
	//console.log('Crypt Server: send--> to ' + to +': ????????????????????????????????'+ JSON.stringify(data));

	var peer = this.peers[to];///???????????????????????
	if (peer && peer.pub) {
		//send to peat uath
		var cleardata = JSON.stringify(data);
		//console.log('Server:Peer shall send ' + cleardata);
		var cipherdata = sjcl.encrypt(peer.sym, cleardata);
		data = {to:to, from:this.id, data:cipherdata};
		//console.log('Server:Peer encrypt data ' + JSON.stringify(data));
		this.sendOnSocket(peer.via, data);
	} else if (!peer || !peer.pubd) {
		console.log('Crypt server: send--> first send pubkey to ' + to);
		///console.log('Server:not peer shall send ' + JSON.stringify(data));
		if (!this.queue[to])
			this.queue[to] = [];
		this.queue[to].push(data);
		
		for (var i=0; i<this.socketList.length; i++) { // todo: don't flood
			var socket = this.socketList[i];
			this.sendPublicKey(to, socket);
		}
	}
}

Crypt.prototype.sendMail = function(data, to) {
	console.log('Crypt Server: Event Mail send--> to ' + to +': ????????????????????????????????'+ JSON.stringify(data));

	var peer = this.peers[to];
	if (peer && peer.pub) {
		//send to peat uath
		var cleardata = JSON.stringify(data);
		//console.log('Server:Peer   shall send ' + cleardata);
		var cipherdata = sjcl.encrypt(peer.sym, cleardata);
		data = {event:'mail', to:to, from:this.id, data:cipherdata};
		//console.log('Server:Peer   encrypt data ' + JSON.stringify(data));
		this.sendOnSocket(peer.via, data);

	} else if (!peer || !peer.pubd) {

		console.log('Crypt server: send--> first send pubkey to ' + to);
		//console.log('Server:not peer shall send ' + JSON.stringify(data));
		if (!this.queue[to])
			this.queue[to] = [];
		this.queue[to].push(data);
		
		for (var i=0; i<this.socketList.length; i++) { // todo: don't flood
			var socket = this.socketList[i];
			this.sendPublicKey(to, socket);
		}
	}
}

Crypt.prototype.sendOnSocket = function(socket, data) {
	var datastr = JSON.stringify(data);
	if (!socket.symkey) {
		console.log('Crypt Server: no symkey for socket');
		return;
	}
	data.from = this.id;
	//console.log('Sever: encrypt and send ' + datastr);
	var cipherdata = sjcl.encrypt(socket.symkey, datastr);
	//socket.send(cipherdata);
	if (socket.send(cipherdata))
	{
	   console.log('Crypt Server: sendOnSocket--> Message sent');
	}
	else {
	   console.log('Crypt Server: sendOnSocket --> Message not sent');
	}
	
}

Crypt.prototype.salthash = function (password, salt) {
//	console.log('salthash ' + typeof(salt));
	salt = salt || sjcl.random.randomWords(8);
//	salt = salt ? sjcl.codec.hex.toBits(salt) : sjcl.random.randomWords(8);
//	console.log('Crypt Server: salthash--> ' + typeof(password) + ', ' + typeof(salt) + ' -- ' + password +' and '+ salt);
	var	count = 2048;
	var hpw = sjcl.misc.pbkdf2(password, salt, count);
	return {hashed:hpw, salt:salt};
}

function seedRNG() {
	sjcl.random.setDefaultParanoia(0);
	for (var i=0; i<1024; i++) {
		var r = Math.floor((Math.random()*100)+1);
	    sjcl.random.addEntropy(r, 1);
	}
}

if (typeof module != 'undefined') {
	module.exports = Crypt;
}
