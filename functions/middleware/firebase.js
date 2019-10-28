const admin = require('firebase-admin');

const verifyToken = async (req, res, next) => {
  try {
    if (!req.headers.authorization)
      throw new Error('Messing authorization headers.');
    res.locals.token = req.headers.authorization.split(' ')[1];
    res.locals.decodedToken = await admin
      .auth()
      .verifyIdToken(res.locals.token);
    next();
  } catch (error) {
    next(error);
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
