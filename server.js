//var port = parseInt(process.env.PORT) || 8089;
var port = 8089;
console.log('process.env.PORT: '+process.env.PORT);

function authenticate1(whom, success, reason) {
		
	var data = {event:'auth', success:success, reason:reason};
	
	this.crypt.send(data, whom);
}

function authenticate(whom, success, reason, orgindata) {
	/*
uid		: String,
	hashed	: String,
	salt	: String,
	name	: String,
	pubkey  : String,
	email			: String, //here
	
	website			: String,
	fisrtName		: String,
	lastName		: String,
	avatar			: String,
	creationDate	: Date,
	modificationDate: { type: Date, dedault: Date.now },
	contacts		: [ContactListModel],
	posted			: [PostingModel],
	group : [OfGroupModel]
*/
	/*
 dataFromDB = {name:docs[0].name, email:docs[0].email, website:docs[0].website, 
	 fisrtName:docs[0].fisrtName, lastName:docs[0].lastName, avatar:docs[0].avatar};
*/
	 
	var data = {event:'auth', success:success, reason:reason};
	
	if (orgindata)
	{
		if (orgindata.email)
			data.email = orgindata.email;		
		if (orgindata.website)
			data.website = orgindata.website;
		if (orgindata.fisrtName)
			data.fisrtName = orgindata.fisrtName;
		if (orgindata.lastName)
			data.lastName = orgindata.lastName;
		if (orgindata.avatar)
			data.avatar = orgindata.avatar;
	}

	this.crypt.send(data, whom);
}

function missive(from, outdata, reason) {
	//this.sendPublicKey(peer, this.peers[peer].via);
	console.log('Server: missive: outdata-->' + JSON.stringify(outdata));
	//this.crypt.serverSendPub(outdata.destination, from);
	PostingModel.findOne({ body: JSON.stringify(outdata.text) }, function(err, found) {
    	if (!found) {
	   		console.log('not found! ' + outdata.text);
	   	} 
		else {
    		console.log('Found !!!!!! ');
			//var data = {event:'text', from:outdata.from, to:outdata.destination, data:outdata.data};
			//var data = {from: 'server', event:'mail', to:outdata.destination, data:outdata.text, pubfrom : outdata.pubfrom, symkey:outdata.symdata, id:found._id};
		//	datasend = {from: 'server', event:'mail', to:data.username, original:docs[i].sendername, data:data_text, datesend:datesend, id:id_message, status:status , isdelete:isdelete, isfavorite:isfavorite, istrash:istrash, isarchive:isarchive, symkey:symkey};
				var datasend = {from: 'server', event:'mail', to:outdata.destination, 
				original:found.sendername, data:found.body,
				datesend:found.sendDate, id:found._id, status:found.status,
				isdelete:found.isdelete, isfavorite:found.isfavorite,
				istrash:found.istrash, isarchive:found.isarchive, symkey:outdata.symdata};
			
//			var datasend = {event:'text', text:outdata.text, datesend:found.sendDate, id:found._id, status:found.status ,isdelete:found.isdelete, isfavorite:found.isfavorite, istrash:found.istrash, isarchive:found.isarchive};
			
			console.log('Server: missivet-->'+JSON.stringify(datasend));
		
			sendMailToClient(datasend, outdata.destination);

		}
	});	
}

function sendMailToClient(outdata, to){
	this.crypt.sendMail(outdata, to);
}

function accept1(whom, reason) {
	
	authenticate(whom, true, reason);
}

function accept(whom, reason, data) {
	
	if (data)
		//console.log('Server: accept:-->'+ JSON.stringify(data));
		authenticate(whom, true, reason, data);
	else
	authenticate(whom, true, reason);
}

function serverSend(data, whom){
	this.crypt.send(data, whom);	
}

function reject(whom, reason) {
	//console.log('Server: reject');
	authenticate(whom, false, reason);
}

// handlers

function salted(data) {
	var who = data.from;
	console.log('Server: salt user= ' + who);
	var s = this;

	PersonModel.find({name:who}, function (err, docs) {
		if (err)
			reject(who, err);
		else if (!docs.length)
			reject(who, 'salt: user ' + who + ' does not exist');
		else if (!docs[0].salt)
			reject(who, 'salt: user ' + who + ' is missing salt');
		else try{
			s.crypt.send({event:'salt', salt:JSON.parse(docs[0].salt)}, who);
		} catch(err) {
			reject(who, 'salt: ' + err.message);
		}
	});
}

function signuped(data) {
	var who = data.from;
	//console.log('Server: signup user= ' + who + ' hashed = ' + typeof(data.hashed));
	PersonModel.find({name:who}, function (err, docs) {
		if (err)
			reject(who, err);
		else if (docs.length)
			reject(who, 'signup: user ' + who + ' exists');
		else if (!data.hashed || !data.salt)
			reject(who, 'signup: missing data');
		else {
			var person = new PersonModel();
			person.name = who;
			console.log('Server: store hash into db: ' + typeof(data.hashed));
			person.hashed = JSON.stringify(data.hashed);
			person.salt = JSON.stringify(data.salt);
			person.save(function (err) {
				if (!err)// console.log('saved 1');
					accept(who, 'signup: user ' + who + ' created');
				else
					reject(who, err);
			});
		}
	});
};

Array.prototype.compare = function(testArr) {
    if (this.length != testArr.length) return false;
    for (var i = 0; i < testArr.length; i++) {
        if (this[i].compare) { 
            if (!this[i].compare(testArr[i])) return false;
        }
        if (this[i] !== testArr[i]) return false;
    }
    return true;
}

