const express = require('express');
const yaml = require('js-yaml');
const admin = require('firebase-admin');

const fileWare = require('../middleware/file');
const firebaseWare = require('../middleware/firebase');
const k8sUtil = require('../middleware/k8s');
const { setupKubeClient } = k8sUtil;

const router = express.Router();

const makeTimeout = (ms = 10000) =>
  new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('Request to cluster timed out.')), ms);
  });

router.post(
  '/',
  firebaseWare.verifyToken,
  fileWare.processFiles,
  async (req, res, next) => {
    const {
      files,
      fields: { cid },
      token,
      decodedToken: { uid }
    } = res.locals;

    const { addr, owner } = await firebaseWare.getClusterInfo(cid);

    const kubeClient = setupKubeClient(addr, token);

    const lowerCaseUid = uid.toLowerCase();

    const k8s = {
      Deployment: kubeClient.apis.apps.v1.ns(lowerCaseUid).deployments,
      Service: kubeClient.api.v1.ns(lowerCaseUid).service,
      Namespace: kubeClient.api.v1.ns
    };

    try {
      await Promise.race([
        k8s
          .Namespace(lowerCaseUid)
          .get()
          .catch(err =>
            k8s.Namespace.post({
              body: { metadata: { name: lowerCaseUid } }
            }).then(() => {
              const ref = admin.database().ref();
              const updates = {
                [`users/${uid}/deployments/${cid}`]: true,
                [`users/${owner}/clusters/${cid}/${uid}`]: true
              };
              return ref.update(updates);
            })
          ),
        makeTimeout(10000)
      ]);
      const waiting = [];
      for (const fileData of Object.values(files)) {
        const resources = yaml.safeLoadAll(fileData);
        for (const resource of resources) {
          waiting.push(k8s[resource.kind].post({ body: resource }));
        }
      }
      await Promise.all(waiting);
      next();
    } catch (error) {
      next(error);
    }
  },
  (req, res) => {
    res.json({ msg: 'Successful deployment!' });
  },
  (err, req, res, next) => {
    res.json({ status: 'Failure', message: err.message, code: res.statusCode });
  }
);

module.exports = router;
