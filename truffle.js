module.exports = {
  networks: {
    'dev.fifs': {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    }
  },
  compilers: {
    solc: {
      version: "0.7.4",
    }
  }
};