function signined(data) {
	var who = data.from;
	//console.log('Server: signin user=' + who + ' hashed=' + typeof(data.hashed));
	//console.log('Server: signin user=' + who + ' data=' +JSON.stringify(data));
	PersonModel.find({name:who}, function (err, docs) {
		if (err)
			reject(err);
		else if (!docs.length)
			reject(who, 'Server: signin: user ' + who + ' does not exist');
		else if (!docs[0].hashed)
			reject(who, 'Server: signin: user ' + who + ' is missing hashed');
		else {
			try {
				var hashedFromDB = JSON.parse(docs[0].hashed);
				//console.log('Server: hash from db: ' + hashedFromDB);
				var hashed = crypt.salthash(hashedFromDB, data.salt).hashed;
				//console.log('Server: hash from salthash: ' + hashed);
				var dataFromDB =  {name:docs[0].name, email:docs[0].email, website:docs[0].website, 
	 fisrtName:docs[0].fisrtName, lastName:docs[0].lastName, avatar:docs[0].avatar};
				//console.log('welcome back: ---->'+JSON.stringify(dataFromDB));
				
				if (!hashed.compare(data.hashed))
					reject(who, 'Server: signin: user ' + who + ' password mismatch: ' + data.hashed + ' != ' + hashed);
				else				
					accept(who, 'welcome back', dataFromDB);
			} catch (err) {
				reject(who, 'Server: signin: user ' + who + ' error:' + err.message);
			}
		}
	});
}

function getPubkeyFrom(username){
	PersonModel.findOne({ groupName: grname }, function(err, found) {
    	if (!found) {
	   		console.log('Public key does not exist! ');
	   	} 
		else {
    		return {pubkey:found.pubkey, username:username};
		}
	});
}


function removeContact(id)
{
	ContactListModel.findOne({ _id: id }, function(err, found) {
    	if (!found) {
	   		console.log('Contact not exist! ');
	   	} 
		else {
    		ContactListModel.remove({ _id: found._id }, function(err, doc) {
				if 	(!err)
					console.log('Remove Contact success');
				else
					console.log('Remove Contact not success');
			});
		}
	});
}

function removeUserBy(id)
{
	PersonModel.findOne({ _id: id }, function(err, found) {
    	if (!found) {
	   		console.log('Contact not exist! ');
	   	} 
		else {
    		PersonModel.remove({ _id: found._id }, function(err, doc) {
				if 	(!err)
					console.log('Remove Contact success');
				else
					console.log('Remove Contact not success');
			});
		}
	});
}

function findIdFromUser(username){
	console.log('findIdFromUser: '+username);
	PersonModel.findOne({ name: username }, function(err, found) {
    	if (!found) {
	   		console.log('Username does not exist! ');
	   	} 
		else {
			console.log('findIdFromUser:  found! ' + username + '-->' + found._id);
    		return {id:found._id, username:username};
		}
	});
}


function updateUserProfile(username, pubkey, fisrtname, lastname, avatar){
	
	PersonModel.findOne({ name: username }, function(err, found) {
    	if (!found) {
	   		console.log('User name not exist! ');
	   	} 
		else 
		{
			if	(pubkey) {
				PersonModel.update({_id: found._id}, {pubkey:pubkey}, function (err, doc) {
					if (!doc) {
						console.log('Update public key fail!');
					}
					else {
						console.log('Update public key success!');
					}
				});
			}
			
			if (fisrtname) {
				PersonModel.update({_id: found._id}, {fisrtName:fisrtname}, function (err, doc){
					if (!doc) {
						console.log('Update first name fail!');
					}
					else{
						console.log('Update first name success!');
					}
				});
			}
			
			if (lastname){
				PersonModel.update({_id: found._id}, {lastname:lastname}, function (err, doc){
					if (!doc) {
						console.log('Update last name fail!');
					}
					else{
						console.log('Update last name success!');
					}
				});
			}						
		}
	});
}

function settingUserProfile(username, data){
	
	PersonModel.findOne({ name: username }, function(err, found) {
    	if (!found) {
	   		console.log('User name not exist! ');
	   	} 
		else 
		{	
			if	(data.pubkey) {
				PersonModel.update({_id: found._id}, {pubkey:data.pubkey}, function (err, doc){
					if (!doc) {
						console.log('Update public key fail!');
					}
					else{
						console.log('Update public key success!');
					}
				});
			}
			
			if (data.fisrtName){
				PersonModel.update({_id: found._id}, {fisrtName:data.fisrtName}, function (err, doc){
					if (!doc) {
						console.log(username+ ' Update first name fail!');
					} 
					else{
						console.log(username + ' Update first name success!');
					}
				});
			}
			
			if (data.lastName){
				PersonModel.update({_id: found._id}, {lastname:data.lastName}, function (err, doc){
					if (!doc) {
						console.log(username + ' Update last name fail!');
					}
					else{
						console.log(username + ' Update last name success!');
					}
				});
			}
			
			if (data.email){
				PersonModel.update({_id: found._id}, {email:data.email}, function (err, doc){
					if (!doc) {
						console.log(username + ' Update email fail!');
					}
					else{
						console.log(username + ' Update email success!');
					}
				});
			}
			
			if (data.website){
				PersonModel.update({_id: found._id}, {website:data.website}, function (err, doc){
					if (!doc) {
						console.log(username + ' Update website fail!');
					}
					else{
						console.log(username + ' Update website success!');
					}
				});
			}
			
			if (data.avatar){
				PersonModel.update({_id: found._id}, {avatar:data.avatar}, function (err, doc){
					if (!doc) {
						console.log(username + ' Update avatar fail!');
					}
					else{
						console.log(username + ' Update avatar success!');
					}
				});
			}
			
			if (data.newpassword) {				
				PersonModel.update({_id: found._id}, {hashed:data.newpassword}, function (err, doc) {
					if (!doc) {
						console.log('Update password fail!');
					}
					else{
						console.log('Update password success!');
					}
				});

			}
		}
	});
}

