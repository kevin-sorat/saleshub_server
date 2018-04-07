/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    user = require('./routes/user'),
    http = require('http'),
    path = require('path'),
    fs = require('fs');

var app = express();

var db;
var dbName_1;
var dbCompanyInfo;
var dbChatRoom;

var cloudant;

var fileToUpload;

var dbCredentials = {
    dbName: 'my_sample_db',
    dbName_1: 'sales_opportunities_db',
    dbCompanyInfo: 'company_info_db',
    dbChatRoom: 'chatroom_db',
};

var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var multipart = require('connect-multiparty')
var multipartMiddleware = multipart();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.use(logger('dev'));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/style', express.static(path.join(__dirname, '/views/style')));

// development only
if ('development' == app.get('env')) {
    app.use(errorHandler());
}

function getDBCredentialsUrl(jsonData) {
    var vcapServices = JSON.parse(jsonData);
    // Pattern match to find the first instance of a Cloudant service in
    // VCAP_SERVICES. If you know your service key, you can access the
    // service credentials directly by using the vcapServices object.
    for (var vcapService in vcapServices) {
        if (vcapService.match(/cloudant/i)) {
            return vcapServices[vcapService][0].credentials.url;
        }
    }
}

function initDBConnection() {
    //When running on Bluemix, this variable will be set to a json object
    //containing all the service credentials of all the bound services
    if (process.env.VCAP_SERVICES) {
        dbCredentials.url = getDBCredentialsUrl(process.env.VCAP_SERVICES);
    } else { //When running locally, the VCAP_SERVICES will not be set

        // When running this app locally you can get your Cloudant credentials
        // from Bluemix (VCAP_SERVICES in "cf env" output or the Environment
        // Variables section for an app in the Bluemix console dashboard).
        // Once you have the credentials, paste them into a file called vcap-local.json.
        // Alternately you could point to a local database here instead of a
        // Bluemix service.
        // url will be in this format: https://username:password@xxxxxxxxx-bluemix.cloudant.com
        dbCredentials.url = getDBCredentialsUrl(fs.readFileSync("vcap-local.json", "utf-8"));
    }

    cloudant = require('cloudant')(dbCredentials.url);

    // check if DB exists if not create
    cloudant.db.create(dbCredentials.dbName, function (err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbName + ', it might already exist.');
        }
    });

    cloudant.db.create(dbCredentials.dbName_1, function (err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbName_1 + ', it might already exist.');
        }
    });

    cloudant.db.create(dbCredentials.dbCompanyInfo, function (err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbCompanyInfo + ', it might already exist.');
        }
    });

    cloudant.db.create(dbCredentials.dbChatRoom, function (err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbChatRoom + ', it might already exist.');
        }
    });

    db = cloudant.use(dbCredentials.dbName);

    dbName_1 = cloudant.use(dbCredentials.dbName_1);

    dbCompanyInfo = cloudant.use(dbCredentials.dbCompanyInfo);

    dbChatRoom = cloudant.use(dbCredentials.dbChatRoom);
}

initDBConnection();

app.get('/', routes.index);

function createResponseData(id, name, value, attachments) {

    var responseData = {
        id: id,
        name: sanitizeInput(name),
        value: sanitizeInput(value),
        attachements: []
    };

    attachments.forEach(function (item, index) {
        var attachmentData = {
            content_type: item.type,
            key: item.key,
            url: '/api/favorites/attach?id=' + id + '&key=' + item.key
        };
        responseData.attachements.push(attachmentData);

    });
    return responseData;
}

function createResponseData_1(id, rev, companyname, product, description, price, commission, userid) {

    var responseData = {
        id: id,
        rev: rev,
        companyname: sanitizeInput(companyname),
        product: sanitizeInput(product),
        description: sanitizeInput(description),
        price: sanitizeInput(price),
        commission: sanitizeInput(commission),
        userid: sanitizeInput(userid),
    };
    return responseData;
}

