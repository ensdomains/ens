const TestRegistrar = artifacts.require('TestRegistrar.sol');
const ENS = artifacts.require('ENSRegistry.sol');

const utils = require('./helpers/Utils.js');
const namehash = require('eth-ens-namehash');

contract('TestRegistrar', function (accounts) {

    let node;
    let registrar, ens;

    beforeEach(async () => {
        node = namehash('eth');

        ens = await ENS.new();
        registrar = await TestRegistrar.new(ens.address, 0);

        await ens.setOwner(0, registrar.address, {from: accounts[0]})
    });

    it('registers names', async () => {
        await registrar.register(web3.sha3('eth'), accounts[0], {from: accounts[0]});
        assert.equal(await ens.owner(0), registrar.address);
        assert.equal(await ens.owner(node), accounts[0]);
    });

    it('forbids transferring names within the test period', async () => {

        await registrar.register(web3.sha3('eth'), accounts[1], {from: accounts[0]});

        try {
            await registrar.register(web3.sha3('eth'), accounts[0], {from: accounts[0]});
        } catch (error) {
            return utils.ensureException(error);
        }

        assert.fail('transferring name did not fail');

    });

    it('allows claiming a name after the test period expires', async () => {
        await registrar.register(web3.sha3('eth'), accounts[1], {from: accounts[0]});
        assert.equal(await ens.owner(node), accounts[1]);

        await web3.currentProvider.send({
            jsonrpc: "2.0",
            "method": "evm_increaseTime",
            params: [28 * 24 * 60 * 60 + 1]
        });

        await registrar.register(web3.sha3('eth'), accounts[0], {from: accounts[0]});
        assert.equal(await ens.owner(node), accounts[0]);
    });
});