<!------------------------------------------------------->
function findGroup(data, type)
{
	OfGroupModel.find(function (err, docs) {
		if (err)
			console.log('Error: find group');
		else if (docs.length)
		{
			try {
				
				var i = 0;
				while (i < docs.length)
				{
					var datasend;
					console.log('Find group: '+docs[i].groupName);											
					datasend = {from: 'server', event:'groups', to:data.username, groupID:docs[i].groupID, 
					groupName:docs[i].groupName, id:docs[i]._id, description:docs[i].description, posted:docs[i].posted };					
					serverSend(datasend, data.username);
					i ++;					
				}
			} 
			catch (err) 
			{
				console.log('Err: ' + err);
			}
		}
	});
}

function createNewGroup(grname, des)
{
	OfGroupModel.find({groupName:grname}, function (err, docs) {
		if (err)
			console.log('Error in create new group');
		else if (docs.length)
		{
			console.log('Group exsiting');
		}
		else {
			var gr = new OfGroupModel();
			gr.groupName = grname;
			gr.description = des;
			gr.save();
		}
	});
}

function removeGroup(grname)
{
	OfGroupModel.findOne({ groupName: grname }, function(err, found) {
    	if (!found) {
	   		console.log('Group not exist! ');
	   	} 
		else {
    		OfGroupModel.remove({ _id: found._id }, function(err, doc) {
				if 	(!err)
					console.log('Remove group success');
				else
					console.log('Remove group not success');
			});
		}
	});
}

function modifyGroup(grname, newgroup, newdes)
{
	OfGroupModel.findOne({ groupName: newgroup }, function(err, foundGroup) {
		if (foundGroup){
			console.log('Existing gourp name: '+ newgroup);
			return;
		}
	});
	
	OfGroupModel.findOne({ groupName: grname }, function(err, found) {
    	if (!found) {
	   		console.log('Group not exist! ');
	   	} 
		else 
		{	
			if	(grname) {
				OfGroupModel.update({_id: found._id}, {groupName:newgroup}, function (err, doc){
					if (!doc) {
						console.log('Update group fail!');
					}
					else{
						console.log('Updated group!');
					}
				});
			}
			
			if (newdes){
				OfGroupModel.update({_id: found._id}, {description:newdes}, function (err, doc){
					if (!doc) {
						console.log('Update description fail!');
					}
					else{
						console.log('Updated description!');
					}
				});
			}
		}
	});
}

<!--------------------------------------------------->
function removePosted(id)
{
	PostingModel.findOne({ _id: id }, function(err, found) {
    	if (!found) {
	   		console.log(id+' not exist! ');
	   	} 
		else {
    		PostingModel.remove({ _id: found._id }, function(err, doc) {
				if 	(!err)
					console.log('Remove success');
				else
					console.log('Remove not success');
			});
		}
	});
}

function markAsTrash(id, type)
{
	console.log('markAsTrash: '+id);
	PostingModel.findOne({ _id: id }, function(err, found) {
    	if (!found) {
	   		console.log('markAsTrash: '+id+' not exist! ');
	   	} 
		else {
			if (found.istrash == 'YES')
				removePosted(id);
			else
			{
    		PostingModel.update({_id:id}, {istrash:type}, function (err, docs) {
				if (err)
					console.log('Error: '+ err);
				else {
					try {
						console.log('markAsTrash: rash!!!!!!!!!!!!!!!');		
					} 
					catch (err) 
					{
						console.log('Err: ' + err);
					}
				}
			});
			}
		}
	});
}

function markAsArchive(id, type)
{
	console.log('markAsArchive: '+id);
	PostingModel.findOne({ _id: id }, function(err, found) {
    	if (!found) {
	   		console.log('markAsArchive: '+id+' not exist! ');
	   	} 
		else {
    		PostingModel.update({_id:id}, {isarchive:type}, function (err, docs) {
				if (err)
					console.log('Error: '+ err);
				else {
					try {
						console.log('markAsArchive: archive!!!!!!!!!!!!!!!');		
					} 
					catch (err) 
					{
						console.log('Err: ' + err);
					}
				}
			});
		}
	});
}


function updateFavorite(id, data){
	/*
	PostingModel.findByIdAndUpdate(id, { $set: { isfavorite: 'YES' }}, function (err, post) {
  		if (err) return handleError(err);
		console.log('findByIdAndUpdate');
  		//res.send(post);
	});
	return;
	*/
	PostingModel.find({_id:id}, function (err, docs) {
		if (err)
			console.log('Error: '+ err);
		else
		{
			var txt;
			if (docs[0].isfavorite == 'YES')
				txt = 'NO';
			else
				txt = 'YES';
			PostingModel.update({_id:id}, {isfavorite:txt}, function (err, docs) {
				if (err)
					console.log('Error: '+ err);
				else {
					
					try {
						console.log('Update: favorite success ' + data);
					} 
					catch (err) 
					{
						console.log('Err: ' + err);
					}
				}
			});
		}
	});
	
}

