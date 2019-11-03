const functions = require('firebase-functions');
const admin = require('firebase-admin');

const serviceAccount = require('./service-account.json');
const adminConfig = JSON.parse(process.env.FIREBASE_CONFIG);
adminConfig.credential = admin.credential.cert(serviceAccount);
admin.initializeApp(adminConfig);

exports.processSignUp = functions.auth.user().onCreate(user => {
  return admin
    .auth()
    .setCustomUserClaims(user.uid, { groups: ['kubeko'] })
    .catch(err => console.log(err));
});

const upload = require('./upload');
const workloads = require('./workloads');
const proxy = require('./proxy');

// Entry point to Express app that handles file upload
exports.uploadFile = functions.https.onRequest(upload);

exports.api = functions.https.onRequest(workloads);

exports.proxy = functions.https.onRequest(proxy);
