const express = require('express');
const cors = require('cors');
const proxy = require('http-proxy-middleware');
const admin = require('firebase-admin');

const app = express();

app.use(cors({ origin: true }));

const getCluster = async (req, res, next) => {
  const cid = req.params.cid;
  try {
    const snapshot = await admin
      .database()
      .ref(`clusters/${cid}`)
      .once('value');
    const { addr } = snapshot.val();
    req.addr = addr;
    next();
  } catch (err) {
    res.status(404);
    next(new Error(`Cannot find cluster with \`cid\` of '${cid}'.`));
  }
};

app.use(
  '/clusters/:cid',
  getCluster,
  proxy({
    target: 'https://localhost',
    router: req => `https://${req.addr}`,
    pathRewrite: { '^/clusters/[^./]+/': '/' },
    changeOrigin: true
  }),
  (err, req, res, next) => {
    res.json({ status: 'Failure', message: err.message, code: res.statusCode });
  }
);

module.exports = app;