function findPostedBy(id, username, type, msg){
/*	
	PostingModel.findByIdAndUpdate(id, { $set: { size: 'large' }}, function (err, tank) {
  	if (err) return handleError(err);
  		res.send(tank);
	});
*/	
	var query;
	if (type == 'messageofgroup')
	{
		query = {to:id, groupname:msg};
	}
	else if (type == 'favorite')
	{
		query = {to:id, isfavorite:'YES'};
	}
	else if (type == 'trash')
	{
		console.log('Query Trash!!!');
		query = {to:id, istrash:'YES'};
	}
	else if (type == 'archive')
	{	console.log('Query archive!!!');
		query = {to:id, isarchive:'YES'};
	}
	else if (id != 'undefined')
	{
		query = {to:id};
	}
	
	
	PostingModel.find(query, function (err, docs) {
		if (err)
			console.log('Error: '+ err);
		else if (!docs.length)
			console.log('Query: '+JSON.stringify(query) + ' does not exist');
		else {
			try {
				console.log(JSON.stringify(query) + ' found!!!!!!!!!!!!!!!!!!!!!!!!');
				var i = 0;//docs.length-4;
				if	(i < 0)
					i = 0;
				while (i < docs.length)
				{
					var datasend;
					var json = docs[i].json;
					//console.log('Json Here !!!!!!!'+docs[i]);
					var cleardata = JSON.parse(json);
								
					var symkey = cleardata.symdata
					//datasend = {event:'text', text:docs[i].body, datesend:docs[i].sendDate, id:docs[i]._id, status:docs[i].status ,isdelete:docs[i].isdelete, isfavorite:docs[i].isfavorite, istrash:docs[i].istrash, isarchive:docs[i].isarchive};
					//serverSend(datasend, username);
					datasend = {from: 'server', event:'mail', to:username, original:docs[i].sendername, data:docs[i].body, 
					datesend:docs[i].sendDate, id:docs[i]._id, status:docs[i].status , isdelete:docs[i].isdelete, 
					isfavorite:docs[i].isfavorite, istrash:docs[i].istrash, isarchive:docs[i].isarchive, symkey:symkey};
					sendMailToClient(datasend, username);
					i ++;					
				}
			} 
			catch (err) 
			{
				console.log('Err: ' + err);
			}
		}
	});
}
<!------------------------------------------------------>
function pushEmbedData(username, myGroup, myDescription, post){
	console.log('Embed data:-->' + username);
	PersonModel.find({name:username}, function (err, docs) {
		if (err)
			console.log('Embed data error!');
		else if (!docs.length) {
			console.log('Embed data error! length');
		}
		else if (!docs[0].hashed) {
			console.log('Embed data not found');
		}
		else {
		
			//PersonModel.findOne({'group.groupName': myGroup}, function(err, found) {
			PersonModel.findOne({'groupName': myGroup}, function(err, found) {
    			if (!found) {
		    		console.log('Embed data now!!!'+myGroup); 
					 //{from: fromId, to: toId, body: message, dateSend: new Date()}
					 //docs[0].group.push({ groupName: myGroup, description: myDescription, posted: post });
					//docs[0].group.push({ groupName: myGroup, description: myDescription, posted: [{ dateSend: new Date()}] });
					docs[0].group.push({ groupName: myGroup, description: myDescription, 
									   posted: [{from: post.fromId, to: post.toId, body: post.body, dateSend: new Date()}] });
					//docs[0].group.push({ groupName: myGroup, description: myDescription});
			
					docs[0].save(function (err) {
  						if (!err) console.log('Success!');
						else console.log('Push group err!!'+ err.message);
						});
		    	} 
				else 
				{
					console.log('Group was existed');
					//docs[0].group.push({ posted: post });
					//docs[0].group.push({ groupName: myGroup, description: myDescription, posted: [{ dateSend: new Date()}] });
					
					docs[0].save(function (err) {
  						if (!err) console.log('Success!');
						else console.log('Push group err!!'+ err.message);
						});
				}
			});
		}
	});
}


function missiveOfGroupUser(username, myGroup, myDescription, post, fromID, toID){
	PersonModel.find({name:username}, function (err, docs) {
		if (err)
			console.log('Embed data error!');
		else if (!docs.length) {
			console.log('Embed data error! length');
		}
		else if (!docs[0].hashed) {
			console.log('Embed data not found');
		}
		else {
			
			PersonModel.findOne({'group.groupName': myGroup}, function(err, found) {
			//PersonModel.findOne({'groupName': myGroup}, function(err, found) {
    			if (!found) {
		    		console.log('Add group!!!'+myGroup);
					console.log( post.json);
					 //{from: fromId, to: toId, body: message, dateSend: new Date()}
					docs[0].group.push({ groupName: myGroup, description: myDescription,
									   posted: [{from: fromID, to: toID, body: post.body, dateSend: new Date(), json: post.json }] });
					//found.group.push({ groupName: 'test1', description: myDescription, posted: [{from: fromID, to: toID, body: post.body, dateSend: new Date(), json: post.json }] });
					docs[0].save(function (err) {
					//found.save(function (err) {
  						if (!err) console.log('Success!');
						else console.log('Push group err!!'+ err.message);
						});
		    	} 
				else 
				{
					/*PersonModel.find({from:fromID},{group:1}, function(err, fn) {
						if (fn)
						{
							console.log('Find fromID: '+JSON.stringify(fn));
							fn[0].posted.insert({ dateSend: new Date() });
						}else
						{
							console.log('Find: Error');
						}
					});*/
					console.log('Add group!!!'+myGroup);
					console.log('Group was existed:Updating..');// + JSON.stringify(found));
					//docs[0].group.push({ posted: post });
					//found.group.push({ description: myDescription, posted: [{ dateSend: new Date()}] });
					//found.group.push({ groupName: myGroup, description: myDescription, posted: [{from: fromID, to: toID, body: post.body, dateSend: new Date()}] });
					/*found.push({ _id : ObjectId('4f855061dd53351011000b42'), 'act_mgr' : [{ 'sales' : {'agent' : ['rohan@walkover.in' ],  'last_interacted' : 'rohan@walkover.in' } } ], 'email' : 'aman@asasas.com', 'name' : 'Aman', 'sales' : [{'sno' : 1,  'message' : 'description','status' : 'open'}, {'sno' : 12,'message' : 'assad','status' :'open'}]});

						found.save(function (err) {
  						if (!err) console.log('Success!');
						else console.log('Push group err!!'+ err.message);
						});*/
						
					//update({_id: found._id}, {description:newdes}, function (err, doc){
					console.log('found._id-->'+found._id);
	//				PersonModel.update({_id: found._id}, {$push:{'people.$.group.$.posted.$.body':'test !!!'}}, function (err, fn){
					//PersonModel.update({_id: found._id}, {$push:{'group.posted': [{from: fromID, to: toID, body: post.body, dateSend: new Date(), json: post.json }]}}, function (err, fn){
																																													//PersonModel.update({_id: found._id}, {$push:{'people.group.posted': [{from: fromID, to: toID, body: post.body, dateSend: new Date(), json: post.json }]}}, function (err, fn){ //ok
																																																																																						 PersonModel.update({'group.groupName': 'default group'}, {$push:{'group.posted': [{from: fromID, to: toID, body: post.body, dateSend: new Date(), json: post.json }]}}, function (err, fn){
//						 db.post.update({ _id: db.ObjectId(req.body.id) }, {$push: { comments: data }}, { safe: true }, function(err, field) {});
						if (fn)
						{
							console.log('Update posted success: ');
							
						}else
						{
							console.log('Update: Error: '+err.message);
						}
					});											 					//found.group.push({'group.$.sales.agent':'abc@walkover.in'});
/*{ 
    "_id" : ObjectId("4f855061dd53351011000b42"), 
    "act_mgr" : [{ "sales" : {"agent" : ["rohan@walkover.in" ],  "last_interacted" : "rohan@walkover.in" } } ],
    "email" : "aman@asasas.com", "name" : "Aman",
    "sales" : [{"sno" : 1,  "message" : "description","status" : "open"},{"sno" : 12,"message" : "assad","status" :"open"}]
}*/

//db.sales.update({"act_mgr.sales.last_interacted":"rohan@walkover.in"}, {$push:{"act_mgr.$.sales.agent":"abc@walkover.in"}, $set:{"act_mgr.$.sales.last_interacted":"abc@walkover.in"}})
//db.sales.update({"_id" : ObjectId("4f855061dd53351011000b42")}, {$push:{"act_mgr":{ "developer" : {"agent" : ["newdeveloper@walkover.in" ],  "last_interacted" : "newdeveloper@walkover.in" } }}})
					//found.group[myGroup].posted.push({ dateSend: new Date() });
					/*found.save(function (err) {
  						if (!err) console.log('Success!');
						else console.log('Push group err!!'+ err.message);
						});*/
				}
			});
		}
	});
}

