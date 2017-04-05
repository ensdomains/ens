const ENS = artifacts.require("./ENS.sol");
const FIFSRegistrar = artifacts.require('./FIFSRegistrar.sol');

// Currently the parameter('./ContractName') is only used to imply
// the compiled contract JSON file name. So even though `Registrar.sol` is
// not existed, it's valid to put it here.
// TODO: align the contract name with the source code file name.
const Registrar = artifacts.require('./Registrar.sol');
const web3 = new (require('web3'))();
const namehash = require('eth-ens-namehash');

/**
 * Deploy the ENS and FIFSRegistrar
 *
 * @param {Object} deployer truffle deployer helper
 * @param {string} rootNode hashed name using namehash algorithm
 */
function deployFIFSRegistrar(deployer, rootNode) {
  // Deploy the ENS first
  deployer.deploy(ENS)
    .then(() => {
      // Deploy the FIFSRegistrar and bind it with ENS
      return deployer.deploy(FIFSRegistrar, ENS.address, rootNode);
    })
    .then(function() {
      // Transfer the owner of the `rootNode` to the FIFSRegistrar
      ENS.at(ENS.address).setSubnodeOwner('0x0', web3.sha3('eth'), FIFSRegistrar.address);
    });
}

/**
 * Deploy the ENS and HashRegistrar(Simplified)
 *
 * @param {Object} deployer truffle deployer helper
 * @param {string} rootNode hashed name using namehash algorithm
 */
function deployAuctionRegistrar(deployer, rootNode) {
  // Deploy the ENS first
  deployer.deploy(ENS)
    .then(() => {
      // Deploy the HashRegistrar and bind it with ENS
      // the last argument `0` specifies the auction start date to `now`
      return deployer.deploy(Registrar, ENS.address, rootNode, 0);
    })
    .then(function() {
      // Transfer the owner of the `rootNode` to the FIFSRegistrar
      ENS.at(ENS.address).setSubnodeOwner('0x0', web3.sha3('eth'), Registrar.address);
    });
}

module.exports = function(deployer, network) {
  const rootNode = namehash('eth');

  if (network === 'dev.fifs') {
    deployFIFSRegistrar(deployer, rootNode);
  }
  else if (network === 'dev.auction') {
    deployAuctionRegistrar(deployer, rootNode);
  }

};
