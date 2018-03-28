const DefaultReverseResolver = artifacts.require('DefaultReverseResolver.sol');
const ReverseRegistrar = artifacts.require('ReverseRegistrar.sol');
const ENS = artifacts.require('ENSRegistry.sol');

const utils = require('./helpers/Utils.js');
const namehash = require('eth-ens-namehash');

contract('ReverseRegistar', function (accounts) {

    let node;
    let registrar, resolver, ens;

    beforeEach(async () => {
        node = namehash(accounts[0].slice(2).toLowerCase() + ".addr.reverse");
        ens = await ENS.new();
        resolver = await DefaultReverseResolver.new(ens.address);
        registrar = await ReverseRegistrar.new(ens.address, resolver.address);

        await ens.setSubnodeOwner(0, web3.sha3('reverse'), accounts[0], {from: accounts[0]});
        await ens.setSubnodeOwner(namehash('reverse'), web3.sha3('addr'), registrar.address, {from: accounts[0]});
    });

    it('should calculate node hash correctly', async () => {
        assert.equal(await registrar.node.call(accounts[0]), node);
    });

    it('allows an account to claim its address', async () => {
        await registrar.claim(accounts[1], {from: accounts[0]});
        assert.equal(await ens.owner(node), accounts[1]);
    });

    it('allows an account to specify resolver', async () =>  {
        await registrar.claimWithResolver(accounts[1], accounts[2], {from: accounts[0]});
        assert.equal(await ens.owner(node), accounts[1]);
        assert.equal(await ens.resolver(node), accounts[2]);
    });

    it('does not overwrite resolver if not specified', async () => {
        await registrar.claimWithResolver(accounts[1], accounts[2], {from: accounts[0]});
        await registrar.claim(accounts[3], {from: accounts[0]});

        assert.equal(await ens.owner(node), accounts[3]);
        assert.equal(await ens.resolver(node), accounts[2]);
    });

    it('sets name records', async () => {
        await registrar.setName('testname', {from: accounts[0], gas: 1000000});
        assert.equal(await ens.resolver(node), resolver.address);
        assert.equal(await resolver.name(node), 'testname');
    });

    // @todo this test does not work.
    // it('allows the owner to update the name', async () => {
    //     await registrar.claimWithResolver(accounts[1], resolver.address, {from: accounts[0]});
    //     await registrar.setName('testname', {from: accounts[1]});
    //     assert.equal(await resolver.name(node), 'testname');
    // });

    it('does not allow non-owners to update the name', async () => {
        await registrar.claimWithResolver(accounts[1], resolver.address, {from: accounts[0]});

        try {
            await resolver.setName(node, 'testname', {from: accounts[0]})
        } catch (error) {
            return utils.ensureException(error);
        }

        assert.fail('updating name did not fail');
    });
});