function postMeessageOfGroup(id, groupname, type)
{
	console.log('update group: ' + id);
	PostingModel.findOne({ receivename: id }, function(err, found) {
    	if (!found) {
	   		console.log('messageOfGroup: '+id+' not exist! ');
	   	} 
		else {
    		PostingModel.update({receivename:id}, {groupname:groupname}, function (err, docs) {
				if (err)
					console.log('Error: '+ err);
				else {
					try {
						console.log('messageOfGroup: group!!!!!!!!!!!!!!!');		
					} 
					catch (err) 
					{
						console.log('Err: ' + err);
					}
				}
			});
		}
	});
}

function missiveOfGroup(groupname, fromId, toId, message){
	//OfGroupModel.find({name:username}, function (err, docs) {
			OfGroupModel.findOne({groupName: groupname}, function(err, found) {
    			if (!found) {
		      		console.log('Group was not found in database');
		    	} 
				else 
				{
					console.log('missiveOfGroup: was push!!'+message);
      				//found.group.description = "Test push possting to group";
					//{ from: 'id'}to: from, 
					//docs[0].group.push({ groupName: 'Test Push' });
					found.posted.push( {from: fromId, to: toId, body: message, dateSend: new Date()});
			  		//found.save();
      				found.save(function(err) {
						if (!err) console.log('missiveOfGroup: Success! ');
						else console.log('Error!! ' + err.message);
					});
				}
			});
			console.log('Hererereee!!!!!!!!h!!'+message);
}

function posted(data) {
	var who = data.from;
	//var publ = '{"point":[1324584956,888748133,1231178966,-196007002,-651318423,-2048041408,-1085381145,584870534,61805138,-691949372,1699866676,1201966708,-692370907,-186422022,535481603,-40753102,-392759041,158128584,-689615161,-566445758,-1225297779,-306726469,-793701110,556865080],"curve":384}';
	//createNewGroup('test group', 'des');
	//createNewGroup('test group1', 'des');
	//createNewGroup('test group2', 'des');
	//removeGroup('test group modify1');
	 //modifyGroup('test group', 'test group modify1', 'new description');
	//updateUserProfile(who, publ);
	 
	console.log('Server: posted data user= ??????????????????' + who);
	
	PersonModel.find({name:who}, function (err, docs) {
		if (err)
			reject(who, err);
		else if (!docs.length) {
		}
		else if (!docs[0].hashed) {
		}
		else {
			/*var person = new PersonModel();			
						  
			person.group.push({ groupName: 'Group test tes test!!!!!!!!!!!!!!!' });
			person.group.push({ description: 'roup test tes test!!!!!!!!!!!!!' });
			
			person.save(function (err) {
  				if (!err) console.log('Success!');
			});*/
			
			/*PersonModel.update({_id: docs[0]._id}, {fisrtName:'Tai232 test'}, function (err, doc){
				if (!doc) {
					console.log('update group fail!');
			 	}
			 	else {
				 	console.log('Updated data ...........?????????');
			 	}
			});
			*/
			
			/*PersonModel.findOne({_id: docs[0]._id}, function(err, found) {
    			if (!found) {
		      		console.log('URL was not found in update_incoming_url ' + url);
		    	} 
				else 
				{
					console.log('Find Update by Save data now ...........');
      				found.group.description = "i am modifi";
			  		//found.save();
      				found.save(function(err) {
						if (!err) console.log('Success!');
						else console.log('Error!!');
					});
				}
			});*/
			
			var posting = new PostingModel();
			var fromId  = docs[0]._id;
			var toId;
			PersonModel.find({name:data.destination}, function (err, des) {
				if (err)
					reject(who, err);
				else if (!des.length) {
				}
				else if (!des[0].hashed) {
				}
				else {
					posting.sendername = data.from;
					posting.receivename = data.destination;
					posting.from = fromId;
					posting.to = des[0]._id;
					posting.body = JSON.stringify(data.text);
					posting.sendDate = new Date;
					posting.json = JSON.stringify(data);
					posting.save(function (err) {
						if (!err)// console.log('saved 1');
						{
							console.log('Server: saved');
							missive( data.from, data, 'success');
						}
						else
						{
							console.log(err.message)
							console.log('Server: not save-->' + err);							
						}
					});
				}
			});
			
			
			//console.log('Server: store data into db: '+ JSON.stringify(posting));
			/*var where = { $push: { 'group': {postting: posting } } };
			console.log('Push where update-->'+ JSON.stringify(where));								   																						
			PersonModel.update({name:who},  where, function (err, doc){
				if (err) {
					console.log('Update group fail! '+ err);
				}
				else{
					console.log('Updated group!');
				}
			});*/
			
			
			/*13/8
			var where = { $push: { 'group': {postting: posting } } };
			console.log('Push where update-->'+ JSON.stringify(where));								   																						
			PersonModel.update({name:who, 'group.groupName':''},  where, function (err, doc){
				if (err) {
					console.log('Update group fail! '+ err);
				}
				else{
					console.log('Updated group!');
				}
			});
			*/
			//missiveOfGroupUser(who, 'dedault group', 'test post to user', posting, docs[0]._id, docs[0]._id);
			//missiveOfGroup('test group', docs[0]._id, docs[0]._id, JSON.stringify(data.text));
			
		}
	});
}

