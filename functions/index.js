const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.uploadFile = functions.https.onRequest((req, res) => {
  res.jsos({ msg: 'Success!' });
});
