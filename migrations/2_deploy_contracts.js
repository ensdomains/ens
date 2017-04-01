const ENS = artifacts.require("./ENS.sol");
const FIFSRegistrar = artifacts.require('./FIFSRegistrar.sol')
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