function checkContactList(id)
{
	
	ContactListModel.find({_id:id}, function(err, founds) {
    	if (!founds) {
	   		console.log('Username does not exist! ');
	   	} 
		else {
			console.log('findContact: found! '+'-->' + founds[0].username);
			return true;
		}
	});	
}

function createNewContactList(data, founds){
	
	console.log('Add new contact list! ');
	/*
ContactListModel.find({_id:id}, function(err, founds) {
    	if (!founds) {
*/
			
	   		console.log('Username does not exist! ');
			
			var contact = new ContactListModel();
			//groupID		: ObjectId,
			contact.groupName = 'default group';
			contact.groups = ["Friends", "Neighbors"];//change to _id
			contact.username = data.username;
			contact.contactUser = founds.name;
			contact.firstname = founds.firstname;
			contact.lastname = founds.lastname;
			contact.description = 'Test contact group';
			contact.title = 'Director';
			contact.company = 'TOHUJ';
			contact.phone =  [ { work: '800-555-1234'}, { homes: '888-555-5432'} ];
			contact.addresses = [ { city : "New York", street : "Broadway" } ] ;
		
			contact.save(function (err) {
				if (!err)// console.log('saved 1');
				{
					console.log('Server: contact saved');
				}
				else
				{
					console.log(err.message)
					console.log('Server: contact not save-->' + err);							
				}
			});
	   /*	} 
		
else {			
		}
	});		
*/
}

function postedEmbed(data) {
	var who = data.from;
	var publ = '{"point":[1324584956,888748133,1231178966,-196007002,-651318423,-2048041408,-1085381145,584870534,61805138,-691949372,1699866676,1201966708,-692370907,-186422022,535481603,-40753102,-392759041,158128584,-689615161,-566445758,-1225297779,-306726469,-793701110,556865080],"curve":384}';
	
	updateUserProfile(who, publ);
	 
	console.log('Server: posted data user= ??????????????????' + who);
	
	PersonModel.find({name:who}, function (err, docs) {
		if (err)
			reject(who, err);
		else if (!docs.length) {
		}
		else if (!docs[0].hashed) {
		}
		else {
			var person = new PersonModel();
			//var posting = new PostingModel();
			
			//MyModel.update({ age: { $gt: 18 } }, { oldEnough: true }, fn);
			//collection.update({_id:"123"}, {author:"Jessica", title:"Mongo facts"});
			
						  
			person.group.push({ groupName: 'My Group' });
			person.group.push({ description: 'descript' });
			
			PersonModel.update({_id: docs[0]._id}, {fisrtName:'Tai232 test'}, function (err, doc){
				if (!doc) {
					console.log('update group fail!');
			 	}
			 	else {
				 	console.log('Updated data ...........?????????');
			 	}
			});
			
			PersonModel.findOne({_id: docs[0]._id}, function(err, found) {
    			if (!found) {
		      		console.log('URL was not found in update_incoming_url ' + url);
		    	} 
				else 
				{
					console.log('Find Update by Save data now ...........');
      				found.group.description = "i am modifi";
			  		found.save();
      				//found.save(function(err) {});
				}
			});
			
			var posting = new PostingModel();
			var from  = docs[0]._id;
			//console.log('DOCS-->' + docs);
			//console.log('idFrom-->' + from);
			posting.sendername = data.from;
			posting.receivename = data.destination;
			posting.from = from;
			posting.to = from;
			posting.body = JSON.stringify(data.text);
			posting.sendDate = new Date;
			posting.jkey =  JSON.stringify(data.symdata);
			posting.json = JSON.stringify(data);
			
			
			posting.save(function (err) {
				if (!err)// console.log('saved 1');
				{
					console.log('Server: store data into db: jkey:'+ JSON.stringify(posting.jkey));
					console.log('Server: saved!!!!!');
					missive(from, data, 'success');
					 
					//accept(who, 'posted: user ' + who + ' created');
				}
				else
				{
					console.log(err.message)
					console.log('Server: not save-->' + err);
					//reject(who, err);
				}
			});
		}
	});
}

