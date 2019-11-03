const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');
const file = require('../middleware/file');
const admin = require('firebase-admin');
const firebase = require('../middleware/firebase');

const util = require('util');
const readFilePromise = util.promisify(fs.readFile);
const unlinkFilePromise = util.promisify(fs.unlink);

const k8sUtil = require('../middleware/k8s');
const { setupKubeClient } = k8sUtil;

const router = express.Router();

const makeTimeout = (ms = 10000) =>
  new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('Request to cluster timed out.')), ms);
  });

router.post(
  '/',
  file.saveAll,
  firebase.verifyClusterandOwner,
  async (req, res, next) => {
    const {
      files,
      fields: { cid },
      addr,
      owner,
      token,
      decodedToken: { uid },
      cluster,
      deployment
    } = res.locals;

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
              cluster.update({ [uid]: true });
              deployment.update({ [cid]: true });
            })
          ),
        makeTimeout(10000)
      ]);
      for (const filePath of Object.values(files)) {
        const fileData = await readFilePromise(filePath, 'utf-8');
        const resources = yaml.safeLoadAll(fileData);
        for (const resource of resources) {
          await k8s[resource.kind].post({ body: resource });
        }
        unlinkFilePromise(filePath).catch(next);
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  (req, res) => {
    res.json({ msg: 'Successful deployment!' });
  },
  file.cleanupOnError,
  (err, req, res, next) => {
    statusCode = !!err.code && typeof err.code === 'number' ? err.code : 500;
    res.status(statusCode).json({ err: err.message });
  }
);

module.exports = router;
