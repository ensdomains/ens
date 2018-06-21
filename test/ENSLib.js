const FIFSRegistrar = artifacts.require('FIFSRegistrar.sol');
const ENS = artifacts.require('ENSRegistry.sol');
const ENSLib = artifacts.require('ENSLib.sol');
const TestRegistryLib = artifacts.require('TestRegistryLib.sol');
const PublicResolver = artifacts.require('PublicResolver.sol');

const utils = require('./helpers/Utils.js');
const web3Utils = require('web3-utils');
const namehash = require('eth-ens-namehash');

contract('ENSLib', function (accounts) {

    let resolver, registrar, ens;

    beforeEach(async () => {
        ens = await ENS.new();
        const ensLib = await ENSLib.new();
        TestRegistryLib.link('ENSLib', ensLib.address);
        testRegistryLib = await TestRegistryLib.new(ens.address);

        await ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[0], {from: accounts[0]});
        registrar = await FIFSRegistrar.new(ens.address, namehash('eth'));
        await ens.setOwner(namehash('eth'), registrar.address, {from: accounts[0]});

    });

    it('should get the right info of ens subnode', async () => {

      await registrar.register(web3Utils.sha3('testdomain'), accounts[1], {from: accounts[0]});
      await ens.setResolver(namehash('testdomain.eth'), accounts[2], {from: accounts[1]});
      await ens.setTTL(namehash('testdomain.eth'), 10, {from: accounts[1]});

      assert.equal(await ens.owner(namehash('eth')), registrar.address);
      assert.equal(await ens.owner(namehash('eth')), registrar.address);
      assert.equal(await ens.owner(namehash('testdomain.eth')), accounts[1]);
      assert.equal(await testRegistryLib.ensAddr(), ens.address);
      assert.equal(await testRegistryLib.hashname('testdomain.eth'), namehash('testdomain.eth'));
      assert.equal(await testRegistryLib.owner(namehash('testdomain.eth')), accounts[1]);
      assert.equal(await testRegistryLib.ownerByENSName('testdomain.eth'), accounts[1]);
      assert.equal(await testRegistryLib.resolver(namehash('testdomain.eth')), accounts[2]);
      assert.equal(await testRegistryLib.ttl(namehash('testdomain.eth')), 10);
    });

});