function postedEmbeg(data) {
	var who = data.from;
	console.log('Server: posted data user= ??????????????????' + who);
	PersonModel.find({name:who}, function (err, docs) {
		if (err)
			reject(who, err);
		else if (!docs.length)
			reject(who, 'Server: posted: user ' + who + ' does not exist');
		else if (!docs[0].hashed)
			reject(who, 'Server: posted: user ' + who + ' is missing hashed');
		else {
			var posting = new PostingModel();
			var from  = docs[0]._id;
			//console.log('DOCS-->' + docs);
			//console.log('idFrom-->' + from);
			posting.from = from;
			posting.to = from;
			posting.body = JSON.stringify(data.text);
			posting.sendDate = new Date;
			posting.json = JSON.stringify(data);
			
			//console.log('Server: store data into db: '+ JSON.stringify(posting));
			
			posting.save(function (err) {
				if (!err)// console.log('saved 1');
				{
					console.log('Server: saved');
					missive(from, data, 'success');
					 
					//accept(who, 'posted: user ' + who + ' created');
				}
				else
				{
					console.log(err.message)
					console.log('Server: not save-->' + err);
					//reject(who, err);
				}
			});
		}
	});
}

function findAllUser(data, tag)
{
	PersonModel.find(function(err, founds) {
    	if (!founds) {
	   		console.log('Username does not exist! ');
	   	} 
		else {
			console.log('findContact: found! '+'-->' + founds[0].name);
			var i = 0;//founds.length - 6;
			if	(i < 0)
				i = 0;
			while (i < founds.length){
				
				if (i < founds.length - 4)
				{
					createNewContactList(data, founds[i]);
					
				}
				
				var datasend;
					
				datasend = {from: 'server', event:'contact', to:data.username, name:founds[i].name, email:founds[i].email, fisrtName:founds[i].fisrtName, lastName:founds[i].lastName, id:founds[i]._id, avatar:founds[i].avatar , creationDate:founds[i].creationDate};
				i ++;
				serverSend(datasend, data.username);
			}
		}
	});	
}

function findContactList(data, tag)
{
	
	ContactListModel.find({username:data.username}, function(err, founds) {
    	if (!founds) {
	   		console.log('Username does not exist! ');
	   	} 
		else {
			console.log('findContact: found! '+'-->' + data.username);
			var i = 0;//founds.length - 6;
			if	(i < 0)
				i = 0;
			while (i < founds.length){
				
								
				var datasend;
				
/*				contact.groupName = 'default group';
				contact.groups = ["Friends", "Neighbors"];//change to _id
				contact.username = data.username;
				contact.contactUser = founds.name;
				contact.description = 'Test contact group';
				contact.title = 'Director';
				contact.company = 'TOHUJ';
				contact.phone =  [ { work: '800-555-1234'}, { homes: '888-555-5432'} ];
				contact.addresses : [ { city : "New York", street : "Broadway" } ] ;
	*/
			
				datasend = {from: 'server', event:'contact', to:data.username, name:founds[i].contactUser, 
				fisrtName:founds[i].title, lastName:founds[i].company, id:founds[i]._id };	
				console.log(JSON.stringify(datasend));
				
				serverSend(datasend, data.username);
				
				i ++;
			}
		}
	});	
}

function requested(data){
	
	//postMeessageOfGroup(data.username, 'Test groups');
	//return;
/*	if (data.type == 'groups')
	{
		console.log('groups groups');
	 	//removeContact(data.id);
		
		return;
	}*/
	if (data.msg == 'trash')
	{
		console.log('trash trash');
	 	removeContact(data.id);
		
		return;
	}
	if (data.msg == 'RemoveContact')
	{
		console.log('Remove RemoveContact');
	 	removeContact(data.id);
		return;
	}
	if (data.msg == 'RemoveGroup')
	{
		console.log('Remove Group');
	 	removeGroup(data);
		return;
	}
	if (data.msg == 'AllGroups')
	{
		console.log('Find Group');
	 	findGroup(data);
		return;
	}
	else if	(data.msg == 'AllContact')
	{
		console.log('AllContact-->find');
		//findAllUser(data);
		findContactList(data);
		return;
	}
	else {
	PersonModel.findOne({ name: data.username }, function(err, found) {
    	if (!found) {
	   		console.log('Username does not exist! ');
	   	} 
		else {
			console.log('findIdFromUser: found! '+JSON.stringify(data)+ '-->' + found._id);
    		id = found._id;
			console.log('requested:????' + data.type);
			var type = data.type;
			//if(type == 'favorite')
			if(type)
			{
				console.log('requested:Find by????' + data.type);
				if (type == 'profile')
				{
					settingUserProfile(data.username, data.msg);
				}
				else
				{
					findPostedBy(id, data.username, type, data.msg);
				}
				
			}
			else
			{
				PostingModel.find({to:id}, function (err, docs) {
					if (err)
						console.log('Error: '+ err);
					else if (!docs.length)
						console.log('Username: ' + data.username + ' does not exist');
					else {
						try {
							
							var i = 0;//docs.length - 4;
							if	(i < 0)
								i = docs.length;
							while (i < docs.length){
								var datasend;
								
								var json = docs[i].json;
								//console.log('Json Here !!!!!!!'+docs[i]);
								var cleardata = JSON.parse(json);
								console.log('Clear Here !!!!!!!' + cleardata);
								
								var data_text = docs[i].body;
								var datesend = docs[i].sendDate;
								var id_message = docs[i]._id;
								var status = docs[i].status
								var isdelete = docs[i].isdelete;
								var isfavorite = docs[i].isfavorite;
								var istrash = docs[i].istrash;
								var isarchive = docs[i].isarchive
								var symkey = cleardata.symdata
								
								if	(cleardata.symdata)
								{
									datasend = {from: 'server', event:'mail', to:data.username, original:docs[i].sendername, 
									data:data_text, datesend:datesend, id:id_message, status:status , isdelete:isdelete, 
									isfavorite:isfavorite, istrash:istrash, isarchive:isarchive, symkey:symkey};
									sendMailToClient(datasend, data.username);
									console.log("Have symkey----->>>>>>"+JSON.stringify(datasend));
								}
										
								PersonModel.findOne({ _id: docs[i].from }, function(err, founds) {
									if (!founds) {
										console.log('Username does not exist! ');
									} 
									else 
									{
										/*console.log('Username original for from :-->! '+founds.name);
										if	(cleardata.symdata)
										{
											datasend = {from: 'server', event:'mail', to:data.username, original:founds.name, data:data_text, datesend:datesend, id:id_message, status:status ,isdelete:isdelete, isfavorite:isfavorite, istrash:istrash, isarchive:isarchive, symkey:symkey};
											sendMailToClient(datasend, data.username);
											console.log("Have symkey----->>>>>>"+JSON.stringify(datasend));
										}
										/*else
										{
											console.log("No symkey----->>>>>>"+docs[i].jkey + docs[i]);
											datasend = {event:'text', text:docs[i].body, datesend:docs[i].sendDate, id:docs[i]._id, status:docs[i].status ,isdelete:docs[i].isdelete, isfavorite:docs[i].isfavorite, istrash:docs[i].istrash, isarchive:docs[i].isarchive, symkey:docs[i].symdata};
											serverSend(datasend, data.username);
										}*/
									}
									
								});	
								i ++;
							}
						} 
						catch (err) 
						{
							console.log('Err: ' + err);
						}
					}
				});
			}
		}
	});
	}
}

