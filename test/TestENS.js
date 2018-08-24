const utils = require('./helpers/Utils.js');
const web3Utils = require('web3-utils');
const namehash = require('eth-ens-namehash');

let contracts = [
    [artifacts.require('ENSRegistry.sol'), 'Solidity'],
    [artifacts.require('ENS.lll'), 'LLL']
];

contracts.forEach(function ([ENS, lang]) {
    contract('ENS ' + lang, function (accounts) {

        let ens;

        beforeEach(async () => {
            ens = await ENS.new();
        });

        it('should allow ownership transfers', async () => {
            let result = await ens.setOwner(0, '0x1234', {from: accounts[0]});

            assert.equal(await ens.owner(0), '0x0000000000000000000000000000000000001234')

            assert.equal(result.logs.length, 1);
            let args = result.logs[0].args;
            assert.equal(args.node, "0x0000000000000000000000000000000000000000000000000000000000000000");
            assert.equal(args.owner, "0x0000000000000000000000000000000000001234");
        });

        it('should prohibit transfers by non-owners', async () => {
            try {
                await ens.setOwner(1, '0x1234', {from: accounts[0]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('transfer did not fail');
        });

        it('should allow setting resolvers', async () => {
            let result = await ens.setResolver(0, '0x1234', {from: accounts[0]});

            assert.equal(await ens.resolver(0), "0x0000000000000000000000000000000000001234");

            assert.equal(result.logs.length, 1);
            let args = result.logs[0].args;
            assert.equal(args.node, "0x0000000000000000000000000000000000000000000000000000000000000000");
            assert.equal(args.resolver, "0x0000000000000000000000000000000000001234");
        });

        it('should prevent setting resolvers by non-owners', async () => {
            try {
                await ens.setResolver(1, '0x1234', {from: accounts[0]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting resolver did not fail');
        });

        it('should allow setting the TTL', async () => {
            let result = await ens.setTTL(0, 3600, {from: accounts[0]});

            assert.equal((await ens.ttl(0)).toNumber(), 3600);

            assert.equal(result.logs.length, 1);
            let args = result.logs[0].args;
            assert.equal(args.node, "0x0000000000000000000000000000000000000000000000000000000000000000");
            assert.equal(args.ttl.toNumber(), 3600);
        });

        it('should prevent setting the TTL by non-owners', async () => {
            try {
                await ens.setTTL(1, 3600, {from: accounts[0]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting resolver did not fail');
        });

        it('should allow the creation of subnodes', async () => {
            let result = await ens.setSubnodeOwner(0, web3Utils.sha3('eth'), accounts[1], {from: accounts[0]});

            assert.equal(await ens.owner(namehash('eth')), accounts[1]);

            assert.equal(result.logs.length, 1);
            let args = result.logs[0].args;
            assert.equal(args.node, "0x0000000000000000000000000000000000000000000000000000000000000000");
            assert.equal(args.label, web3.sha3('eth'));
            assert.equal(args.owner, accounts[1]);
        });

        it('should prohibit subnode creation by non-owners', async () => {
            try {
                await ens.setSubnodeOwner(0, web3Utils.sha3('eth'), accounts[1], {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting resolver did not fail');
        });
    });
});
