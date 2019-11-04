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

const createCustomToken = async () => {
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
    throw error;
  }
};

const getClusterInfo = async cid => {
  try {
    const snapshot = await admin
      .database()
      .ref(`clusters/${cid}`)
      .once('value');
    const { addr, owner } = snapshot.val();
    return { addr, owner };
  } catch (error) {
    throw error;
  }
};

module.exports = { verifyToken, createCustomToken, getClusterInfo };
