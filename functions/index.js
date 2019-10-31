const functions = require('firebase-functions');
const admin = require('firebase-admin');

const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://kubeko.firebaseio.com'
});

exports.processSignUp = functions.auth.user().onCreate(user => {
  return admin
    .auth()
    .setCustomUserClaims(user.uid, { groups: ['kubeko'] })
    .catch(err => console.log(err));
});

const app = require('./app');
const main = require('./main');
const proxy = require('./proxy');

// Entry point to Express app that handles file upload
exports.uploadFile = functions.https.onRequest(app);

exports.api = functions.https.onRequest(main);

exports.proxy = functions.https.onRequest(proxy);