function createResponseForGetCompanyInfo(id, rev, companyname, companyaddress, companyphone, userid) {

    var responseData = {
        id: id,
        rev: rev,
        companyname: sanitizeInput(companyname),
        companyaddress: sanitizeInput(companyaddress),
        companyphone: sanitizeInput(companyphone),
        userid: sanitizeInput(userid)
    };
    return responseData;
}

function createResponseForGetChatRoom(id, rev, salesmanUserID, companyUserID, salesOppID, messages) {
    
    var responseData = {
        id: id,
        rev: rev,
        salesmanUserID: sanitizeInput(salesmanUserID),
        companyUserID: sanitizeInput(companyUserID),
        salesOppID: sanitizeInput(salesOppID),
        messages: messages,
    };
    return responseData;
}

function sanitizeInput(str) {
    return String(str).replace(/&(?!amp;|lt;|gt;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var saveDocument = function (id, name, value, response) {

    if (id === undefined) {
        // Generated random id
        id = '';
    }

    db.insert({
        name: name,
        value: value
    }, id, function (err, doc) {
        if (err) {
            console.log(err);
            response.sendStatus(500);
        } else
            response.sendStatus(200);
        response.end();
    });

}

app.get('/api/favorites/attach', function (request, response) {
    var doc = request.query.id;
    var key = request.query.key;

    db.attachment.get(doc, key, function (err, body) {
        if (err) {
            response.status(500);
            response.setHeader('Content-Type', 'text/plain');
            response.write('Error: ' + err);
            response.end();
            return;
        }

        response.status(200);
        response.setHeader("Content-Disposition", 'inline; filename="' + key + '"');
        response.write(body);
        response.end();
        return;
    });
});

app.post('/api/favorites/attach', multipartMiddleware, function (request, response) {

    console.log("Upload File Invoked..");
    console.log('Request: ' + JSON.stringify(request.headers));

    var id;

    db.get(request.query.id, function (err, existingdoc) {

        var isExistingDoc = false;
        if (!existingdoc) {
            id = '-1';
        } else {
            id = existingdoc.id;
            isExistingDoc = true;
        }

        var name = sanitizeInput(request.query.name);
        var value = sanitizeInput(request.query.value);

        var file = request.files.file;
        var newPath = './public/uploads/' + file.name;

        var insertAttachment = function (file, id, rev, name, value, response) {

            fs.readFile(file.path, function (err, data) {
                if (!err) {

                    if (file) {

                        db.attachment.insert(id, file.name, data, file.type, {
                            rev: rev
                        }, function (err, document) {
                            if (!err) {
                                console.log('Attachment saved successfully.. ');

                                db.get(document.id, function (err, doc) {
                                    console.log('Attachements from server --> ' + JSON.stringify(doc._attachments));

                                    var attachements = [];
                                    var attachData;
                                    for (var attachment in doc._attachments) {
                                        if (attachment == value) {
                                            attachData = {
                                                "key": attachment,
                                                "type": file.type
                                            };
                                        } else {
                                            attachData = {
                                                "key": attachment,
                                                "type": doc._attachments[attachment]['content_type']
                                            };
                                        }
                                        attachements.push(attachData);
                                    }
                                    var responseData = createResponseData(
                                        id,
                                        name,
                                        value,
                                        attachements);
                                    console.log('Response after attachment: \n' + JSON.stringify(responseData));
                                    response.write(JSON.stringify(responseData));
                                    response.end();
                                    return;
                                });
                            } else {
                                console.log(err);
                            }
                        });
                    }
                }
            });
        }

        if (!isExistingDoc) {
            existingdoc = {
                name: name,
                value: value,
                create_date: new Date()
            };

            // save doc
            db.insert({
                name: name,
                value: value
            }, '', function (err, doc) {
                if (err) {
                    console.log(err);
                } else {

                    existingdoc = doc;
                    console.log("New doc created ..");
                    console.log(existingdoc);
                    insertAttachment(file, existingdoc.id, existingdoc.rev, name, value, response);

                }
            });

        } else {
            console.log('Adding attachment to existing doc.');
            console.log(existingdoc);
            insertAttachment(file, existingdoc._id, existingdoc._rev, name, value, response);
        }

    });

});

app.post('/api/favorites', function (request, response) {

    console.log("Create Invoked..");
    console.log("Name: " + request.body.name);
    console.log("Value: " + request.body.value);

    // var id = request.body.id;
    var name = sanitizeInput(request.body.name);
    var value = sanitizeInput(request.body.value);

    saveDocument(null, name, value, response);

});

app.delete('/api/favorites', function (request, response) {

    console.log("Delete Invoked..");
    var id = request.query.id;
    // var rev = request.query.rev; // Rev can be fetched from request. if
    // needed, send the rev from client
    console.log("Removing document of ID: " + id);
    console.log('Request Query: ' + JSON.stringify(request.query));

    db.get(id, {
        revs_info: true
    }, function (err, doc) {
        if (!err) {
            db.destroy(doc._id, doc._rev, function (err, res) {
                // Handle response
                if (err) {
                    console.log(err);
                    response.sendStatus(500);
                } else {
                    response.sendStatus(200);
                }
            });
        }
    });

});

app.put('/api/favorites', function (request, response) {

    console.log("Update Invoked..");

    var id = request.body.id;
    var name = sanitizeInput(request.body.name);
    var value = sanitizeInput(request.body.value);

    console.log("ID: " + id);

    db.get(id, {
        revs_info: true
    }, function (err, doc) {
        if (!err) {
            console.log(doc);
            doc.name = name;
            doc.value = value;
            db.insert(doc, doc.id, function (err, doc) {
                if (err) {
                    console.log('Error inserting data\n' + err);
                    return 500;
                }
                return 200;
            });
        }
    });
});

app.get('/api/favorites', function (request, response) {

    console.log("Get method invoked.. ")

    db = cloudant.use(dbCredentials.dbName);
    var docList = [];
    var i = 0;
    db.list(function (err, body) {
        if (!err) {
            var len = body.rows.length;
            console.log('total # of docs -> ' + len);
            if (len == 0) {
                // push sample data
                // save doc
                var docName = 'sample_doc';
                var docDesc = 'A sample Document';
                db.insert({
                    name: docName,
                    value: 'A sample Document'
                }, '', function (err, doc) {
                    if (err) {
                        console.log(err);
                    } else {

                        console.log('Document : ' + JSON.stringify(doc));
                        var responseData = createResponseData(
                            doc.id,
                            docName,
                            docDesc, []);
                        docList.push(responseData);
                        response.write(JSON.stringify(docList));
                        console.log(JSON.stringify(docList));
                        console.log('ending response...');
                        response.end();
                    }
                });
            } else {

                body.rows.forEach(function (document) {

                    db.get(document.id, {
                        revs_info: true
                    }, function (err, doc) {
                        if (!err) {
                            if (doc['_attachments']) {

                                var attachments = [];
                                for (var attribute in doc['_attachments']) {

                                    if (doc['_attachments'][attribute] && doc['_attachments'][attribute]['content_type']) {
                                        attachments.push({
                                            "key": attribute,
                                            "type": doc['_attachments'][attribute]['content_type']
                                        });
                                    }
                                    console.log(attribute + ": " + JSON.stringify(doc['_attachments'][attribute]));
                                }
                                var responseData = createResponseData(
                                    doc._id,
                                    doc.name,
                                    doc.value,
                                    attachments);

                            } else {
                                var responseData = createResponseData(
                                    doc._id,
                                    doc.name,
                                    doc.value, []);
                            }

                            docList.push(responseData);
                            i++;
                            if (i >= len) {
                                response.write(JSON.stringify(docList));
                                console.log('ending response...');
                                response.end();
                            }
                        } else {
                            console.log(err);
                        }
                    });

                });
            }

        } else {
            console.log(err);
        }
    });

});

/*
 * Get sales opportunities list
 */
app.get('/api/salesopportunities', function (request, response) {
    console.log("Get method salesopportunities invoked.. ")

    dbName_1 = cloudant.use(dbCredentials.dbName_1);
    var docList = [];
    var i = 0;
    dbName_1.list(function (err, body) {
        if (!err) {
            var len = body.rows.length;
            console.log('total # of docs -> ' + len);
            if (len > 0) {
                body.rows.forEach(function (document) {
                    dbName_1.get(document.id, {
                        revs_info: true
                    }, function (err, doc) {
                        if (!err) {
                            var responseData = createResponseData_1(
                                doc._id,
                                doc._rev,
                                doc.companyname,
                                doc.product,
                                doc.description,
                                doc.price,
                                doc.commission,
                                doc.userid);
                            docList.push(responseData);
                            i++;
                            if (i >= len) {
                                response.write(JSON.stringify(docList));
                                console.log('ending response...');
                                response.end();
                            }
                        }
                    });
                });
            }
        } else {
            console.log(err);
        }
    });
});

/*
 * Post a new sale opportunity
 */
app.post('/api/salesopportunities', function (request, response) {
    
    console.log("Create method salesopportunities Invoked..");
    console.log("Company name: " + request.body.companyname);
    console.log("Product: " + request.body.product);
    console.log("Description: " + request.body.description);
    console.log("Price: " + request.body.price);
    console.log("Commission: " + request.body.commission);
    console.log("User ID: " + request.body.userid);

    saveSalesOpportunity(request.body.id, request.body.rev, request.body.companyname, request.body.product, request.body.description,
        request.body.price, request.body.commission, request.body.userid, response);
});

var saveSalesOpportunity = function (id, rev, companyname, product, description, price, commission, userid, response) {

    console.log("_id: " + id);
    console.log("_rev: " + rev);

    if (id === undefined) {
        // Generated random id
        id = '';
    }

    if (rev === undefined) {
        rev = '';
    }

    dbName_1 = cloudant.use(dbCredentials.dbName_1);
    if (rev !== '') {
        dbName_1.insert({
            _id: id,
            _rev: rev,
            companyname: companyname,
            product: product,
            description: description,
            price: price,
            commission: commission,
            userid: userid
        }, id, function (err, doc) {
            if (err) {
                console.log(err);
                response.sendStatus(500);
            } else {
                response.sendStatus(200);
            }
            response.end();
        });
    } else {
        dbName_1.insert({
            companyname: companyname,
            product: product,
            description: description,
            price: price,
            commission: commission,
            userid: userid
        }, id, function (err, doc) {
            if (err) {
                console.log(err);
                response.sendStatus(500);
            } else {
                response.sendStatus(200);
            }
            response.end();
        });
    }
}

/*
 * Get user's company information
 */
app.get('/api/companyinfo', function (request, response) {
    console.log("Get method companyinfo invoked.. ")

    var query = {
        "selector": {
            "userid": request.query.userid
        }
    };

    dbCompanyInfo = cloudant.use(dbCredentials.dbCompanyInfo);
    dbCompanyInfo.find(query, function (err, data) {
        if (!err) {
            var len = data.docs.length;
            if (len > 0) {
                // 'data' contains results
                var responseData = createResponseForGetCompanyInfo(
                    data.docs[0]._id,
                    data.docs[0]._rev,
                    data.docs[0].companyname,
                    data.docs[0].companyaddress,
                    data.docs[0].companyphone,
                    data.docs[0].userid
                );
                response.write(JSON.stringify(responseData));
                console.log('ending response...');
                response.end();
            }
        } else {
            console.log(err);
        }
    });
});

/*
 * Create user's company information
 */
app.post('/api/companyinfo', function (request, response) {
    console.log("Create method companyinfo invoked.. ");

    createCompanyInfo(request.body.id, request.body.rev, request.body.companyname,
        request.body.companyaddress, request.body.companyphone, request.body.userid, response);
});

createCompanyInfo = function (id, rev, companyname, companyaddress, companyphone, userid, response) {

    console.log("_id: " + id);
    console.log("_rev: " + rev);

    if (id === undefined) {
        // Generated random id
        id = '';
    }

    if (rev === undefined) {
        rev = '';
    }

    if (rev !== '') {
        dbCompanyInfo.insert({
            _id: id,
            _rev: rev,
            companyname: companyname,
            companyaddress: companyaddress,
            companyphone: companyphone,
            userid: userid
        }, id, function (err, doc) {
            if (err) {
                console.log(err);
                response.sendStatus(500);
            } else {
                response.sendStatus(200);
            }
            response.end();
        });
    } else {
        dbCompanyInfo.insert({
            companyname: companyname,
            companyaddress: companyaddress,
            companyphone: companyphone,
            userid: userid
        }, id, function (err, doc) {
            if (err) {
                console.log(err);
                response.sendStatus(500);
            } else {
                response.sendStatus(200);
            }
            response.end();
        });
    }
}

app.delete('/api/companyinfo', function (request, response) {
    console.log("Delete Invoked..");
    var id = request.body.id;
    // var rev = request.query.rev; // Rev can be fetched from request. if
    // needed, send the rev from client
    console.log("Removing document of ID: " + id);
    console.log('Request Query: ' + JSON.stringify(request.query));

    dbCompanyInfo.get(id, {
        revs_info: true
    }, function (err, doc) {
        if (!err) {
            dbCompanyInfo.destroy(doc._id, doc._rev, function (err, res) {
                // Handle response
                if (err) {
                    console.log(err);
                    response.sendStatus(500);
                } else {
                    response.sendStatus(200);
                }
            });
        }
    });

});

/*
 * Get chat room data
 */
app.get('/api/chatroom', function (request, response) {
    console.log("Get method chatroom invoked.. ")

    var query = {
        "selector": {
            "salesmanUserID": request.query.salesmanUserID,
            "companyUserID": request.query.companyUserID,
            "salesOppID": request.query.salesOppID
        }
    };

    dbChatRoom = cloudant.use(dbCredentials.dbChatRoom);
    dbChatRoom.find(query, function (err, data) {
        if (!err) {
            var len = data.docs.length;
            if (len > 0) {
                // 'data' contains results
                var responseData = createResponseForGetChatRoom(
                    data.docs[0]._id,
                    data.docs[0]._rev,
                    data.docs[0].salesmanUserID,
                    data.docs[0].companyUserID,
                    data.docs[0].salesOppID,
                    data.docs[0].messages
                );
                response.write(JSON.stringify(responseData));
                console.log('ending response...');
                response.end();
            }
        } else {
            console.log(err);
        }
    });
});

/*
 * Create a chat room entry
 */
app.post('/api/chatroom', function (request, response) {
    console.log("Create method chatroom invoked.. ");

    createChatRoom(request.body.id, request.body.rev, request.body.salesmanUserID,
        request.body.companyUserID, request.body.salesOppID, request.body.messages, response);
});

createChatRoom = function (id, rev, salesmanUserID, companyUserID, salesOppID, messages, response) {

    console.log("_id: " + id);
    console.log("_rev: " + rev);

    if (id === undefined) {
        // Generated random id
        id = '';
    }

    if (rev === undefined) {
        rev = '';
    }

    dbChatRoom = cloudant.use(dbCredentials.dbChatRoom);
    if (rev !== '') {
        dbChatRoom.insert({
            _id: id,
            _rev: rev,
            salesmanUserID: salesmanUserID,
            companyUserID: companyUserID,
            salesOppID: salesOppID,
            messages: messages
        }, id, function (err, doc) {
            if (err) {
                console.log(err);
                response.sendStatus(500);
            } else {
                response.sendStatus(200);
            }
            response.end();
        });
    } else {
        dbChatRoom.insert({
            salesmanUserID: salesmanUserID,
            companyUserID: companyUserID,
            salesOppID: salesOppID,
            messages: messages
        }, id, function (err, doc) {
            if (err) {
                console.log(err);
                response.sendStatus(500);
            } else {
                response.sendStatus(200);
            }
            response.end();
        });
    }
}

http.createServer(app).listen(app.get('port'), '0.0.0.0', function () {
    console.log('Express server listening on port ' + app.get('port'));
});
