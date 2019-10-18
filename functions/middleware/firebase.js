const admin = require('firebase-admin');

const setCustomClaims = async (req, res, next) => {
  try {
    if (
      !res.locals.decodedToken.groups &&
      !res.locals.decodedToken.groups.includes('kubeko')
    ) {
      admin.auth().setCustomUserClaims(res.locals.decodedToken.uid, {
        groups: ['kubeko'],
      });
      throw new Error('Group claim was missing, try again.');
    }
    next();
  } catch (error) {
    next(error);
  }
};

const verification = async (req, res, next) => {
  try {
    res.locals.token = req.headers.authorization.split(' ')[1];
    res.locals.decodedToken = await admin
      .auth()
      .verifyIdToken(res.locals.token);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { verification, setCustomClaims };
