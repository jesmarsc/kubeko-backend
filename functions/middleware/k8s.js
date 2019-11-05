const admin = require('firebase-admin');
const axios = require('axios');

const { KubeConfig } = require('kubernetes-client');
const Request = require('kubernetes-client/backends/request');
const Client = require('kubernetes-client').Client;

const firebaseWare = require('./firebase');
const { createCustomToken } = firebaseWare;

const setupKubeClient = (addr, token) => {
  const kubeconfig = new KubeConfig();
  kubeconfig.loadFromClusterAndUser(
    {
      server: `https://${addr}`,
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

const checkNamespace = async ({
  fields: { cid },
  addr,
  owner,
  decodedToken: { uid, email }
}) => {
  try {
    const adminToken = await createCustomToken();
    const opts = {
      headers: { Authorization: `Bearer ${adminToken}` },
      timeout: 10000
    };
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
              [`clusters-users/${cid}/${uid}`]: true
            };
            return ref.update(updates);
          });
      });

    return lowerCaseUid;
  } catch (error) {
    res.status(500);
    throw error;
  }
};

module.exports = { setupKubeClient, checkNamespace };
