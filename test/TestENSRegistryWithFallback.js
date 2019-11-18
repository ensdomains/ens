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
        let result = await ens.setRecord('0x0', accounts[0], accounts[1], 3600, {from: accounts[0]});
        assert.equal(result.logs.length, 3);

        assert.equal((await ens.ttl('0x0')).toNumber(), 3600);
        assert.equal((await ens.owner('0x0')), accounts[0]);
        assert.equal((await ens.resolver('0x0')), accounts[1]);
    });

    it('should use fallback ttl if owner not set', async () => {
        await ens.setOwner('0x0', '0x0000000000000000000000000000000000000000');

        await old.setTTL('0x0', 3600, {from: accounts[0]});
        assert.equal((await ens.ttl('0x0')).toNumber(), 3600);
    });

    it('should use fallback owner if owner not set', async () => {
        await ens.setOwner('0x0', '0x0000000000000000000000000000000000000000');

        await old.setOwner('0x0', accounts[0], {from: accounts[0]});
        assert.equal(await ens.owner('0x0'), accounts[0]);
    });

    it('should use fallback resolver if owner not set', async () => {
        await ens.setOwner('0x0', '0x0000000000000000000000000000000000000000');

        await old.setResolver('0x0', accounts[0], {from: accounts[0]});
        assert.equal(await ens.resolver('0x0'), accounts[0]);
    });

});
