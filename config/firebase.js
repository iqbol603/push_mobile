const admin = require('firebase-admin');
// const serviceAccount = require('./firebase-service-account.json');
const serviceAccount = require("./babilon-t-firebase-adminsdk-elns8-3915645204.json"); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;