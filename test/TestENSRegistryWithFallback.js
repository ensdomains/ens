const namehash = require('eth-ens-namehash');
const sha3 = require('web3-utils').sha3;

const { exceptions } = require("@ensdomains/test-utils")

const ENS = artifacts.require('ENSRegistryWithFallback.sol');

const ENSWithoutFallback = artifacts.require("ENSRegistry.sol");

contract('ENSRegistryWithFallback', function (accounts) {

    let old;
    let ens;

    beforeEach(async () => {
        old = await ENSWithoutFallback.new();
        ens = await ENS.new(old.address);
    });

    it('should allow setting the record', async () => {
        let result = await ens.setRecord('0x0', accounts[1], accounts[2], 3600, {from: accounts[0]});
        assert.equal(result.logs.length, 3);

        assert.equal((await ens.ttl('0x0')).toNumber(), 3600);
        assert.equal((await ens.owner('0x0')), accounts[1]);
        assert.equal((await ens.resolver('0x0')), accounts[2]);
    });

    describe('fallback', async () => {

        let hash = namehash('eth');

        beforeEach(async () => {
            await old.setSubnodeOwner('0x0', sha3('eth'), accounts[0], {from: accounts[0]});
        });

        it('should use fallback ttl if owner not set', async () => {
            let hash = namehash('eth')
            await old.setSubnodeOwner('0x0', sha3('eth'), accounts[0], {from: accounts[0]});
            await old.setTTL(hash, 3600, {from: accounts[0]});
            assert.equal((await ens.ttl(hash)).toNumber(), 3600);
        });

        it('should use fallback owner if owner not set', async () => {
            await old.setOwner(hash, accounts[0], {from: accounts[0]});
            assert.equal(await ens.owner(hash), accounts[0]);
        });

        it('should use fallback resolver if owner not set', async () => {
            await old.setResolver(hash, accounts[0], {from: accounts[0]});
            assert.equal(await ens.resolver(hash), accounts[0]);
        });
    });
});
