const admin = require('firebase-admin');
const axios = require('axios');

const { KubeConfig } = require('kubernetes-client');
const Request = require('kubernetes-client/backends/request');
const Client = require('kubernetes-client').Client;

const firebaseWare = require('./firebase');
const { createCustomToken } = firebaseWare;

const setupKubeClient = (ip, token) => {
  const kubeconfig = new KubeConfig();
  kubeconfig.loadFromClusterAndUser(
    {
      server: `https://${ip}`,
      skipTLSVerify: true
    },
    {
      token
    }
  );

  return new Client({
    backend: new Request({ kubeconfig }),
    version: '1.13'
  });
};

const getCluster = async (req, res, next) => {
  try {
    const { cid } = req.params;
    const snapshot = await admin
      .database()
      .ref(`clusters/${cid}`)
      .once('value');
    const { addr, owner } = snapshot.val();
    req.addr = addr;
    req.owner = owner;
    next();
  } catch (error) {
    res.status(404);
    next(error);
  }
};

const checkNamespace = async (req, res, next) => {
  try {
    const { cid } = req.params;
    const { addr, owner } = req;
    const {
      decodedToken: { uid, email }
    } = res.locals;
    const adminToken = await createCustomToken(res);
    const opts = { headers: { Authorization: `Bearer ${adminToken}` } };
    const lowerCaseUid = uid.toLowerCase();

    await axios
      .get(`https://${addr}/api/v1/namespaces/${lowerCaseUid}`, opts)
      .catch(err => {
        if (err.response.status !== 404) throw err;
        return axios
          .post(
            `https://${addr}/api/v1/namespaces`,
            { metadata: { name: lowerCaseUid } },
            opts
          )
          .then(() =>
            Promise.all([
              axios.post(
                `https://${addr}/apis/rbac.authorization.k8s.io/v1/namespaces/${lowerCaseUid}/roles`,
                {
                  metadata: { name: `${lowerCaseUid}-role` },
                  rules: [
                    {
                      apiGroups: ['*'],
                      resources: ['*'],
                      verbs: ['*']
                    }
                  ]
                },
                opts
              ),
              axios.post(
                `https://${addr}/apis/rbac.authorization.k8s.io/v1/namespaces/${lowerCaseUid}/rolebindings`,
                {
                  metadata: { name: `${lowerCaseUid}-rolebinding` },
                  subjects: [{ kind: 'User', name: email }],
                  roleRef: {
                    kind: 'Role',
                    name: `${lowerCaseUid}-role`,
                    apiGroup: 'rbac.authorization.k8s.io'
                  }
                },
                opts
              )
            ])
          )
          .then(() => {
            const ref = admin.database().ref();
            const updates = {
              [`users/${uid}/deployments/${cid}`]: true,
              [`users/${owner}/clusters/${cid}/${uid}`]: true
            };
            return ref.update(updates);
          });
      });

    next();
  } catch (error) {
    res.status(500);
    next(error);
  }
};

module.exports = { setupKubeClient, getCluster, checkNamespace };