function markRequested(data){
	if (data.type == 'markAsFavorite'){
		if	(data.id != 'undefinded'){
			/*PostingModel.update({_id:data.id}, {isfavorite:data.text}, function (err, docs) {
				if (err)
					console.log('Error: '+ err);
				else if (!docs.length)
					console.log('Server: ' + ' does not exist');
				else {
					try {						
					} 
					catch (err) 
					{
						console.log('Err: ' + err);
					}
				}
			});*/
			 updateFavorite(data.id, data.text);
		}
	}
	else if (data.type == 'markAsDelete'){
		if	(data.id != 'undefinded'){
			 //removePosted(data.id);
			 //console.log(JSON.stringify(data));
			 markAsTrash(data.id, 'YES');
		}
	}
	else if (data.type == 'markAsArchive'){
		if	(data.id != 'undefinded'){
			 //removePosted(data.id);
			 //console.log(JSON.stringify(data));
			 markAsArchive(data.id, 'YES');
		}
	}
}

// setup

var mongoose = require('mongoose'),
			   Schema = mongoose.Schema,
			   ObjectId = Schema.ObjectId;
mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/my_database')

var PersonSchema = new Schema({
	uid		: String,
	hashed	: String,
	salt	: String,
	name	: String,
	pubkey  : String,
	email			: String, //here
	
	website			: String,
	fisrtName		: String,
	lastName		: String,
	avatar			: String,
	creationDate	: Date,
	modificationDate: { type: Date, dedault: Date.now },
	contacts		: [ContactListModel],
	posted			: [PostingModel],
	group : [OfGroupModel]
});
var PersonModel = mongoose.model('Person', PersonSchema);

var ContactOfGroupSchema = new Schema({
	groupID		: ObjectId,
	groupName	: String,
	description	: String,
	contacts	: [String],//username
	UserId		: ObjectId	
});
var ContactOfGroupModel = mongoose.model('ContactOfGroup', ContactOfGroupSchema);

var ContactListSchema = new Schema({
	groupID		: ObjectId,
	groupName	: String,
	userId		: ObjectId,
	username	: String, //contact of username
	name		: String,
	contactUser	: String,
	firstname	: String,
	lastname	: String,
	description	: String,
	title		: String,// �President�
	company		: String,
	website		: String,
	groups		: [],//groupId
	addresses 	: [],
	phone		: [],//array ofwork,cell �phones� : [{"work" : "202-555-1111"},{"cell" : "800-555-1212"}]
	contacts	: []//contact list of username
});
var ContactListModel = mongoose.model('ContactList', ContactListSchema);


var OfGroupSchema = new Schema({
	groupID		: ObjectId,
	groupName	: String,
	description	: String,
	contacts	: [],//username
	posted	: [PostingModel]
});
var OfGroupModel = mongoose.model('ofGroup', OfGroupSchema);

//User, group, contactlist of

var PostingSchema = new Schema({
	from		: ObjectId,
	to			: ObjectId,
	toGroup 	: [ObjectId],
	groupname	: String,
	sendername	: String,
	receivename	: String,
	title		: String,
	body		: String,
	sendDate	: Date,
	receivedDate: Date,
	modifyDate	: Date,
	status 		: String, 
	isdelete	: String,//Yes, no
	isfavorite 	: String,
	istrash		: String,
	isarchive	: String,
	jkey		: String,
	json		: String
});
var PostingModel = mongoose.model('Posting', PostingSchema);
<!---------------------->

var ProfileSchema = new Schema({
	uid				: ObjectId,
	email			: String,
	fisrtName		: String,
	lastName		: String,
	avatar			: String,
	creationDate	: Date,
	modificationDate: { type: Date, dedault: Date.now }
});
var ProfileModel = mongoose.model('Profile', ProfileSchema);

var LoginSchema = new Schema({
	userID		: ObjectId,
	Username	: String,
	Name		: String,
	startTime	: Date,
	endTime		: Date
});
var LoginModel = mongoose.model('Login', LoginSchema);

//Using with the Express web framework //npm install socket.io express
//Middleware
//Middleware via Connect can be passed to express.createServer() as you would with a regular Connect server
var express = require('express');
var app = express.createServer();
app.use(express.static(__dirname));
app.listen(port);
console.log('Server listening on port: ' + port);

var handler = function(data) {
	console.log(new Date+'!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
	console.log('Event handler: --> ' + data.event);
//	console.log('Server: data from client--> ' + JSON.stringify(data));
  
	var handler = {salt:salted, signup:signuped, signin:signined, mail:posted, mess:requested, mark:markRequested} [data.event];
	handler && handler(data);
}

var Crypt = require('./crypt');
crypt = new Crypt({handle:handler}, 'server', app);
