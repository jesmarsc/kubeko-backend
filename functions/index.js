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

// Entry point to Express app that handles file upload
exports.uploadFile = functions.https.onRequest(app);
