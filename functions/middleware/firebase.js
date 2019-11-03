const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

const verifyToken = async (req, res, next) => {
  try {
    res.locals.token = req.headers.authorization.split(' ')[1];
    res.locals.decodedToken = await admin
      .auth()
      .verifyIdToken(res.locals.token);
    next();
  } catch (error) {
    res.status(400);
    next(error);
  }
};

const createCustomToken = async (req, res, next) => {
  try {
    const customToken = await admin.auth().createCustomToken('admin', {
      groups: ['admin'],
      email: ''
    });
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${
        functions.config().api.key
      }`,
      { token: customToken, returnSecureToken: true }
    );
    return response.data.idToken;
  } catch (error) {
    res.status(500);
    throw error;
  }
};

const verifyClusterandOwner = async (req, res, next) => {
  try {
    const uid = res.locals.decodedToken.uid;
    const cid = res.locals.fields.cid;
    await admin
      .database()
      .ref(`clusters/${cid}`)
      .once('value')
      .then(snapshot => {
        if (!snapshot.exists()) {
          throw new Error('Invalid cluster selected.');
        }
        const { owner, addr } = snapshot.exportVal();
        res.locals.owner = owner;
        res.locals.addr = addr;
        res.locals.cluster = admin
          .database()
          .ref(`users/${owner}/clusters/${cid}`);
        res.locals.deployment = admin
          .database()
          .ref(`users/${uid}/deployments`);
      });
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { verifyToken, verifyClusterandOwner };
